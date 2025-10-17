import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI Provider helper - tries Lovable first, falls back to OpenAI
async function callAI(messages: any[], apiKey: { lovable?: string; openai?: string }) {
  // Try Lovable first (primary)
  if (apiKey.lovable) {
    try {
      const lovableResult = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.lovable}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
        }),
      });

      if (lovableResult.ok) {
        const data = await lovableResult.json();
        return { success: true, data, provider: "lovable" };
      }
      
      // Log Lovable error but don't throw - fallback to OpenAI
      console.log(`Lovable API error (${lovableResult.status}), falling back to OpenAI...`);
    } catch (error) {
      console.log("Lovable API error:", error, "- falling back to OpenAI...");
    }
  }

  // Fallback to OpenAI
  if (apiKey.openai) {
    try {
      console.log("Calling OpenAI API...");
      const openaiResult = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.openai}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-2025-04-14",
          messages,
        }),
      });

      if (!openaiResult.ok) {
        const errorData = await openaiResult.json();
        console.error("OpenAI API error response:", errorData);
        throw new Error(`OpenAI API error: ${errorData.error?.message || openaiResult.statusText}`);
      }

      const data = await openaiResult.json();
      console.log("OpenAI API success!");
      return { success: true, data, provider: "openai" };
    } catch (error) {
      console.error("OpenAI API error:", error);
      throw error;
    }
  }

  // No API keys available
  throw new Error("No AI API keys configured. Please set LOVABLE_API_KEY or OPENAI_API_KEY.");
}

// Helper to calculate skill match score (aligned with frontend)
const calculateMatchScore = (
  employee: any,
  requiredSkills: string[]
) => {
  const employeeSkills = (employee.skills || []).map((s: string) => s.toLowerCase());
  
  // Skill Match (0-100)
  const matchedSkills = requiredSkills.filter(skill => 
    employeeSkills.some((empSkill: string) => 
      empSkill.includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(empSkill)
    )
  );
  const skillMatch = requiredSkills.length > 0 
    ? (matchedSkills.length / requiredSkills.length) * 100 
    : 50;

  // Workload Capacity (0-100) - Lower workload = Higher score
  const maxWorkload = 10;
  const workloadCapacity = Math.max(0, ((maxWorkload - (employee.current_workload || 0)) / maxWorkload) * 100);

  // Performance Score (0-100)
  const performanceScore = employee.performance_score || 0;

  // Availability Score (0-100) - Based on current workload
  const availabilityScore = (employee.current_workload || 0) < 3 ? 100 : 
                           (employee.current_workload || 0) < 5 ? 70 : 40;

  // Weighted Score (aligned with TaskAssignmentDialog)
  const matchScore = 
    (skillMatch * 0.40) + 
    (workloadCapacity * 0.30) + 
    (performanceScore * 0.20) + 
    (availabilityScore * 0.10);

  return Math.round(matchScore);
};

