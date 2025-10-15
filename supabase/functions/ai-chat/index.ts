import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, taskId, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get user role
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    // Get conversation history
    const { data: history } = await supabase
      .from("chat_messages")
      .select("message, is_ai")
      .is("task_id", taskId || null)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = [
      {
        role: "system",
        content: `You are ChatFlow Agent, an AI assistant for task management. 
        
User role: ${userRole?.role || "employee"}

Your capabilities:
- Help admins and staff create and assign tasks
- Match employees to tasks based on skills and availability
- Track task progress and provide updates
- Answer questions about tasks, employees, and workflows

When admins request task assignment:
1. Understand the task requirements and required skills
2. Search for suitable employees based on skills and availability
3. Suggest the best match and ask for approval
4. Create the task assignment upon approval

Be conversational, helpful, and professional. For task creation, extract:
- Task title
- Description
- Required skills
- Priority level
- Deadline (if mentioned)

Always confirm details before creating or assigning tasks.`,
      },
      ...(history || []).map((msg) => ({
        role: msg.is_ai ? "assistant" : "user",
        content: msg.message,
      })),
      {
        role: "user",
        content: message,
      },
    ];

    // Detect if this is a task assignment request
    const isTaskRequest = 
      (userRole?.role === "admin" || userRole?.role === "staff") &&
      (message.toLowerCase().includes("assign") || 
       message.toLowerCase().includes("create task") ||
       message.toLowerCase().includes("new task"));

    let aiResponse = "";
    let metadata: any = {};

    if (isTaskRequest) {
      // Enhanced prompt for task extraction
      const extractionMessages = [
        ...messages,
        {
          role: "system",
          content: `Extract task details from the user's message. If employee matching is requested, suggest employees.
          
          Respond in JSON format:
          {
            "needsEmployeeMatch": true/false,
            "taskDetails": {
              "title": "task title",
              "description": "task description",
              "requiredSkills": ["skill1", "skill2"],
              "priority": "low/medium/high",
              "deadline": "ISO date or null"
            },
            "response": "Your conversational response to the user"
          }`,
        },
      ];

      const aiResult = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: extractionMessages,
        }),
      });

      const aiData = await aiResult.json();
      const aiText = aiData.choices[0].message.content;

      try {
        const parsed = JSON.parse(aiText);
        aiResponse = parsed.response;
        metadata = parsed;

        // If we need to match employees, search for them
        if (parsed.needsEmployeeMatch && parsed.taskDetails) {
          const skills = parsed.taskDetails.requiredSkills || [];
          
          if (skills.length > 0) {
            const { data: employees } = await supabase
              .from("employee_profiles")
              .select(`
                user_id,
                skills,
                availability,
                current_workload,
                performance_score,
                profiles!inner(full_name)
              `)
              .eq("availability", true)
              .order("current_workload", { ascending: true })
              .limit(5);

            // Score employees based on skill match
            const scoredEmployees = employees?.map((emp: any) => {
              const matchedSkills = skills.filter((s: string) => 
                emp.skills.some((es: string) => es.toLowerCase().includes(s.toLowerCase()))
              );
              const score = (matchedSkills.length / skills.length) * 100;
              return { ...emp, matchScore: score };
            }).filter((emp: any) => emp.matchScore > 0)
              .sort((a: any, b: any) => b.matchScore - a.matchScore);

            if (scoredEmployees && scoredEmployees.length > 0) {
              const topMatch = scoredEmployees[0];
              metadata.suggestedEmployee = {
                userId: topMatch.user_id,
                name: topMatch.profiles.full_name,
                skills: topMatch.skills,
                workload: topMatch.current_workload,
                matchScore: topMatch.matchScore,
              };

              aiResponse += `\n\nI suggest assigning this to ${topMatch.profiles.full_name} (${topMatch.matchScore.toFixed(0)}% skill match, current workload: ${topMatch.current_workload}). Shall I send the invitation?`;
            } else {
              aiResponse += "\n\nI couldn't find employees with matching skills. Would you like to proceed anyway or modify the requirements?";
            }
          }
        }
      } catch (e) {
        // If not valid JSON, use the AI response as is
        aiResponse = aiText;
      }
    } else {
      // Regular conversation
      const aiResult = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
        }),
      });

      if (!aiResult.ok) {
        if (aiResult.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResult.status === 402) {
          return new Response(
            JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error("AI gateway error");
      }

      const aiData = await aiResult.json();
      aiResponse = aiData.choices[0].message.content;
    }

    return new Response(
      JSON.stringify({ response: aiResponse, metadata }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in ai-chat function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});