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
import { getToolsForRole } from "./tools/index.js";
import { supabase } from "./supabase.js";
import { listTasks, getWeather } from "./tools/admin/tasks.js";

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL
        : "http://localhost:8080",
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
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.AI_MODEL || "zai-org/GLM-4.5-turbo",
  temperature: 0.7,
  configuration: {
    baseURL: "https://llm.chutes.ai/v1",
  },
});

const googleAI = new ChatGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.7,
});

// Agent registry for different roles
const agents = new Map();

function getAgent(role) {
  if (!agents.has(role)) {
    // System prompts
    const systemPrompts = {
      admin: `You are an AI assistant for an admin user in a task management system. Help with administrative tasks, employee management, and system oversight.

CRITICAL INSTRUCTIONS FOR TOOL USAGE:
1. When you call a tool and receive results, you MUST format them in a human-readable, structured way
2. Use markdown formatting (tables, lists, bold text) to make the information clear
3. Summarize the key findings and provide actionable insights
4. NEVER return raw JSON or unformatted data to the user
5. Always conclude with a helpful summary or next steps

Example format for task listings:
**📋 Task List Results:**

• **Build E-commerce Product Catalog** (🔥 High Priority) - Status: Ongoing (65% complete)
  - 👤 Assigned to: Sarah Johnson (sarah.johnson@aiminder.com)
  - ⏰ Deadline: October 27, 2025 (⚠️ OVERDUE)
  - 📅 Created: October 25, 2025

• **Create Design System Components** (⚖️ Medium Priority) - Status: Ongoing (45% complete)
  - 👤 Assigned to: Developer
  - ⏰ Deadline: November 4, 2025
  - 📅 Created: October 25, 2025

**Summary:** Found 3 tasks total, 1 overdue task requiring immediate attention.

Always provide context and recommendations based on the data.`,
      employee: `You are an AI assistant for an employee in a task management system. Help with task management, productivity, and work-related queries.

IMPORTANT: When you use tools and get results, you MUST:
1. Always format the tool results in a clear and structured manner
2. Summarize the key information for the user
3. Provide helpful context and next steps
4. Use markdown formatting for better readability
5. Never return raw JSON data directly to the user`,
    };

    // Get tools for the role and convert to array format
    const toolsObject = getToolsForRole(role);
    const toolsArray = Object.values(toolsObject);

    // Create agent with proper tools
    const agent = createAgent({
      model: googleAI,
      tools: [getWeather, listTasks],
      systemPrompt: systemPrompts[role] || systemPrompts.employee,
      maxSteps: 20,
    });

    agents.set(role, agent);
  }
  return agents.get(role);
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

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array is required" });
    }

    console.log("🤖 Server-side AI Agent - Processing request:", {
      role,
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
    });

    const agent = getAgent(role);

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

// Start server
app.listen(port, () => {
  console.log(`🚀 API server running on port ${port}`);
  console.log(
    `🔐 OpenAI API key configured: ${process.env.OPENAI_API_KEY ? "Yes" : "No"}`
  );
});

export default app;
