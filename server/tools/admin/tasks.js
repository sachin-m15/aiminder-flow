import * as z from "zod";
import { tool } from "langchain";
import { supabase } from "../../supabase.js";
import { findEmployee } from "../shared/helpers.js";

export const listTasks = tool(
  async ({ status, priority, assignedTo, overdue, limit = 20 } = {}) => {
    try {
      // Build query
      let query = supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      // Apply filters
      if (status) {
        query = query.eq("status", status);
      }

      if (priority) {
        query = query.eq("priority", priority);
      }

      if (assignedTo) {
        // Try to find employee first
        const empResult = await findEmployee(assignedTo);
        if (empResult.success && empResult.data) {
          query = query.eq("assigned_to", empResult.data.user_id);
        } else {
          throw new Error(
            "error" in empResult ? empResult.error : "Employee not found"
          );
        }
      }

      const { data: tasks, error } = await query;

      if (error) {
        throw new Error(
          `Database error while fetching tasks: ${error.message}`
        );
      }

      let filteredTasks = tasks || [];

      // Filter overdue tasks
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

      // Get assigned employee names
      const employeeIds = [
        ...new Set(filteredTasks.map((t) => t.assigned_to).filter(Boolean)),
      ];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", employeeIds);

      // Sort by priority and deadline
      filteredTasks.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // High priority first
        }

        // Then by deadline
        const aDeadline = a.deadline
          ? new Date(a.deadline).getTime()
          : Infinity;
        const bDeadline = b.deadline
          ? new Date(b.deadline).getTime()
          : Infinity;
        return aDeadline - bDeadline; // Earliest deadline first
      });

      // Format output for human readability
      if (filteredTasks.length === 0) {
        return "No tasks found for the given filters.";
      }

      const lines = filteredTasks.map((task) => {
        const assignee = profiles?.find((p) => p.id === task.assigned_to);
        const isOverdue =
          task.deadline &&
          new Date(task.deadline) < new Date() &&
          task.status !== "completed";

        return `• [${task.id.slice(0, 8)}] ${task.title} - Status: ${
          task.status
        } - Priority: ${task.priority} - Progress: ${
          task.progress
        }% - Assigned to: ${assignee?.full_name || "Unassigned"}${
          isOverdue ? " ⚠️ OVERDUE" : ""
        }`;
      });

      const summary = `Found ${filteredTasks.length} task(s) matching your criteria.`;

      return `${lines.join("\n")}\n\n${summary}`;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching tasks"
      );
    }
  },
  {
    name: "list_tasks",
    description:
      "Get a list of tasks with optional filters. Use this when the user asks 'show tasks', 'what are the active tasks', 'list overdue tasks', etc.",
    schema: z.object({
      status: z
        .string()
        .optional()
        .describe(
          "Filter by task status: pending, invited, accepted, ongoing, completed, rejected"
        ),
      priority: z
        .string()
        .optional()
        .describe("Filter by priority level: low, medium, high"),
      assignedTo: z
        .string()
        .optional()
        .describe("Filter by employee name or ID"),
      overdue: z
        .boolean()
        .optional()
        .describe("Show only overdue tasks (true/false)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .default(20)
        .describe("Maximum number of results (1-100)"),
    }),
    returnType: z
      .string()
      .describe("A formatted, human-readable list of tasks"),
  }
);
