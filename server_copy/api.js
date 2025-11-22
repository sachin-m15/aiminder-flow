import express from "express";
import cors from "cors";
import { config } from "dotenv";

// Load environment variables from server/.env file
config({ path: "./server/.env" });

import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { createAgent } from "langchain";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { getToolsForRole } from "./tools/index.js"; // <-- Correctly imported
import { supabase } from "./supabase.js";
// import { listTasks } from "./tools/admin/tasks.js"; // <-- No longer needed

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin:
      process.env.VERCEL === "1"
        ? process.env.VERCEL_URL || "https://*.vercel.app"
        : process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Get user data from Supabase using the access token
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("Supabase auth error:", error);
      return res.status(401).json({ error: "Invalid token or user" });
    }

    // Get user role from database (not metadata)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle(); // Use maybeSingle to handle empty results

    let userRole = "employee"; // Default role

    if (roleError) {
      console.error("Role lookup error:", roleError);
      // Don't fail authentication, just use default role
    } else if (roleData) {
      userRole = roleData.role;
    } else {
      console.log("No role found for user, using default 'employee' role");
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: userRole,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

// Initialize AI models
const openai = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY, // <-- ✅ THIS IS THE FIX
  model: process.env.AI_MODEL,
  temperature: 0.7,
});

const googleAI = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  model: "gemini-flash-latest", // Using 1.5-flash for better tool use
  temperature: 0.7,
});

// Base system prompts
const systemPrompts = {
  admin: `You are an AI assistant for an admin user in a task management system. Help with administrative tasks, employee management, and system oversight.

CRITICAL INSTRUCTIONS FOR TOOL USAGE:
1. When you call a tool and receive results, you MUST format them in a human-readable, structured way
2. Use markdown formatting (tables, lists, bold text) to make the information clear
3. Summarize the key findings and provide actionable insights
4. NEVER return raw JSON or unformatted data to the user
5. Always conclude with a helpful summary or next steps

SPECIAL TASK CREATION WORKFLOW:
When a user asks you to create a task (e.g., "create a task for...", "new task...", "I need someone to...", "assign someone to..."), follow this exact workflow:

1. **Analyze the Task**: Use the analyze_and_plan_task tool with the user's task description to determine the task details and required skills.

2. **Present Task Analysis**: Show the detailed task description, title, and required skills with descriptions. Do NOT show employee suggestions yet.

3. **Ask for Task Creation Approval**: Ask the user if they want to create this task with the analyzed details.

4. **Wait for Task Creation Confirmation**: Only proceed after the user explicitly approves task creation.

5. **Create the Task**: If approved, use the create_task tool to create the task with the analyzed details.

6. **Find Suitable Employees**: After task creation, use the analyze_and_plan_task tool again or searchEmployeesBySkills to find suitable employees for the created task.

7. **Present Employee Suggestions**: Show the ranked list of suitable employees with their qualifications.

8. **Ask for Assignment Approval**: Ask the user if they want to assign the task to the suggested employee(s).

9. **Wait for Assignment Confirmation**: Only proceed with assignment after explicit approval.

10. **Assign the Task**: If approved, use the assign_task tool to assign the task to the selected employee.

SPECIAL TASK ASSIGNMENT WORKFLOW:
When a user asks about task assignment (e.g., "who should I assign this to?", "whom should this task be assigned to?", "who can do this task?", "find someone for this task"), follow this workflow:

1. **Identify the Task**: If the user mentions a specific task, get its details using get_task_details. If no specific task is mentioned, ask for clarification about which task they want to assign.

2. **Describe the Task**: Present the task title, description, and current status.

3. **Analyze Requirements**: Use the analyze_and_plan_task tool with the task description to determine required skills and find suitable employees. Always provide at least one employee suggestion - even if they don't have perfect skill matches.

4. **Present Suggestions**: Show the ranked list of suitable employees with their current workload and recommendation reasons. Always include at least one employee.

5. **Ask for Assignment Approval**: Ask the user if they want to assign the task to the suggested employee(s).

6. **Wait for Confirmation**: Only proceed with assignment after explicit approval.

7. **Assign the Task**: If approved, use the assign_task tool to assign the task.

Example format for task assignment:
**📋 Task Details:**

**Task:** [Task Title]
**Description:** [Task Description]
**Status:** [Current Status]
**Required Skills:** [List of skills]

**👥 Suggested Employees:**
1. **Employee Name** (Department) - Current Workload: Y tasks
   - Skills: [matching skills]
   - Recommendation: [Excellent/Good/Related/Suitable match]

**❓ Assignment Approval:** Would you like me to assign this task to [top suggestion]? Please reply with "yes" to proceed.

Example format for task analysis (before creation):
**📝 Task Analysis:**

**Task Title:** [Generated title]
**Description:** [Detailed description]

**🔧 Required Skills:**
- **Skill 1**: Brief description of what this skill involves
- **Skill 2**: Brief description...

**❓ Task Creation Approval:** Would you like me to create this task? Please reply with "yes" to proceed or provide any modifications.

Example format for employee suggestions (after task creation):
**👥 Employee Suggestions for Task Assignment:**

**Task:** [Task Title]
**Required Skills:** [List of skills]

1. **Employee Name** (Department) - Current Workload: Y tasks
   - Skills: [matching skills]
   - Recommendation: [Excellent/Good/Related/Suitable match]

**❓ Assignment Approval:** Would you like me to assign this task to [top suggestion]? Please reply with "yes" to proceed.

Example format for task listings:
**📋 Task List Results:**

• **Build E-commerce Product Catalog** (🔥 High Priority) - Status: Ongoing (65% complete)
  - 👤 Assigned to: Sarah Johnson (sarah.johnson@aiminder.com)
  - ⏰ Deadline: October 27, 2025 (⚠️ OVERDUE)
  - 📅 Created: October 25, 2025

**Summary:** Found 3 tasks total, 1 overdue task requiring immediate attention.

Always provide context and recommendations based on the data.

IMPORTANT: When searching for employees or analyzing tasks, NEVER give error messages about "no employees found" or "no perfect matches". Always provide at least one employee suggestion, even if they have limited or no matching skills. Focus on finding the best available person rather than perfect matches.`,
  employee: `You are an AI assistant for an employee in a task management system. Help with task management, productivity, and work-related queries.

IMPORTANT: When you use tools and get results, you MUST:
1. Always format the tool results in a clear and structured manner
2. Summarize the key information for the user
3. Provide helpful context and next steps
4. Use markdown formatting for better readability
5. Never return raw JSON data directly to the user`,
};

