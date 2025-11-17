import { supabase } from "../../supabase.js";

export const listMyTasksTool = {
  name: "list_my_tasks",
  description: "List tasks assigned to the authenticated employee",
  parameters: {
    type: "object",
    properties: {},
  },
  async execute() {
    const userId = this.session?.userId;
    if (!userId) {
      return { error: "User authentication context missing" };
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, status, deadline, progress_percentage")
      .eq("assigned_to", userId)
      .order("deadline", { ascending: true });

    if (error) throw new Error("Task fetch failed: " + error.message);

    return {
      title: "Your Assigned Tasks",
      tasks: data,
      total: data.length
    };
  },
};

export const viewTaskDetailsTool = {
  name: "view_task_details",
  description: "View detailed information for a specific task",
  parameters: {
    type: "object",
    properties: {
      taskId: {
        type: "string",
        description: "Task ID to view",
      },
    },
    required: ["taskId"],
  },
  async execute({ taskId }) {
    const userId = this.session?.userId;
    if (!userId) {
      return { error: "User authentication context missing" };
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (error) throw new Error("Task fetch failed: " + error.message);
    if (!task) return { error: "Task not found" };

    // Authorization check
    if (task.assigned_to !== userId) {
      return { error: "Not authorized to view this task" };
    }

    return {
      title: "Task Details",
      task,
    };
  },
};

export const updateTaskStatusTool = {
  name: "update_task_status",
  description: "Update the status of a task assigned to the authenticated employee",
  parameters: {
    type: "object",
    properties: {
      taskId: { type: "string" },
      status: {
        type: "string",
        enum: ["Pending", "In Progress", "Completed"],
      },
    },
    required: ["taskId", "status"],
  },
  async execute({ taskId, status }) {
    const userId = this.session?.userId;
    if (!userId) {
      return { error: "User authentication context missing" };
    }

    const { data: currentTask, error: fetchError } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .maybeSingle();

    if (fetchError) throw new Error("Could not verify task: " + fetchError.message);
    if (!currentTask) return { error: "Task not found" };
    if (currentTask.assigned_to !== userId) {
      return { error: "Not authorized to update this task" };
    }

    const { data: updatedTask, error } = await supabase
      .from("tasks")
      .update({ status })
      .eq("id", taskId)
      .select()
      .maybeSingle();

    if (error) throw new Error("Task update failed: " + error.message);

    return {
      message: "Task updated successfully",
      task: updatedTask,
    };
  },
};

// Export tools for employee role
export function createViewMyTasksTool(userId) {
  return listMyTasksTool;
}

export default {
  listMyTasksTool,
  viewTaskDetailsTool,
  updateTaskStatusTool,
};
