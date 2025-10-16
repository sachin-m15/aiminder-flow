import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper to calculate skill match score
const calculateMatchScore = (
  employee: any,
  requiredSkills: string[],
  allEmployees: any[]
) => {
  const employeeSkills = employee.skills || [];
  const skillMatch = requiredSkills.filter(skill => 
    employeeSkills.some((empSkill: string) => 
      empSkill.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(empSkill.toLowerCase())
    )
  ).length;
  
  const maxWorkload = Math.max(...allEmployees.map(e => e.current_workload || 0), 1);
  const workloadScore = 1 - ((employee.current_workload || 0) / maxWorkload);
  const performanceScore = (employee.performance_score || 0) / 100;
  
  return (skillMatch / Math.max(requiredSkills.length, 1)) * 0.5 + 
         workloadScore * 0.3 + 
         performanceScore * 0.2;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, taskId, userId, action, actionData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle specific actions (approve invitation, create task, etc.)
    if (action === "create_task" && actionData) {
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          title: actionData.title,
          description: actionData.description,
          created_by: userId,
          assigned_to: actionData.assignedTo,
          status: actionData.assignedTo ? "invited" : "pending",
          priority: actionData.priority || "medium",
          required_skills: actionData.skills || [],
          deadline: actionData.deadline,
          estimated_hours: actionData.estimatedHours,
        })
        .select()
        .single();

      if (task && actionData.assignedTo) {
        await supabase.from("invitations").insert({
          task_id: task.id,
          to_user_id: actionData.assignedTo,
          from_user_id: userId,
          status: "pending",
        });

        const responseText = `✅ Task "${actionData.title}" created and invitation sent to ${actionData.employeeName}!`;
        await supabase.from("chat_messages").insert({
          user_id: userId,
          message: responseText,
          is_ai: true,
          task_id: task.id,
        });

        return new Response(JSON.stringify({ response: responseText, taskCreated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
- Help admins create and assign tasks using natural language
- Match employees to tasks based on skills, availability and performance
- Track task progress and provide updates
- Generate payment estimates based on hours and complexity

When admins request task creation:
1. Extract: title, description, required skills, priority, deadline, estimated hours
2. Search for suitable employees based on skill match
3. Present top 3 candidates with match scores and justifications
4. Wait for admin approval before creating task

Be conversational, helpful, and professional.`,
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
    const isAdmin = userRole?.role === "admin" || userRole?.role === "staff";
    const taskKeywords = ["create task", "assign", "new task", "task for", "need someone", "find employee"];
    const isTaskRequest = isAdmin && taskKeywords.some(k => message.toLowerCase().includes(k));

    let aiResponse = "";
    let metadata: any = {};

    if (isTaskRequest) {
      // Extract task details using AI
      const extractionMessages = [
        {
          role: "system",
          content: `Extract task details from the user's message. Return ONLY valid JSON:
{
  "title": "concise task title",
  "description": "detailed description",
  "skills": ["skill1", "skill2"],
  "priority": "low|medium|high",
  "estimatedHours": number or null,
  "deadline": "YYYY-MM-DD" or null,
  "needsEmployeeMatch": true/false
}`,
        },
        { role: "user", content: message }
      ];

      const extractResult = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

      const extractData = await extractResult.json();
      let taskData;
      
      try {
        const content = extractData.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        taskData = jsonMatch ? JSON.parse(jsonMatch[0]) : { needsEmployeeMatch: false };
      } catch (e) {
        console.error("Parse error:", e);
        taskData = { needsEmployeeMatch: false };
      }

      if (taskData.needsEmployeeMatch && taskData.skills?.length > 0) {
        // Fetch available employees
        const { data: employees } = await supabase
          .from("employee_profiles")
          .select(`
            user_id,
            skills,
            availability,
            current_workload,
            performance_score,
            hourly_rate,
            on_time_rate,
            quality_score,
            profiles!inner(full_name, email)
          `)
          .eq("availability", true);

        if (employees && employees.length > 0) {
          // Calculate match scores
          const scoredEmployees = employees
            .map((emp) => ({
              ...emp,
              matchScore: calculateMatchScore(emp, taskData.skills, employees),
            }))
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 3);

          const suggestions = scoredEmployees.map((emp, idx) => {
            const skillMatches = (emp.skills || []).filter((s: string) =>
              taskData.skills.some((ts: string) => 
                s.toLowerCase().includes(ts.toLowerCase()) ||
                ts.toLowerCase().includes(s.toLowerCase())
              )
            );
            
            const estimatedCost = taskData.estimatedHours && emp.hourly_rate 
              ? (taskData.estimatedHours * emp.hourly_rate).toFixed(2)
              : "N/A";
            
            const profile = Array.isArray(emp.profiles) ? emp.profiles[0] : emp.profiles;
              
            return `${idx + 1}. **${profile?.full_name || "Unknown"}**
   - Matched Skills: ${skillMatches.join(", ")}
   - Workload: ${emp.current_workload || 0} active tasks
   - Performance: ${Math.round(emp.quality_score || 0)}% quality
   - Match Score: ${Math.round(emp.matchScore * 100)}%
   ${estimatedCost !== "N/A" ? `- Estimated Cost: $${estimatedCost}` : ""}`;
          });

          aiResponse = `I've analyzed your requirements and found these top candidates:

${suggestions.join("\n\n")}

📋 **Task Summary:**
- Title: ${taskData.title}
- Skills: ${taskData.skills.join(", ")}
- Priority: ${taskData.priority}
${taskData.estimatedHours ? `- Estimated Hours: ${taskData.estimatedHours}` : ""}
${taskData.deadline ? `- Deadline: ${taskData.deadline}` : ""}

Would you like to send an invitation to the top match?`;

          const firstEmpProfile = Array.isArray(scoredEmployees[0].profiles) 
            ? scoredEmployees[0].profiles[0] 
            : scoredEmployees[0].profiles;
          
          metadata = {
            taskData,
            suggestedEmployees: scoredEmployees.map(e => {
              const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
              return {
                id: e.user_id,
                name: profile?.full_name || "Unknown",
                email: profile?.email || "",
                matchScore: e.matchScore,
                estimatedCost: taskData.estimatedHours && e.hourly_rate 
                  ? taskData.estimatedHours * e.hourly_rate 
                  : null
              };
            })
          };

          // Store in chat
          await supabase.from("chat_messages").insert({
            user_id: userId,
            message: aiResponse,
            is_ai: true,
            metadata,
          });

          return new Response(JSON.stringify({ response: aiResponse, metadata }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

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