serve(async (req) => {
  console.log("=== AI-CHAT FUNCTION CALLED ===");
  
  if (req.method === "OPTIONS") {
    console.log("OPTIONS request - returning CORS headers");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    
    let { message, taskId, userId, action, actionData, conversationId } = body;
    
    // Get API keys - try Lovable first, fallback to OpenAI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    
    console.log("API Keys status:", {
      lovable: LOVABLE_API_KEY ? "✓ Present" : "✗ Missing",
      openai: OPENAI_API_KEY ? "✓ Present" : "✗ Missing"
    });
    
    if (!LOVABLE_API_KEY && !OPENAI_API_KEY) {
      throw new Error("No AI API keys configured. Please set LOVABLE_API_KEY or OPENAI_API_KEY");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If no conversation_id provided, get user's default conversation from database
    if (!conversationId && userId) {
      console.log("No conversation_id provided, fetching from database...");
      const { data: existingMsg } = await supabase
        .from("chat_messages")
        .select("conversation_id")
        .eq("user_id", userId)
        .limit(1)
        .single();
      
      if (existingMsg?.conversation_id) {
        conversationId = existingMsg.conversation_id;
        console.log("Using existing conversation_id:", conversationId);
      } else {
        // Use deterministic conversation ID based on user_id
        // This matches get_user_default_conversation_id function
        conversationId = userId; // Simple fallback
        console.log("No existing conversation, using userId as conversation_id:", conversationId);
      }
    }

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
          started_at: new Date().toISOString(),
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
          conversation_id: conversationId,
          message: responseText,
          is_ai: true,
          task_id: task.id,
        });

        return new Response(JSON.stringify({ response: responseText, taskCreated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update task progress action
    if (action === "update_task_progress" && actionData) {
      const { taskId, progress, hoursLogged, updateText } = actionData;
      
      // Update task
      const { error: taskError } = await supabase
        .from("tasks")
        .update({ 
          progress, 
          status: progress === 100 ? "completed" : "ongoing" 
        })
        .eq("id", taskId);

      if (taskError) throw taskError;

      // Add task update
      if (updateText || hoursLogged) {
        const { error: updateError } = await supabase.from("task_updates").insert({
          task_id: taskId,
          user_id: userId,
          update_text: updateText || `Progress updated to ${progress}%`,
          progress,
          hours_logged: hoursLogged || null,
        });

        if (updateError) throw updateError;
      }

      const responseText = `✅ Task progress updated to ${progress}%${hoursLogged ? ` with ${hoursLogged} hours logged` : ""}`;
      await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        message: responseText,
        is_ai: true,
        task_id: taskId,
      });

      return new Response(JSON.stringify({ 
        response: responseText, 
        taskUpdated: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Accept task action
    if (action === "accept_task" && actionData) {
      const { taskId } = actionData;
      
      const { error } = await supabase
        .from("tasks")
        .update({ status: "accepted" })
        .eq("id", taskId)
        .eq("assigned_to", userId);

      if (error) throw error;

      const responseText = `✅ You've accepted the task! You can now start working on it.`;
      await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        message: responseText,
        is_ai: true,
        task_id: taskId,
      });

      return new Response(JSON.stringify({ 
        response: responseText, 
        taskAccepted: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject task action
    if (action === "reject_task" && actionData) {
      const { taskId, reason } = actionData;
      
      const { error } = await supabase
        .from("tasks")
        .update({ status: "rejected" })
        .eq("id", taskId)
        .eq("assigned_to", userId);

      if (error) throw error;

      const responseText = `Task rejected${reason ? `: ${reason}` : "."}`;
      await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        message: responseText,
        is_ai: true,
        task_id: taskId,
      });

      return new Response(JSON.stringify({ 
        response: responseText, 
        taskRejected: true 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get task status action
    if (action === "get_task_status" && actionData) {
      const { taskId } = actionData;
      
      const { data: task } = await supabase
        .from("tasks")
        .select(`
          *,
          assigned_profile:assigned_to(full_name),
          creator_profile:created_by(full_name),
          task_updates(
            id,
            update_text,
            progress,
            hours_logged,
            created_at,
            profiles:user_id(full_name)
          )
        `)
        .eq("id", taskId)
        .single();

      if (task) {
        const updates = task.task_updates || [];
        const totalHours = updates.reduce((sum: number, u: { hours_logged: number | null }) => 
          sum + (u.hours_logged || 0), 0);

        const assignedName = Array.isArray(task.assigned_profile) 
          ? task.assigned_profile[0]?.full_name 
          : task.assigned_profile?.full_name;

        const responseText = `📊 **Task Status:**

**${task.title}**

- Status: ${task.status}
- Progress: ${task.progress}%
- Priority: ${task.priority}
- Assigned to: ${assignedName || "Unassigned"}
- Deadline: ${task.deadline ? new Date(task.deadline).toLocaleDateString() : "No deadline"}
- Total Hours Logged: ${totalHours}h
- Updates: ${updates.length}

${updates.length > 0 ? `\n**Recent Updates:**\n${updates.slice(0, 3).map((u: { created_at: string; update_text: string; progress: number }) => 
  `- ${new Date(u.created_at).toLocaleDateString()}: ${u.update_text} (${u.progress}%)`
).join('\n')}` : ''}`;

        return new Response(JSON.stringify({ 
          response: responseText, 
          taskData: task 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ 
          response: "Task not found.",
          error: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // List my tasks action
    if (action === "list_my_tasks") {
      const { data: tasks } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          priority,
          progress,
          deadline
        `)
        .eq("assigned_to", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (tasks && tasks.length > 0) {
        const taskList = tasks.map((t: { title: string; status: string; progress: number; priority: string; deadline: string | null }, idx: number) => 
          `${idx + 1}. **${t.title}**
   - Status: ${t.status} | Progress: ${t.progress}% | Priority: ${t.priority}
   ${t.deadline ? `- Deadline: ${new Date(t.deadline).toLocaleDateString()}` : ""}`
        ).join('\n\n');

        const responseText = `📋 **Your Tasks (${tasks.length}):**

${taskList}`;

        return new Response(JSON.stringify({ 
          response: responseText,
          tasks
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ 
          response: "You don't have any assigned tasks yet.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get user role
    console.log("Fetching user role for userId:", userId);
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();
    console.log("User role:", userRole);

    // Get conversation history
    console.log("Fetching conversation history...");
    const { data: history } = await supabase
      .from("chat_messages")
      .select("message, is_ai")
      .eq("user_id", userId)
      .eq("conversation_id", conversationId || "00000000-0000-0000-0000-000000000000")
      .is("task_id", null)
      .order("created_at", { ascending: true })
      .limit(20);
    console.log("History messages count:", history?.length || 0);

    const messages = [
      {
        role: "system",
        content: userRole?.role === "employee" 
          ? `You are ChatFlow Support Agent, an AI support assistant.

User role: Employee

Your purpose is SUPPORT ONLY. You can help with:
- Questions about assigned tasks (view status, deadlines, requirements)
- How to update task progress
- How to accept or reject task invitations
- How to log hours worked
- General questions about using the task management system
- Technical support with the platform

You CANNOT and must NOT:
- Create or assign tasks (only admins can do this)
- Access other employees' information
- Make management decisions
- Provide information about company operations outside task management
- Discuss payment or compensation details

Your responses should:
- Be helpful and supportive
- Guide employees to use the correct features
- Redirect admin-level requests to their manager
- Stay focused on support and task-related queries

Be professional, concise, and encouraging.`
          : `You are ChatFlow Agent, an AI assistant for task management. 

User role: ${userRole?.role || "admin"}

Your capabilities:
- Help admins create and assign tasks using natural language
- Match employees to tasks based on skills, availability and performance
- Track task progress and provide updates
- Generate payment estimates based on hours and complexity

IMPORTANT RULES:
1. NEVER invent or suggest employee names - only use names from the actual database query results
2. If asked about employees or task assignment, acknowledge the request and wait for the system to fetch real employee data
3. Do not make up skills, departments, or qualifications
4. If no matching employees are found in the database, say so clearly

When admins request task creation:
1. Extract: title, description, required skills, priority, deadline, estimated hours
2. The system will search for suitable employees based on skill match
3. Present candidates ONLY from actual database results
4. Wait for admin approval before creating task

Be conversational, helpful, and professional. Stick to facts from the database.`,
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
    const isEmployeeTryingTaskCreation = !isAdmin && taskKeywords.some(k => message.toLowerCase().includes(k));
    const isTaskRequest = isAdmin && taskKeywords.some(k => message.toLowerCase().includes(k));

    console.log("Task request detection:", { isAdmin, isTaskRequest, isEmployeeTryingTaskCreation });

    let aiResponse = "";
    let metadata: any = {};

    // Block employees from creating tasks
    if (isEmployeeTryingTaskCreation) {
      console.log("=== EMPLOYEE TRIED TO CREATE TASK - BLOCKED ===");
      aiResponse = `I understand you're interested in task creation, but as an employee, you don't have permission to create or assign tasks. 

Only administrators can create and assign tasks. 

What I can help you with:
- View your assigned tasks
- Update progress on your tasks
- Accept or reject task invitations
- Log hours worked
- Answer questions about your tasks

Would you like to check your current tasks or need help with something else?`;

      await supabase.from("chat_messages").insert({
        user_id: userId,
        conversation_id: conversationId,
        message: aiResponse,
        is_ai: true,
      });

      return new Response(JSON.stringify({ response: aiResponse }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isTaskRequest) {
      console.log("=== TASK REQUEST DETECTED ===");
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

      console.log("Calling AI for task extraction...");
      const extractResult = await callAI(extractionMessages, { 
        lovable: LOVABLE_API_KEY, 
        openai: OPENAI_API_KEY 
      });
      console.log("AI extraction result provider:", extractResult.provider);

      const extractData = extractResult.data;
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
        console.log("Fetching employees with skills:", taskData.skills);
        
        // Fetch available employees
        const { data: employees, error: employeeError } = await supabase
          .from("employee_profiles")
          .select(`
            user_id,
            skills,
            department,
            designation,
            availability,
            current_workload,
            performance_score,
            hourly_rate,
            on_time_rate,
            quality_score,
            profiles!employee_profiles_user_id_fkey(full_name, email)
          `)
          .eq("availability", true);

        console.log("Employees fetched:", employees?.length || 0);
        if (employeeError) {
          console.error("Error fetching employees:", employeeError);
        }
        
        if (employees && employees.length > 0) {
          console.log("Employee names:", employees.map(e => {
            const profile = Array.isArray(e.profiles) ? e.profiles[0] : e.profiles;
            return profile?.full_name || "Unknown";
          }));
          // Calculate match scores
          const scoredEmployees = employees
            .map((emp) => ({
              ...emp,
              matchScore: calculateMatchScore(emp, taskData.skills),
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
   - ${emp.designation || "Employee"} • ${emp.department || "General"}
   - Matched Skills: ${skillMatches.join(", ") || "None"}
   - Workload: ${emp.current_workload || 0} active tasks
   - Performance: ${Math.round(emp.performance_score || 0)}%
   - Match Score: ${emp.matchScore}%
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
            conversation_id: conversationId,
            message: aiResponse,
            is_ai: true,
            metadata,
          });

          return new Response(JSON.stringify({ response: aiResponse, metadata }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else {
          // No employees found
          console.log("No available employees found matching criteria");
          aiResponse = `I couldn't find any available employees matching the required skills (${taskData.skills?.join(", ")}).

You might want to:
1. Adjust the required skills
2. Check if employees are marked as available
3. Add more employees to the system

Would you like me to help with something else?`;

          await supabase.from("chat_messages").insert({
            user_id: userId,
            conversation_id: conversationId,
            message: aiResponse,
            is_ai: true,
          });

          return new Response(JSON.stringify({ response: aiResponse }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Regular conversation
    console.log("=== REGULAR CONVERSATION ===");
    console.log("Calling AI with", messages.length, "messages...");
    
    const aiResult = await callAI(messages, { 
      lovable: LOVABLE_API_KEY, 
      openai: OPENAI_API_KEY 
    });
    console.log("AI response received from:", aiResult.provider);

    const aiData = aiResult.data;
    aiResponse = aiData.choices[0].message.content;
    console.log("AI response length:", aiResponse.length);

    console.log("Inserting AI message to database...");
    await supabase.from("chat_messages").insert({
      user_id: userId,
      conversation_id: conversationId,
      message: aiResponse,
      is_ai: true,
      task_id: taskId || null,
    });
    console.log("Message inserted successfully");

    console.log("=== RETURNING RESPONSE ===");
    return new Response(
      JSON.stringify({ response: aiResponse, metadata }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ ERROR in ai-chat function:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
