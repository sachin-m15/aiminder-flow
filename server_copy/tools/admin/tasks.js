import * as z from "zod";
import { tool } from "langchain";
import { supabase } from "../../supabase.js";
import {
  findEmployee,
  getTaskRequiredSkills,
  setTaskRequiredSkills,
} from "../shared/helpers.js";

const VALID_PRIORITIES = ["low", "medium", "high"];
const VALID_STATUSES = [
  "pending",
  "invited",
  "accepted",
  "ongoing",
  "completed",
  "rejected",
];

/**
 * Helper: Validate a deadline string (YYYY-MM-DD or ISO) is in the future
 */
function isFutureDate(dateStr) {
  if (!dateStr) return true; // no deadline is OK
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  // Treat same-day as allowed if time part isn't provided; require strictly future if time provided.
  const now = new Date();
  return d.getTime() > now.getTime();
}

/**
 * Tool: List tasks with filters
 * NOTE: This tool intentionally returns a human readable string (you chose option B).
 */
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
        ...new Set(
          filteredTasks.map((t) => t.assigned_to).filter((id) => !!id)
        ),
      ];

      let profiles = [];
      if (employeeIds.length > 0) {
        const { data: fetchedProfiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", employeeIds);

        if (profilesError) {
          // fallback: continue with empty profiles but warn in message
          profiles = [];
        } else {
          profiles = fetchedProfiles || [];
        }
      }

      // Sort by priority and deadline
      filteredTasks.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // High priority first
        }

        // Then by deadline (earliest first)
        const aDeadline = a.deadline
          ? new Date(a.deadline).getTime()
          : Infinity;
        const bDeadline = b.deadline
          ? new Date(b.deadline).getTime()
          : Infinity;
        return aDeadline - bDeadline;
      });

      // Format output for human readability
      if (filteredTasks.length === 0) {
        return "No tasks found for the given filters.";
      }

      const lines = filteredTasks.map((task) => {
        const assignee = profiles.find((p) => p.id === task.assigned_to);
        const isOverdue =
          task.deadline &&
          new Date(task.deadline) < new Date() &&
          task.status !== "completed";

        // Protect against missing fields
        const idShort = task.id ? task.id.slice(0, 8) : "unknown";
        const title = task.title || "Untitled";
        const statusText = task.status || "unknown";
        const priorityText = task.priority || "unknown";
        const progressText =
          typeof task.progress === "number" ? task.progress : 0;

        return `• [${idShort}] ${title} - Status: ${statusText} - Priority: ${priorityText} - Progress: ${progressText}% - Assigned to: ${
          assignee?.full_name || "Unassigned"
        }${isOverdue ? " ⚠️ OVERDUE" : ""}`;
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
        .describe("Filter by employee name, email, or ID"),
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

/**
 * Tool: Analyze task requirements and suggest employees
 */
export const analyzeAndPlanTask = tool(
  async ({ taskDescription }) => {
    try {
      if (!taskDescription || taskDescription.trim().length === 0) {
        throw new Error("Task description is required for analysis.");
      }

      // Analyze the task and determine required skills
      const analysis = analyzeTaskRequirements(taskDescription);

      // Search for employees with the required skills
      // Get all employee profiles
      let query = supabase
        .from('employee_profiles')
        .select('*');

      query = query.eq('availability', true); // Only available employees

      const { data: empProfiles, error } = await query;

      if (error) {
        throw new Error(`Database error while searching employees: ${error.message}`);
      }

      if (!empProfiles || empProfiles.length === 0) {
        throw new Error('No available employees found');
      }

      // Get profiles and skills for all employees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', empProfiles.map(ep => ep.user_id));

      if (!profiles) {
        throw new Error('Failed to fetch employee profiles');
      }

      // Build employees with skills and calculate match scores
      const employeesWithScores = await Promise.all(
        empProfiles.map(async (emp) => {
          const profile = profiles.find(p => p.id === emp.user_id);
          if (!profile) return null;

          const empSkills = await getEmployeeSkills(emp.id);

          // Count exact/partial matching skills (case-insensitive)
          const exactMatchingSkills = analysis.requiredSkills.filter(reqSkill =>
            empSkills.some(empSkill =>
              empSkill.toLowerCase().includes(reqSkill.toLowerCase()) ||
              reqSkill.toLowerCase().includes(empSkill.toLowerCase())
            )
          );

          // Count somewhat related skills (broader matching)
          const relatedSkills = analysis.requiredSkills.filter(reqSkill => {
            const reqLower = reqSkill.toLowerCase();
            return empSkills.some(empSkill => {
              const empLower = empSkill.toLowerCase();
              // Check for related terms (e.g., "web" relates to "frontend", "backend", etc.)
              return empLower.includes('web') && (reqLower.includes('frontend') || reqLower.includes('backend') || reqLower.includes('ui') || reqLower.includes('ux')) ||
                     empLower.includes('design') && (reqLower.includes('ui') || reqLower.includes('ux') || reqLower.includes('graphic')) ||
                     empLower.includes('data') && reqLower.includes('analytics') ||
                     empLower.includes('mobile') && (reqLower.includes('app') || reqLower.includes('ios') || reqLower.includes('android'));
            });
          });

          const skillMatchCount = exactMatchingSkills.length;
          const relatedSkillCount = relatedSkills.length;
          const skillMatchPercentage = analysis.requiredSkills.length > 0
            ? (skillMatchCount / analysis.requiredSkills.length) * 100
            : 0;

          // Calculate overall score (skills * 40% + related skills * 20% + performance * 25% + workload * 15%)
          const performanceScore = (emp.performance_score || 0) * 25; // Max 100
          const workloadScore = Math.max(0, 100 - (emp.current_workload || 0) * 15); // Lower workload = higher score
          const skillScore = skillMatchPercentage * 0.4;
          const relatedSkillScore = (relatedSkillCount / analysis.requiredSkills.length) * 100 * 0.2;

          const totalScore = skillScore + relatedSkillScore + performanceScore + workloadScore;

          return {
            id: emp.user_id,
            name: profile.full_name,
            email: profile.email,
            department: emp.department,
            designation: emp.designation,
            skills: empSkills,
            availability: emp.availability,
            currentWorkload: emp.current_workload || 0,
            performanceScore: emp.performance_score || 0,
            hourlyRate: emp.hourly_rate,
            skillMatchCount,
            relatedSkillCount,
            skillMatchPercentage: Math.round(skillMatchPercentage),
            overallScore: Math.round(totalScore),
            matchingSkills: exactMatchingSkills,
            relatedSkills,
            matchType: skillMatchCount > 0 ? 'exact' : relatedSkillCount > 0 ? 'related' : 'general'
          };
        })
      );

      // Filter out null values and sort by score
      const validEmployees = employeesWithScores.filter(emp => emp !== null);
      const sortedEmployees = validEmployees.sort((a, b) => b.overallScore - a.overallScore);

      // Always return at least one employee (the best match)
      const topEmployees = sortedEmployees.slice(0, Math.max(5, sortedEmployees.length > 0 ? 1 : 0));

      return {
        taskAnalysis: {
          title: analysis.title,
          description: analysis.description,
          requiredSkills: analysis.requiredSkills.map(skill => ({
            skill,
            description: getSkillDescription(skill)
          }))
        },
        suggestedEmployees: topEmployees.map(emp => ({
          ...emp,
          recommendation: emp.matchType === 'exact' && emp.skillMatchPercentage >= 80 ? 'Excellent match' :
                         emp.matchType === 'exact' && emp.skillMatchPercentage >= 50 ? 'Good match' :
                         emp.matchType === 'related' ? 'Related skills match' :
                         emp.overallScore >= 60 ? 'Suitable candidate' :
                         emp.overallScore >= 40 ? 'Potential candidate' : 'Available employee',
        })),
        searchCriteria: {
          skills: analysis.requiredSkills,
          availability: true
        }
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while analyzing task requirements"
      );
    }
  },
  {
    name: "analyze_and_plan_task",
    description:
      "Analyze a task description to determine requirements, skills needed, and suggest suitable employees. Use this when planning new tasks.",
    schema: z.object({
      taskDescription: z.string().describe("Description of the task to be analyzed"),
    }),
  }
);

/**
 * Helper function to analyze task requirements
 */
function analyzeTaskRequirements(description) {
  const desc = description.toLowerCase();

  // Simple rule-based analysis (could be enhanced with AI)
  let title = "New Task";
  let requiredSkills = [];
  let detailedDescription = description;

  // Extract potential title
  const sentences = description.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length > 0) {
    title = sentences[0].trim();
    if (title.length > 50) {
      title = title.substring(0, 47) + "...";
    }
  }

  // Determine skills based on keywords
  if (desc.includes('web') || desc.includes('website') || desc.includes('frontend') || desc.includes('ui') || desc.includes('ux')) {
    requiredSkills.push('Web Development', 'UI/UX Design');
  }
  if (desc.includes('backend') || desc.includes('server') || desc.includes('api') || desc.includes('database')) {
    requiredSkills.push('Backend Development', 'Database Management');
  }
  if (desc.includes('design') || desc.includes('graphic') || desc.includes('logo') || desc.includes('branding')) {
    requiredSkills.push('Graphic Design');
  }
  if (desc.includes('marketing') || desc.includes('social media') || desc.includes('campaign')) {
    requiredSkills.push('Digital Marketing');
  }
  if (desc.includes('data') || desc.includes('analytics') || desc.includes('report')) {
    requiredSkills.push('Data Analysis');
  }
  if (desc.includes('mobile') || desc.includes('app') || desc.includes('ios') || desc.includes('android')) {
    requiredSkills.push('Mobile Development');
  }
  if (desc.includes('project management') || desc.includes('coordinate') || desc.includes('manage')) {
    requiredSkills.push('Project Management');
  }
  if (desc.includes('writing') || desc.includes('content') || desc.includes('copy')) {
    requiredSkills.push('Content Writing');
  }

  // Default skills if none detected
  if (requiredSkills.length === 0) {
    requiredSkills = ['General Skills'];
  }

  return {
    title,
    description: detailedDescription,
    requiredSkills: [...new Set(requiredSkills)] // Remove duplicates
  };
}

/**
 * Helper function to get skill descriptions
 */
function getSkillDescription(skill) {
  const descriptions = {
    'Web Development': 'Building and maintaining websites using HTML, CSS, JavaScript, and web frameworks',
    'Backend Development': 'Server-side programming, APIs, and database integration',
    'UI/UX Design': 'Creating user interfaces and optimizing user experience',
    'Graphic Design': 'Visual design, branding, and creative assets creation',
    'Digital Marketing': 'Online marketing strategies, social media, and campaign management',
    'Data Analysis': 'Analyzing data, creating reports, and deriving insights',
    'Mobile Development': 'Developing mobile applications for iOS and Android',
    'Project Management': 'Planning, coordinating, and overseeing project execution',
    'Content Writing': 'Creating written content for websites, blogs, and marketing materials',
    'Database Management': 'Designing and maintaining database systems',
    'General Skills': 'Various skills applicable to general administrative and operational tasks'
  };

  return descriptions[skill] || 'Specialized skills for completing this type of task';
}

/**
 * Tool: Create a new task
 */
export const createTask = tool(
  async (
    { title, description, priority, deadline, requiredSkills },
    config
  ) => {
    // Get user context from configurable
    const user = config?.configurable?.user || {};

    try {
      if (!title || title.trim().length === 0) {
        throw new Error("Title is required to create a task.");
      }

      if (!user || !user.id) {
        throw new Error(
          "User authentication required to create a task. Please log in."
        );
      }

      if (!description || description.trim().length === 0) {
        throw new Error("Description is required to create a task.");
      }

      if (priority && !VALID_PRIORITIES.includes(priority)) {
        throw new Error(
          `Invalid priority "${priority}". Allowed: ${VALID_PRIORITIES.join(
            ", "
          )}.`
        );
      }

      if (deadline && !isFutureDate(deadline)) {
        throw new Error(
          `Invalid deadline "${deadline}". Deadline must be a valid future date/time.`
        );
      }

      const userId = user.id;

      // Insert new task
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title,
          description,
          priority: priority || "medium",
          status: "pending",
          deadline: deadline ? new Date(deadline).toISOString() : null,
          created_by: userId,
        })
        .select()
        .single();

      if (taskError) {
        throw new Error(`Database error creating task: ${taskError.message}`);
      }

      if (requiredSkills && requiredSkills.length > 0) {
        const skillsResult = await setTaskRequiredSkills(
          task.id,
          requiredSkills
        );
        if (!skillsResult.success) {
          throw new Error(
            "Failed to set required skills: " +
              ("error" in skillsResult ? skillsResult.error : "unknown")
          );
        }
      }

      return {
        success: true,
        message: `✅ Task "${task.title}" created successfully by ${
          user.email || "an admin"
        }.`,
        task,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while creating task"
      );
    }
  },
  {
    name: "create_task",
    description:
      "Create a new task or project. Use this for 'new task', 'create project', etc.",
    schema: z.object({
      title: z.string().describe("The main title of the task"),
      description: z
        .string()
        .optional()
        .describe("A detailed description of the task"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .default("medium")
        .describe("Task priority"),
      deadline: z
        .string()
        .optional()
        .describe("The due date in YYYY-MM-DD format"),
      requiredSkills: z
        .array(z.string())
        .optional()
        .describe("A list of skills needed for this task"),
    }),
  }
);

