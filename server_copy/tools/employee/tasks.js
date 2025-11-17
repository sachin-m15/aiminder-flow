import * as z from "zod";
import { tool } from "langchain";
import { supabase } from "../../supabase.js";

/**
 * Helper to verify task assignment
 */
async function verifyTaskAssignment(taskId, employeeId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, assigned_to')
    .eq('id', taskId)
    .eq('assigned_to', employeeId)
    .single();
    
  if (error || !data) {
    throw new Error("Task not found or you are not assigned to this task.");
  }
  return data;
}

/**
 * Tool: List tasks assigned to the current employee
 */
export const listMyTasks = tool(
  async ({ status, priority, overdue, limit = 20 }, config) => {
    // Get user context from configurable
    const user = config?.configurable?.user || {};
    
    if (!user || !user.id) {
      throw new Error("User authentication required to list tasks. Please log in.");
    }

    try {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id) // <-- Use authenticated user's ID
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq("status", status);
      }
      if (priority) {
        query = query.eq("priority", priority);
      }

      const { data: tasks, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      let filteredTasks = tasks || [];

      if (overdue) {
        const now = new Date();
        filteredTasks = filteredTasks.filter(
          (task) =>
            task.deadline &&
            new Date(task.deadline) < now &&
            task.status !== "completed" &&
            task.status !== "rejected"
        );
      }

      // Sort by priority and deadline
      filteredTasks.sort((a, b) => {
        // ... (sorting logic from listTasks)
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aDeadline - bDeadline;
      });

      if (filteredTasks.length === 0) {
        return "You have no tasks matching the given filters.";
      }

      const lines = filteredTasks.map((task) => {
        const isOverdue =
          task.deadline &&
          new Date(task.deadline) < new Date() &&
          task.status !== "completed";
        return `• [${task.id.slice(0, 8)}] ${task.title} - Status: ${
          task.status
        } - Priority: ${task.priority} - Progress: ${
          task.progress
        }%${isOverdue ? " ⚠️ OVERDUE" : ""}`;
      });

      return `Found ${filteredTasks.length} task(s):\n${lines.join("\n")}`;
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    }
  },
  {
    name: "list_my_tasks",
    description: "Get a list of tasks assigned to *me* (the current user).",
    schema: z.object({
      status: z.string().optional().describe("Filter by status: pending, invited, accepted, ongoing, completed, rejected"),
      priority: z.string().optional().describe("Filter by priority: low, medium, high"),
      overdue: z.boolean().optional().describe("Show only overdue tasks"),
      limit: z.number().int().optional().default(20),
    }),
  }
);

/**
 * Tool: Update my task status or progress
 */
export const updateMyTask = tool(
  async ({ taskId, updates }, config) => {
    // Get user context from configurable
    const user = config?.configurable?.user || {};
    
    if (!user || !user.id) {
      throw new Error("User authentication required to update tasks. Please log in.");
    }

    try {
      // Verify the user is assigned to this task
      await verifyTaskAssignment(taskId, user.id);

      // Add 'accepted_at' timestamp if status is changing to 'accepted'
      if (updates.status === 'accepted') {
        updates.accepted_at = new Date().toISOString();
      }

      // Add 'completed_at' timestamp if status is changing to 'completed'
      if (updates.status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.progress = 100; // Automatically set progress to 100
      }

      const { error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      if (error) {
        throw new Error(`Failed to update task: ${error.message}`);
      }

      return {
        success: true,
        message: `Successfully updated task [${taskId.slice(0, 8)}].`,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    }
  },
  {
    name: "update_my_task",
    description: "Update the status or progress of a task I am assigned to. Use this to accept, start, or complete a task.",
    schema: z.object({
      taskId: z.string().uuid().describe("The ID of the task to update."),
      updates: z.object({
        status: z.enum(['accepted', 'ongoing', 'completed', 'rejected']).optional().describe("Update the task status (e.g., 'accepted', 'ongoing')"),
        progress: z.number().int().min(0).max(100).optional().describe("Update the task progress percentage (0-100)"),
      }).refine(data => Object.keys(data).length > 0, {
        message: 'You must provide either a status or progress to update.',
      }),
    }),
  }
);

/**
 * Tool: Add a progress update or log hours
 */
export const addProgressUpdate = tool(
  async ({ taskId, message, hoursLogged }, config) => {
    // Get user context from configurable
    const user = config?.configurable?.user || {};
    
    if (!user || !user.id) {
      throw new Error("User authentication required to add progress updates. Please log in.");
    }

    try {
      // Verify the user is assigned to this task
      await verifyTaskAssignment(taskId, user.id);

      const { error } = await supabase
        .from('task_updates')
        .insert({
          task_id: taskId,
          user_id: user.id,
          message: message,
          hours_logged: hoursLogged,
        });

      if (error) {
        throw new Error(`Failed to add update: ${error.message}`);
      }

      return {
        success: true,
        message: `Successfully added update to task [${taskId.slice(0, 8)}].`,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : "An unexpected error occurred"
      );
    }
  },
  {
    name: "add_progress_update",
    description: "Add a progress update, note, or log hours for a task I am assigned to.",
    schema: z.object({
      taskId: z.string().uuid().describe("The ID of the task to update."),
      message: z.string().describe("The text content of the update (e.g., 'Finished the auth module.')"),
      hoursLogged: z.number().optional().describe("Optional number of hours to log for this update."),
    }),
  }
);