import { tool } from 'ai';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { ToolResponse } from '../shared/types';
import { createErrorResponse, findEmployee, getEmployeeSkills, getTaskRequiredSkills, setTaskRequiredSkills } from '../shared/helpers';

/**
 * Tool: Create a new task
 */
export const createTask = tool({
  description: `Create a new task for an employee. 
  IMPORTANT: If ANY required information is missing (title, description, assignee, deadline, priority), 
  ask the user for it before creating the task. Don't make assumptions.
  
  Example followup questions:
  - "What should the task title be?"
  - "Can you provide a description of what needs to be done?"
  - "Who should I assign this task to?"
  - "What's the deadline for this task?"
  - "What priority should this be (low, medium, high)?"`,
  
  inputSchema: z.object({
    title: z.string().min(3).describe('Task title (minimum 3 characters)'),
    description: z.string().min(10).describe('Detailed task description (minimum 10 characters)'),
    assignTo: z.string().describe('Employee name or ID to assign the task to'),
    deadline: z.string().describe('Deadline in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)'),
    priority: z.enum(['low', 'medium', 'high']).describe('Task priority level'),
    estimatedHours: z.number().positive().optional().describe('Estimated hours to complete (optional)'),
    skills: z.array(z.string()).optional().describe('Required skills for this task (optional)'),
  }),
  
  execute: async ({ title, description, assignTo, deadline, priority, estimatedHours, skills }) => {
    try {
      // Find the employee
      const employeeResult = await findEmployee(assignTo);
      
      if (!employeeResult.success || !employeeResult.data) {
        throw new Error(
          'error' in employeeResult ? employeeResult.error : 'Employee not found'
        );
      }

      const employee = employeeResult.data;

      // Validate deadline is in the future
      const deadlineDate = new Date(deadline);
      if (deadlineDate < new Date()) {
        throw new Error('Invalid deadline: The deadline must be in the future');
      }

      // Get the current user (admin) ID
      const { data: adminUser } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .limit(1)
        .single();

      if (!adminUser) {
        throw new Error('No admin user found for task creation');
      }

      // Create the task
      const { data: newTask, error: createError } = await supabase
        .from('tasks')
        .insert({
          title,
          description,
          assigned_to: employee.user_id,
          created_by: adminUser.user_id,
          deadline: deadlineDate.toISOString(),
          priority,
          estimated_hours: estimatedHours,
          status: 'invited',
          progress: 0,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create task in database: ${createError.message}`);
      }

      // Add required skills if provided
      if (skills && skills.length > 0) {
        const skillsResult = await setTaskRequiredSkills(newTask.id, skills);
        if (!skillsResult.success) {
          // Task created but skills failed - return with warning
          return {
            task: {
              id: newTask.id,
              title: newTask.title,
              status: newTask.status,
              assignedTo: employee.full_name,
            },
            warning: 'Skills could not be added',
          };
        }
      }

      // Update employee workload
      const newWorkload = (employee.current_workload || 0) + 1;
      await supabase
        .from('employee_profiles')
        .update({ current_workload: newWorkload })
        .eq('user_id', employee.user_id);

      return {
        task: {
          id: newTask.id,
          title: newTask.title,
          status: newTask.status,
          assignedTo: employee.full_name,
          deadline: newTask.deadline,
          priority: newTask.priority,
          requiredSkills: skills || [],
        },
        employee: {
          id: employee.user_id,
          name: employee.full_name,
          newWorkload,
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while creating the task'
      );
    }
  },
});

/**
 * Tool: Assign or reassign a task to an employee
 */
export const assignTask = tool({
  description: `Assign or reassign a task to an employee. 
  Can suggest best employees based on skills, workload, and availability.
  Use this when the user wants to assign/reassign a task or ask "who should do this task?".`,
  
  inputSchema: z.object({
    taskId: z.string().uuid().describe('The UUID of the task to assign'),
    assignTo: z.string().optional().describe('Employee name or ID. If not provided, will suggest best matches based on task requirements'),
    getSuggestions: z.boolean().optional().default(false).describe('Set to true to get AI suggestions for best employee matches'),
  }),
  
  execute: async ({ taskId, assignTo, getSuggestions }) => {
    try {
      // Get the task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*, assigned_to')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        throw new Error(`Task with ID "${taskId}" not found`);
      }

      // Get required skills for matching
      const requiredSkills = await getTaskRequiredSkills(taskId);

      // If requesting suggestions or no assignee provided
      if (getSuggestions || !assignTo) {
        const { data: empProfiles } = await supabase
          .from('employee_profiles')
          .select('*')
          .eq('availability', true);

        if (!empProfiles || empProfiles.length === 0) {
          throw new Error('No available employees found');
        }

        // Get profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', empProfiles.map(ep => ep.user_id));

        if (!profiles) {
          throw new Error('Failed to fetch employee profiles');
        }

        // Score employees based on skills match and workload
        const employeesWithScores = await Promise.all(
          empProfiles.map(async (emp) => {
            const profile = profiles.find(p => p.id === emp.user_id)!;
            const empSkills = await getEmployeeSkills(emp.id);

            // Calculate skill match
            const matchingSkills = requiredSkills.filter(reqSkill =>
              empSkills.some(empSkill =>
                empSkill.toLowerCase().includes(reqSkill.toLowerCase())
              )
            );
            
            const skillMatch = requiredSkills.length > 0
              ? (matchingSkills.length / requiredSkills.length) * 100
              : 50; // Neutral score if no skills specified

            // Calculate overall score
            const performanceScore = (emp.performance_score || 0) * 20;
            const workloadScore = Math.max(0, 100 - (emp.current_workload || 0) * 20);
            
            const totalScore = (
              skillMatch * 0.5 +
              performanceScore * 0.3 +
              workloadScore * 0.2
            );

            return {
              employee: emp,
              profile,
              empSkills,
              score: Math.round(totalScore),
              skillMatch: Math.round(skillMatch),
            };
          })
        );

        const topSuggestions = employeesWithScores
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (!assignTo) {
          // Return suggestions only
          return {
            task: {
              id: task.id,
              title: task.title,
              requiredSkills,
            },
            suggestions: topSuggestions.map(item => ({
              id: item.employee.user_id,
              name: item.profile.full_name,
              email: item.profile.email,
              department: item.employee.department,
              designation: item.employee.designation,
              skills: item.empSkills,
              currentWorkload: item.employee.current_workload || 0,
              performanceScore: item.employee.performance_score || 0,
              skillMatch: item.skillMatch,
              overallScore: item.score,
              recommendation: item.score >= 70 ? 'Excellent fit' :
                            item.score >= 50 ? 'Good fit' :
                            item.score >= 30 ? 'Fair fit' : 'Possible fit',
            })),
          };
        }
      }

      // Find the employee to assign to
      const employeeResult = await findEmployee(assignTo!);
      
      if (!employeeResult.success || !employeeResult.data) {
        throw new Error(
          'error' in employeeResult ? employeeResult.error : 'Employee not found'
        );
      }

      const newEmployee = employeeResult.data;
      const previousAssignee = task.assigned_to;

      // Update the task
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          assigned_to: newEmployee.user_id,
          status: 'invited', // Reset to invited when reassigning
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      if (updateError) {
        throw new Error(`Failed to assign task: ${updateError.message}`);
      }

      // Update workloads
      if (previousAssignee && previousAssignee !== newEmployee.user_id) {
        // Decrease previous assignee's workload
        const { data: prevEmp } = await supabase
          .from('employee_profiles')
          .select('current_workload')
          .eq('user_id', previousAssignee)
          .single();

        if (prevEmp) {
          await supabase
            .from('employee_profiles')
            .update({ current_workload: Math.max(0, (prevEmp.current_workload || 0) - 1) })
            .eq('user_id', previousAssignee);
        }
      }

      // Increase new assignee's workload
      const newWorkload = (newEmployee.current_workload || 0) + 1;
      await supabase
        .from('employee_profiles')
        .update({ current_workload: newWorkload })
        .eq('user_id', newEmployee.user_id);

      return {
        task: {
          id: task.id,
          title: task.title,
          status: 'invited',
        },
        assignedTo: {
          id: newEmployee.user_id,
          name: newEmployee.full_name,
          newWorkload,
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while assigning the task'
      );
    }
  },
});

/**
 * Tool: Update task details
 */
export const updateTask = tool({
  description: `Update task information such as title, description, deadline, priority, or progress.
  Use this when the user wants to modify an existing task.
  IMPORTANT: For sensitive updates (e.g., changing deadline, priority), confirm with the user first.`,
  
  inputSchema: z.object({
    taskId: z.string().uuid().describe('The UUID of the task to update'),
    updates: z.object({
      title: z.string().min(3).optional().describe('New task title'),
      description: z.string().min(10).optional().describe('New task description'),
      deadline: z.string().optional().describe('New deadline (ISO format)'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('New priority level'),
      status: z.enum(['invited', 'accepted', 'ongoing', 'completed', 'rejected']).optional().describe('New task status'),
      progress: z.number().min(0).max(100).optional().describe('Task progress percentage (0-100)'),
      estimatedHours: z.number().positive().optional().describe('New estimated hours'),
      requiredSkills: z.array(z.string()).optional().describe('Updated list of required skills (replaces existing)'),
    }).refine(data => Object.keys(data).length > 0, {
      message: 'At least one field must be provided to update',
    }),
  }),
  
  execute: async ({ taskId, updates }): Promise<ToolResponse> => {
    try {
      // Verify task exists
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, status, assigned_to')
        .eq('id', taskId)
        .single();

      if (fetchError || !task) {
        return createErrorResponse(
          `Task with ID "${taskId}" not found`,
          'Please verify the task ID'
        );
      }

      // Validate deadline if provided
      if (updates.deadline) {
        const deadlineDate = new Date(updates.deadline);
        if (deadlineDate < new Date() && task.status !== 'completed' && task.status !== 'rejected') {
          return createErrorResponse(
            'Invalid deadline: Deadline must be in the future for active tasks',
            `Provided: ${updates.deadline}`
          );
        }
      }

      // Build update object
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.deadline !== undefined) updateData.deadline = new Date(updates.deadline).toISOString();
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.status !== undefined) {
        updateData.status = updates.status;
        if (updates.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
          updateData.progress = 100;
        }
      }
      if (updates.progress !== undefined) updateData.progress = updates.progress;
      if (updates.estimatedHours !== undefined) updateData.estimated_hours = updates.estimatedHours;

      // Perform update
      const { error: updateError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId);

      if (updateError) {
        return createErrorResponse(
          'Failed to update task',
          updateError.message
        );
      }

      // Update skills if provided
      if (updates.requiredSkills !== undefined) {
        const skillsResult = await setTaskRequiredSkills(taskId, updates.requiredSkills);
        if (!skillsResult.success) {
          return {
            success: true,
            message: `Task updated but failed to update required skills`,
            data: {
              taskId,
              warning: 'Skills update failed',
            },
          };
        }
      }

      // If task completed, update employee stats
      if (updates.status === 'completed' && task.status !== 'completed') {
        const { data: employee } = await supabase
          .from('employee_profiles')
          .select('current_workload, tasks_completed')
          .eq('user_id', task.assigned_to)
          .single();

        if (employee) {
          await supabase
            .from('employee_profiles')
            .update({
              current_workload: Math.max(0, (employee.current_workload || 0) - 1),
              tasks_completed: (employee.tasks_completed || 0) + 1,
            })
            .eq('user_id', task.assigned_to);
        }
      }

      const changedFields = Object.keys(updates).join(', ');
      
      return {
        success: true,
        message: `Successfully updated ${changedFields} for task "${task.title}"`,
        data: {
          taskId,
          updatedFields: updates,
        },
      };
    } catch (error) {
      return createErrorResponse(
        'An unexpected error occurred while updating the task',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  },
});

/**
 * Tool: Delete a task
 */
export const deleteTask = tool({
  description: `Delete a task from the system. 
  CRITICAL: This is a destructive operation. ALWAYS ask for explicit confirmation before deleting.
  Ask: "Are you sure you want to delete the task '[task title]'? This cannot be undone."`,
  
  inputSchema: z.object({
    taskId: z.string().uuid().describe('The UUID of the task to delete'),
    confirmed: z.boolean().default(false).describe('Must be true to confirm deletion. Always ask user for confirmation first.'),
  }),
  
  execute: async ({ taskId, confirmed }): Promise<ToolResponse> => {
    try {
      // Get task details first
      const { data: task, error: fetchError } = await supabase
        .from('tasks')
        .select('id, title, assigned_to, status')
        .eq('id', taskId)
        .single();

      if (fetchError || !task) {
        return createErrorResponse(
          `Task with ID "${taskId}" not found`,
          'Please verify the task ID'
        );
      }

      // Require confirmation
      if (!confirmed) {
        return createErrorResponse(
          `Deletion requires confirmation`,
          `Task "${task.title}" will be permanently deleted`,
          [
            'This action cannot be undone',
            'All task updates and attachments will also be deleted',
            'Please confirm if you want to proceed',
          ]
        );
      }

      // Delete task (cascades to task_updates and task_required_skills due to foreign key)
      const { error: deleteError } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (deleteError) {
        return createErrorResponse(
          'Failed to delete task',
          deleteError.message
        );
      }

      // Update employee workload if task was active
      if (task.assigned_to && task.status !== 'completed' && task.status !== 'rejected') {
        const { data: employee } = await supabase
          .from('employee_profiles')
          .select('current_workload')
          .eq('user_id', task.assigned_to)
          .single();

        if (employee) {
          await supabase
            .from('employee_profiles')
            .update({
              current_workload: Math.max(0, (employee.current_workload || 0) - 1),
            })
            .eq('user_id', task.assigned_to);
        }
      }

      return {
        success: true,
        message: `Task "${task.title}" has been permanently deleted`,
        data: {
          deletedTaskId: taskId,
          taskTitle: task.title,
        },
      };
    } catch (error) {
      return createErrorResponse(
        'An unexpected error occurred while deleting the task',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  },
});

/**
 * Tool: List tasks with filters
 */
export const listTasks = tool({
  description: `Get a list of tasks with optional filters.
  Use this when the user asks "show tasks", "what are the active tasks", "list overdue tasks", etc.`,
  
  inputSchema: z.object({
    status: z.enum(['pending', 'invited', 'accepted', 'ongoing', 'completed', 'rejected']).optional().describe('Filter by task status'),
    priority: z.enum(['low', 'medium', 'high']).optional().describe('Filter by priority level'),
    assignedTo: z.string().optional().describe('Filter by employee name or ID'),
    overdue: z.boolean().optional().describe('Show only overdue tasks'),
    limit: z.number().int().positive().optional().default(20).describe('Maximum number of results'),
  }),
  
  execute: async ({ status, priority, assignedTo, overdue, limit = 20 }) => {
    try {
      // Build query
      let query = supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (assignedTo) {
        // Try to find employee first
        const empResult = await findEmployee(assignedTo);
        if (empResult.success && empResult.data) {
          query = query.eq('assigned_to', empResult.data.user_id);
        } else {
          throw new Error(
            'error' in empResult ? empResult.error : 'Employee not found'
          );
        }
      }

      const { data: tasks, error } = await query;

      if (error) {
        throw new Error(`Database error while fetching tasks: ${error.message}`);
      }

      let filteredTasks = tasks || [];

      // Filter overdue tasks
      if (overdue) {
        const now = new Date();
        filteredTasks = filteredTasks.filter(task =>
          task.deadline &&
          new Date(task.deadline) < now &&
          task.status !== 'completed' &&
          task.status !== 'rejected'
        );
      }

      // Get assigned employee names
      const employeeIds = [...new Set(filteredTasks.map(t => t.assigned_to).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', employeeIds);

      // Sort by priority and deadline
      filteredTasks.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // High priority first
        }
        
        // Then by deadline
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aDeadline - bDeadline; // Earliest deadline first
      });

      return {
        tasks: filteredTasks.map(task => {
          const assignee = profiles?.find(p => p.id === task.assigned_to);
          return {
            id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            progress: task.progress,
            deadline: task.deadline,
            assignedTo: assignee?.full_name || 'Unassigned',
            assignedToEmail: assignee?.email,
            isOverdue: task.deadline && new Date(task.deadline) < new Date() && task.status !== 'completed',
            createdAt: task.created_at,
          };
        }),
        count: filteredTasks.length,
        filters: { status, priority, assignedTo, overdue },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while fetching tasks'
      );
    }
  },
});

/**
 * Tool: Get detailed task information
 */
export const getTaskDetails = tool({
  description: `Get comprehensive details about a specific task including description, assignee, progress updates, attachments, and history.
  Use this when the user asks for details about a specific task.`,
  
  inputSchema: z.object({
    taskId: z.string().uuid().describe('The UUID of the task'),
  }),
  
  execute: async ({ taskId }): Promise<ToolResponse> => {
    try {
      // Get task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        return createErrorResponse(
          `Task with ID "${taskId}" not found`,
          'Please verify the task ID'
        );
      }

      // Get assignee info
      let assignee = null;
      if (task.assigned_to) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, contact')
          .eq('id', task.assigned_to)
          .single();
        assignee = profile;
      }

      // Get required skills
      const requiredSkills = await getTaskRequiredSkills(taskId);

      // Get task updates
      const { data: updates } = await supabase
        .from('task_updates')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      // Get update authors
      const updateUserIds = [...new Set(updates?.map(u => u.user_id) || [])];
      const { data: updateProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', updateUserIds);

      // Calculate task statistics
      const totalHoursLogged = updates?.reduce((sum, u) => sum + (u.hours_logged || 0), 0) || 0;
      
      const isOverdue = task.deadline && 
        new Date(task.deadline) < new Date() && 
        task.status !== 'completed' &&
        task.status !== 'rejected';

      const daysUntilDeadline = task.deadline
        ? Math.ceil((new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        success: true,
        message: `Retrieved details for task "${task.title}"`,
        data: {
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            progress: task.progress,
            deadline: task.deadline,
            estimatedHours: task.estimated_hours,
            requiredSkills,
            createdAt: task.created_at,
            acceptedAt: task.accepted_at,
            completedAt: task.completed_at,
          },
          assignee: assignee ? {
            name: assignee.full_name,
            email: assignee.email,
            contact: assignee.contact,
          } : null,
          statistics: {
            totalHoursLogged,
            updateCount: updates?.length || 0,
            isOverdue,
            daysUntilDeadline,
            timeToAccept: task.accepted_at && task.created_at
              ? Math.ceil((new Date(task.accepted_at).getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))
              : null,
            timeToComplete: task.completed_at && task.accepted_at
              ? Math.ceil((new Date(task.completed_at).getTime() - new Date(task.accepted_at).getTime()) / (1000 * 60 * 60 * 24))
              : null,
          },
          updates: updates?.map(update => {
            const author = updateProfiles?.find(p => p.id === update.user_id);
            return {
              id: update.id,
              message: update.update_text,
              progress: update.progress,
              hoursLogged: update.hours_logged,
              createdAt: update.created_at,
              updatedBy: author?.full_name || 'Unknown',
            };
          }) || [],
        },
      };
    } catch (error) {
      return createErrorResponse(
        'An unexpected error occurred while fetching task details',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  },
});