/**
 * Tool: Get details for a single task
 */
export const getTaskDetails = tool(
  async ({ taskId }) => {
    try {
      if (!taskId) throw new Error("taskId is required");

      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();

      if (error || !task) {
        throw new Error("Task not found");
      }

      // Get assignee details
      let assignee = null;
      if (task.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", task.assigned_to)
          .single();
        assignee = profile || null;
      }

      // Get required skills
      const skills = await getTaskRequiredSkills(taskId);

      // Get recent updates
      const { data: updates } = await supabase
        .from("task_updates")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(5);

      const safeUpdates = updates || [];

      return {
        ...task,
        assignee,
        requiredSkills: skills,
        recentUpdates: safeUpdates,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while fetching task details"
      );
    }
  },
  {
    name: "get_task_details",
    description: "Get comprehensive details for a single task by its ID.",
    schema: z.object({
      taskId: z.string().uuid().describe("The unique ID of the task to fetch"),
    }),
  }
);

/**
 *  Tool: Update an existing task
 */
export const updateTask = tool(
  async ({ taskId, updates }) => {
    try {
      if (!taskId) throw new Error("taskId is required");
      if (!updates || Object.keys(updates).length === 0)
        throw new Error("At least one field must be provided to update");

      // Verify task exists
      const { data: existing, error: fetchError } = await supabase
        .from("tasks")
        .select("id, status, assigned_to")
        .eq("id", taskId)
        .single();

      if (fetchError || !existing) {
        throw new Error(`Task with ID "${taskId}" not found.`);
      }

      // Validate deadline if provided (deadline must be future unless marking completed/rejected)
      if (updates.deadline) {
        if (!isFutureDate(updates.deadline)) {
          // If trying to set past deadline but status is completed/rejected, allow
          const newStatus = updates.status;
          if (!(newStatus === "completed" || newStatus === "rejected")) {
            throw new Error(
              "Invalid deadline: Deadline must be in the future for active tasks"
            );
          }
        }
      }

      // Validate priority if provided
      if (updates.priority && !VALID_PRIORITIES.includes(updates.priority)) {
        throw new Error(
          `Invalid priority "${
            updates.priority
          }". Allowed: ${VALID_PRIORITIES.join(", ")}`
        );
      }

      // Handle skill updates separately
      if (updates.requiredSkills !== undefined) {
        const skillsResult = await setTaskRequiredSkills(
          taskId,
          updates.requiredSkills
        );
        if (!skillsResult.success) {
          throw new Error(
            "Failed to update required skills: " +
              ("error" in skillsResult ? skillsResult.error : "unknown")
          );
        }
        // Remove from main update object so it doesn't get written to tasks table
        delete updates.requiredSkills;
      }

      // Build update payload
      const updatePayload = { updated_at: new Date().toISOString() };

      if (updates.title !== undefined) updatePayload.title = updates.title;
      if (updates.description !== undefined)
        updatePayload.description = updates.description;
      if (updates.deadline !== undefined)
        updatePayload.deadline = updates.deadline
          ? new Date(updates.deadline).toISOString()
          : null;
      if (updates.priority !== undefined)
        updatePayload.priority = updates.priority;
      if (updates.status !== undefined) {
        updatePayload.status = updates.status;
        if (updates.status === "completed") {
          updatePayload.completed_at = new Date().toISOString();
          updatePayload.progress = 100;
        }
      }
      if (updates.progress !== undefined)
        updatePayload.progress = updates.progress;
      if (updates.estimatedHours !== undefined)
        updatePayload.estimated_hours = updates.estimatedHours;

      // Perform the update if there is something to update
      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabase
          .from("tasks")
          .update(updatePayload)
          .eq("id", taskId);

        if (updateError) {
          throw new Error(`Failed to update task: ${updateError.message}`);
        }
      }

      // If task moved to completed now, update employee stats
      if (updates.status === "completed" && existing.assigned_to) {
        const { data: employee } = await supabase
          .from("employee_profiles")
          .select("current_workload, tasks_completed")
          .eq("user_id", existing.assigned_to)
          .single();

        if (employee) {
          await supabase
            .from("employee_profiles")
            .update({
              current_workload: Math.max(
                0,
                (employee.current_workload || 0) - 1
              ),
              tasks_completed: (employee.tasks_completed || 0) + 1,
            })
            .eq("user_id", existing.assigned_to);
        }
      }

      const changedFields = Object.keys(updates).join(", ");

      return {
        success: true,
        message: `Successfully updated ${changedFields} for task ${taskId}.`,
        updatedFields: updates,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while updating task"
      );
    }
  },
  {
    name: "update_task",
    description:
      "Update details of an existing task (e.g., status, priority, description, progress).",
    schema: z.object({
      taskId: z.string().uuid().describe("The unique ID of the task to update"),
      updates: z
        .object({
          title: z.string().optional(),
          description: z.string().optional(),
          deadline: z.string().optional().describe("New due date (ISO format)"),
          priority: z.enum(["low", "medium", "high"]).optional(),
          status: z
            .enum([
              "pending",
              "invited",
              "accepted",
              "ongoing",
              "completed",
              "rejected",
            ])
            .optional(),
          progress: z.number().int().min(0).max(100).optional(),
          estimatedHours: z.number().positive().optional(),
          requiredSkills: z
            .array(z.string())
            .optional()
            .describe(
              "A *complete* new list of skills (replaces all existing skills)"
            ),
        })
        .refine((data) => Object.keys(data).length > 0, {
          message: "At least one field must be provided to update",
        }),
    }),
  }
);