// Agent registry for different roles
const agents = new Map();

function getAgent(role, userId) {
  // Create a unique key for the user's role and ID
  const agentKey = `${role}:${userId || "default"}`;

  if (!agents.has(agentKey)) {
    let finalSystemPrompt = systemPrompts[role] || systemPrompts.employee;

    // Inject user-specific context for employees
    if (role === "employee" && userId) {
      finalSystemPrompt = `You are an AI assistant for an employee.
You are acting on behalf of the employee with user_id: ${userId}.

IMPORTANT: The employee tools (list_my_tasks, update_my_task, add_progress_update) automatically use the authenticated user's ID.
You do NOT need to pass employeeId as a parameter - it's handled automatically by the system.

When a user says "my tasks", "my progress", etc., simply call the relevant tools without the employeeId parameter.
Example: If the user says "show my tasks", call the 'list_my_tasks' tool with only the optional filters (status, priority, etc.).

IMPORTANT: When you use tools and get results, you MUST:
1. Always format the tool results in a clear and structured manner
2. Summarize the key information for the user
3. Provide helpful context and next steps
4. Use markdown formatting for better readability
5. Never return raw JSON data directly to the user`;
    }

    // Get tools for the role and convert to array format
    const toolsObject = getToolsForRole(role);
    const toolsArray = Object.values(toolsObject); // <-- This is the fix

    // Create agent with proper tools
    const agent = createAgent({
      model: openai, // <-- This was already correct
      tools: toolsArray, // <-- Use the tools from getToolsForRole
      systemPrompt: finalSystemPrompt,
      maxSteps: 5,
    });

    agents.set(agentKey, agent);
  }
  return agents.get(agentKey);
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "API server is running" });
});

// Chat completion endpoint
app.post("/api/chat", authenticateToken, async (req, res) => {
  try {
    const { messages, role: requestedRole } = req.body;
    // Use the role from the request body, fallback to authenticated user's role
    const role = requestedRole || req.user.role;
    const userId = req.user.id; // <-- Get the user's ID

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    console.log("🤖 Server-side AI Agent - Processing request:", {
      role,
      userId, // <-- Log the user ID
      userEmail: req.user.email,
      userRole: req.user.role,
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
    });

    const agent = getAgent(role, userId); // <-- Pass role AND userId

    // Convert messages to LangChain format
    const langchainMessages = messages.map((msg) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      } else if (msg.role === "system") {
        return new SystemMessage(msg.content);
      }
      return new HumanMessage(msg.content);
    });

    // Add debug logging for tool calls
    const result = await agent.invoke(
      {
        messages: langchainMessages,
      },
      {
        configurable: {
          user: req.user, // ✅ pass user context in configurable
        },
        callbacks: [
          {
            handleAgentAction: (action) => {
              console.log("🤖 Agent Tool Call:", {
                tool: action.tool,
                args: action.toolInput,
              });
            },
            handleToolEnd: (output) => {
              console.log("🤖 Tool Result:", output);
            },
          },
        ],
      }
    );

    console.log("🤖 Server-side AI Agent - Response generated:", {
      contentLength: result.messages[result.messages.length - 1].content.length,
      content: result.messages[result.messages.length - 1].content,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      response: result.messages[result.messages.length - 1].content,
      usage: {}, // LangGraph doesn't provide usage info in the same format
    });
  } catch (error) {
    console.error("🤖 Server-side AI Agent - Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process chat message",
      message: error.message,
    });
  }
});

// Start server only if not in Vercel environment
if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`🚀 API server running on port ${port}`);
    console.log(
      `🔐 OpenAI API key configured: ${
        process.env.OPENAI_API_KEY ? "Yes" : "No"
      }`
    );
  });
}

export default app;