/**
 * Tool: Assign a task to an employee
 */
export const assignTask = tool(
  async ({ taskId, employeeIdentifier }) => {
    try {
      if (!taskId) throw new Error("taskId is required");
      if (!employeeIdentifier)
        throw new Error("employeeIdentifier is required");

      // 1. Find the employee
      const empResult = await findEmployee(employeeIdentifier);
      if (!empResult.success || !empResult.data) {
        throw new Error("Employee not found");
      }

      const employee = empResult.data;

      // 2. Update the task assignment
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          assigned_to: employee.user_id,
          status: "invited", // Set status to 'invited' upon assignment
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (updateError) {
        throw new Error(`Failed to assign task: ${updateError.message}`);
      }

      // Optionally update employee workload if you track it in employee_profiles
      try {
        const { data: empProfile } = await supabase
          .from("employee_profiles")
          .select("current_workload")
          .eq("user_id", employee.user_id)
          .single();

        const newWorkload = Math.max(
          0,
          (empProfile?.current_workload || 0) + 1
        );

        await supabase
          .from("employee_profiles")
          .update({ current_workload: newWorkload })
          .eq("user_id", employee.user_id);
      } catch (wErr) {
        // don't fail the whole operation if workload update fails
        console.warn("Workload update failed", wErr);
      }

      return {
        success: true,
        message: `Successfully assigned task [${taskId.slice(0, 8)}] to ${
          employee.full_name
        }.`,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while assigning task"
      );
    }
  },
  {
    name: "assign_task",
    description: "Assign a task to a specific employee using their name, email, or ID.",
    schema: z.object({
      taskId: z.string().uuid().describe("The unique ID of the task to assign"),
      employeeIdentifier: z
        .string()
        .describe("The name, email, or UUID of the employee to assign the task to"),
    }),
  }
);

/**
 * Tool: Delete a task
 */
export const deleteTask = tool(
  async ({ taskId, confirmed }) => {
    try {
      console.log("🗑️ Delete Task Called:", { taskId, confirmed });
      
      if (!taskId) throw new Error("taskId is required");
      
      // Require explicit confirmation for safety
      if (!confirmed) {
        throw new Error("Task deletion requires explicit confirmation. Please set confirmed=true to proceed.");
      }

      // Get task details first for logging
      const { data: task } = await supabase
        .from("tasks")
        .select("id, title, assigned_to, status")
        .eq("id", taskId)
        .single();

      if (!task) {
        throw new Error(`Task with ID "${taskId}" not found`);
      }

      // Note: Supabase RLS policies should handle cascading deletes (e.g., skills, updates)
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);

      if (error) {
        throw new Error(`Failed to delete task: ${error.message}`);
      }

      // Update employee workload if task was active
      // (try/catch so we don't fail deletion just because workload update failed)
      try {
        if (
          task?.assigned_to &&
          task?.status &&
          !["completed", "rejected"].includes(task.status)
        ) {
          const { data: employee } = await supabase
            .from("employee_profiles")
            .select("current_workload")
            .eq("user_id", task.assigned_to)
            .single();

          if (employee) {
            await supabase
              .from("employee_profiles")
              .update({
                current_workload: Math.max(
                  0,
                  (employee.current_workload || 0) - 1
                ),
              })
              .eq("user_id", task.assigned_to);
          }
        }
      } catch (e) {
        // ignore workload update error
        console.warn("Failed to update workload after delete:", e);
      }

      return {
        success: true,
        message: `Successfully deleted task "${task.title}" [${taskId.slice(0, 8)}].`,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while deleting task"
      );
    }
  },
  {
    name: "delete_task",
    description:
      "Permanently delete a task from the system. This action cannot be undone. Requires confirmation parameter.",
    schema: z.object({
      taskId: z.string().uuid().describe("The unique ID of the task to delete"),
      confirmed: z.boolean().describe("Must be true to confirm deletion. This is a destructive operation."),
    }),
  }
);
