// Server-side employee management tools
import { tool } from 'langchain'; // <-- CORRECTED IMPORT
import { z } from 'zod';
import { supabase } from '../../supabase.js';
import { 
  getEmployeeSkills, 
  setEmployeeSkills, 
  findEmployee,
  createErrorResponse 
} from '../shared/helpers.js';

/**
 * Tool: List all employees with optional filters
 */
export const listEmployees = tool(
  async ({ department, designation, availability, searchQuery, skills }) => {
    try {
      // Get all employee profiles first
      let query = supabase
        .from('employee_profiles')
        .select('*');

      // Apply filters
      if (department) {
        query = query.eq('department', department);
      }
      
      if (designation) {
        query = query.ilike('designation', `%${designation}%`);
      }
      
      if (availability !== undefined) {
        query = query.eq('availability', availability);
      }

      const { data: empProfiles, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch employees from database: ${error.message}`);
      }

      if (!empProfiles || empProfiles.length === 0) {
        return { employees: [], count: 0 };
      }

      // Get user profiles for all employees
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', empProfiles.map(ep => ep.user_id));

      if (!profiles) {
        throw new Error('Failed to fetch employee profile data');
      }

      // Filter by search query if provided
      let filteredProfiles = profiles;
      if (searchQuery) {
        filteredProfiles = profiles.filter(p =>
          p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Build employee list with skills
      const employeesWithSkills = await Promise.all(
        empProfiles
          .filter(ep => filteredProfiles.some(p => p.id === ep.user_id))
          .map(async (ep) => {
            const profile = profiles.find(p => p.id === ep.user_id);
            if (!profile) return null;
            
            const empSkills = await getEmployeeSkills(ep.id);
            
            return {
              user_id: ep.user_id,
              full_name: profile.full_name,
              email: profile.email,
              department: ep.department,
              designation: ep.designation,
              skills: empSkills,
              availability: ep.availability,
              current_workload: ep.current_workload,
              performance_score: ep.performance_score,
              hourly_rate: ep.hourly_rate,
              tasks_completed: ep.tasks_completed,
              on_time_rate: ep.on_time_rate,
              quality_score: ep.quality_score,
            };
          })
      );

      // Filter out null values and by skills if specified
      let employees = employeesWithSkills.filter(Boolean);
      if (skills && skills.length > 0) {
        employees = employees.filter(emp =>
          skills.every(skill =>
            emp.skills.some(empSkill =>
              empSkill.toLowerCase().includes(skill.toLowerCase())
            )
          )
        );
      }

      // Sort by availability (available first), then by performance
      employees.sort((a, b) => {
        if (a.availability !== b.availability) {
          return (b.availability ? 1 : 0) - (a.availability ? 1 : 0);
        }
        return (b.performance_score || 0) - (a.performance_score || 0);
      });

      return {
        employees,
        count: employees.length,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while fetching employees'
      );
    }
  },
  { // <-- Refactored to LangChain options object
    name: 'listEmployees',
    description: `Get a comprehensive list of all employees with optional filters. 
    Use this when the user asks to "show employees", "list staff", "who works here", etc.
    You can filter by department, designation, availability, or search by name/skills.`,
    
    schema: z.object({ // <-- 'inputSchema' changed to 'schema'
      department: z.string().optional().describe('Filter by department (e.g., "Engineering", "Design", "Marketing")'),
      designation: z.string().optional().describe('Filter by job title/designation (e.g., "Senior Developer", "Designer")'),
      availability: z.boolean().optional().describe('Filter by availability status - true for available, false for unavailable'),
      searchQuery: z.string().optional().describe('Search employees by name or email (case-insensitive partial match)'),
      skills: z.array(z.string()).optional().describe('Filter by required skills (employees must have ALL specified skills)'),
    }),
  }
);

/**
 * Tool: Get detailed information about a specific employee
 */
export const getEmployeeDetails = tool(
  async ({ employeeId, employeeName }) => {
    try {
      // Find the employee using helper
      const employeeResult = await findEmployee(employeeId || employeeName);
      
      if (!employeeResult.success || !employeeResult.data) {
        throw new Error(
          'error' in employeeResult ? employeeResult.error : 'Employee not found'
        );
      }

      const employee = employeeResult.data;

      // Get current tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, priority, progress, deadline')
        .eq('assigned_to', employee.user_id)
        .in('status', ['invited', 'accepted', 'ongoing']);

      // Get recent task updates
      const { data: recentUpdates } = await supabase
        .from('task_updates')
        .select('*')
        .eq('user_id', employee.user_id)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get payment summary
      const { data: payments } = await supabase
        .from('payments')
        .select('amount_manual, amount_ai_suggested, status')
        .eq('user_id', employee.user_id);

      const totalEarnings = payments?.reduce((sum, p) =>
        sum + (p.amount_manual || p.amount_ai_suggested || 0), 0
      ) || 0;

      const pendingPayments = payments?.filter(p => p.status === 'pending').length || 0;

      return {
        employee: {
          id: employee.user_id,
          name: employee.full_name,
          email: employee.email,
          department: employee.department,
          designation: employee.designation,
          skills: employee.skills,
          availability: employee.availability,
          hourlyRate: employee.hourly_rate,
        },
        performance: {
          currentWorkload: employee.current_workload || 0,
          performanceScore: employee.performance_score || 0,
          onTimeRate: employee.on_time_rate || 0,
          qualityScore: employee.quality_score || 0,
        },
        currentTasks: tasks || [],
        recentActivity: recentUpdates || [],
        payments: {
          totalEarnings,
          pendingPayments,
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while fetching employee details'
      );
    }
  },
  { // <-- Refactored to LangChain options object
    name: 'getEmployeeDetails',
    description: `Get comprehensive details about a specific employee including their profile, current tasks, performance metrics, and payment history.
    Use this when the user asks for details about a specific employee, their workload, performance, etc.
    If you have the employee ID, use it. Otherwise, search by name.`,
    
    schema: z.object({ // <-- 'inputSchema' changed to 'schema'
      employeeId: z.string().uuid().optional().describe('The unique UUID of the employee'),
      employeeName: z.string().optional().describe('The name of the employee to search for (if ID not available)'),
    }).refine(data => data.employeeId || data.employeeName, {
      message: 'Either employeeId or employeeName must be provided',
    }),
  }
);

/**
 * Tool: Update employee profile information
 */
export const updateEmployee = tool(
  async ({ employeeId, updates }) => {
    try {
      // First, verify employee exists and get profile ID
      const { data: existing, error: fetchError } = await supabase
        .from('employee_profiles')
        .select('id, user_id')
        .eq('user_id', employeeId)
        .single();

      if (fetchError || !existing) {
        throw new Error(`Employee with ID "${employeeId}" not found. Please verify the employee ID`);
      }

      // Get employee name for response
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', employeeId)
        .single();

      // Build update object for employee_profiles table
      const updateData = {
        updated_at: new Date().toISOString(),
      };

      if (updates.department !== undefined) updateData.department = updates.department;
      if (updates.designation !== undefined) updateData.designation = updates.designation;
      if (updates.hourlyRate !== undefined) updateData.hourly_rate = updates.hourlyRate;
      if (updates.availability !== undefined) updateData.availability = updates.availability;

      // Perform update on employee_profiles table
      if (Object.keys(updateData).length > 1) { // More than just updated_at
        const { error: updateError } = await supabase
          .from('employee_profiles')
          .update(updateData)
          .eq('user_id', employeeId);

        if (updateError) {
          throw new Error(`Failed to update employee profile: ${updateError.message}`);
        }
      }

      // Update skills if provided (using junction table)
      if (updates.skills !== undefined) {
        const skillsResult = await setEmployeeSkills(existing.id, updates.skills);
        if (!skillsResult.success) {
          throw new Error(
            'error' in skillsResult ? skillsResult.error : 'Failed to update skills'
          );
        }
      }

      // Format success message
      const changedFields = Object.keys(updates).join(', ');
      
      return {
        employeeId,
        updatedFields: updates,
        message: `Successfully updated ${changedFields} for ${profile?.full_name || 'employee'}`,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while updating employee profile'
      );
    }
  },
  { // <-- Refactored to LangChain options object
    name: 'updateEmployee',
    description: `Update an employee's profile information such as department, designation, hourly rate, skills, or availability.
    IMPORTANT: Always confirm the changes with the user before updating.
    Ask for confirmation if making significant changes (e.g., changing hourly rate, department).`,
    
    schema: z.object({ // <-- 'inputSchema' changed to 'schema'
      employeeId: z.string().uuid().describe('The unique UUID of the employee to update'),
      updates: z.object({
        department: z.string().optional().describe('New department'),
        designation: z.string().optional().describe('New job title/designation'),
        hourlyRate: z.number().positive().optional().describe('New hourly rate in USD'),
        skills: z.array(z.string()).optional().describe('Updated list of skills (replaces existing)'),
        availability: z.boolean().optional().describe('Availability status'),
      }).refine(data => Object.keys(data).length > 0, {
        message: 'At least one field must be provided to update',
      }),
    }),
  }
);

/**
 * Tool: Get employee performance metrics
 */
export const getEmployeePerformance = tool(
  async ({ employeeId, timeRange = 'month' }) => {
    try {
      // Get employee basic info using helper
      const employeeResult = await findEmployee(employeeId);
      
      if (!employeeResult.success || !employeeResult.data) {
        throw new Error(
          'error' in employeeResult ? employeeResult.error : 'Employee not found'
        );
      }

      const employee = employeeResult.data;

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      
      switch (timeRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
          startDate = new Date(0); // Beginning of time
          break;
      }

      // Get tasks in time range
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', employeeId)
        .gte('created_at', startDate.toISOString());

      const completedTasks = tasks?.filter(t => t.status === 'completed') || [];
      const ongoingTasks = tasks?.filter(t => t.status === 'ongoing' || t.status === 'accepted') || [];
      
      // Calculate on-time completion
      const onTimeTasks = completedTasks.filter(t => {
        if (!t.deadline || !t.completed_at) return false;
        return new Date(t.completed_at) <= new Date(t.deadline);
      });

      const onTimeRate = completedTasks.length > 0
        ? (onTimeTasks.length / completedTasks.length) * 100
        : 0;

      // Get total hours logged
      const { data: updates } = await supabase
        .from('task_updates')
        .select('hours_logged')
        .eq('user_id', employeeId)
        .gte('created_at', startDate.toISOString());

      const totalHours = updates?.reduce((sum, u) => sum + (u.hours_logged || 0), 0) || 0;

      // Calculate average completion time
      const completionTimes = completedTasks
        .filter(t => t.accepted_at && t.completed_at)
        .map(t => {
          const start = new Date(t.accepted_at).getTime();
          const end = new Date(t.completed_at).getTime();
          return (end - start) / (1000 * 60 * 60 * 24); // days
        });

      const avgCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((sum, time) => sum + time, 0) / completionTimes.length
        : 0;

      return {
        employee: {
          id: employeeId,
          name: employee.full_name,
          email: employee.email,
        },
        timeRange,
        metrics: {
          tasksTotal: tasks?.length || 0,
          tasksCompleted: completedTasks.length,
          tasksOngoing: ongoingTasks.length,
          completionRate: tasks && tasks.length > 0
            ? (completedTasks.length / tasks.length) * 100
            : 0,
          onTimeRate,
          averageCompletionDays: Math.round(avgCompletionTime * 10) / 10,
          totalHoursLogged: Math.round(totalHours * 10) / 10,
          currentWorkload: employee.current_workload || 0,
          performanceScore: employee.performance_score || 0,
          qualityScore: employee.quality_score || 0,
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while calculating performance metrics'
      );
    }
  },
  { // <-- Refactored to LangChain options object
    name: 'getEmployeePerformance',
    description: `Get detailed performance metrics for an employee including completion rate, on-time delivery, quality scores, and workload analysis.
    Use this to evaluate employee performance, answer questions about productivity, or generate performance reports.`,
    
    schema: z.object({ // <-- 'inputSchema' changed to 'schema'
      employeeId: z.string().uuid().describe('The unique UUID of the employee'),
      timeRange: z.enum(['week', 'month', 'quarter', 'year', 'all']).optional().default('month').describe('Time period for metrics calculation'),
    }),
  }
);

/**
 * Tool: Delete an employee from the system
 */
export const deleteEmployee = tool(
  async ({ employeeId, employeeName, confirmed }) => {
    try {
      // Find the employee using helper
      const employeeResult = await findEmployee(employeeId || employeeName);

      if (!employeeResult.success || !employeeResult.data) {
        throw new Error(
          'error' in employeeResult ? employeeResult.error : 'Employee not found'
        );
      }

      const employee = employeeResult.data;

      // Check for active tasks (non-completed)
      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('id, title, status')
        .eq('assigned_to', employee.user_id)
        .in('status', ['invited', 'accepted', 'ongoing']);

      if (activeTasks && activeTasks.length > 0) {
        const taskList = activeTasks.map(t => `"${t.title}" (${t.status})`).join(', ');
        throw new Error(
          `Cannot delete employee "${employee.full_name}" because they have ${activeTasks.length} active task(s): ${taskList}. Please complete or reassign these tasks first.`
        );
      }

      // If not confirmed, ask for confirmation
      if (!confirmed) {
        return {
          success: false,
          error: 'Confirmation required',
          details: `Please confirm that you want to delete employee "${employee.full_name}" (ID: ${employee.user_id}). This action cannot be undone and will permanently remove all employee data including skills, task history, and payment records.`,
          missingFields: ['confirmation'],
        };
      }

      // Delete employee profile (skills will be automatically deleted via foreign key constraints)
      const { error: deleteError } = await supabase
        .from('employee_profiles')
        .delete()
        .eq('user_id', employee.user_id);

      if (deleteError) {
        throw new Error(`Failed to delete employee: ${deleteError.message}`);
      }

      return {
        success: true,
        message: `Employee "${employee.full_name}" has been permanently deleted`,
        data: {
          deletedEmployeeId: employee.user_id,
          employeeName: employee.full_name,
          deletedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while deleting the employee'
      );
    }
  },
  { // <-- Refactored to LangChain options object
    name: 'deleteEmployee',
    description: `Delete an employee from the system.
    This is a destructive operation that will permanently remove the employee and all associated data.
    IMPORTANT: Always ask for explicit confirmation first by asking "Are you sure you want to delete [employee name]? This action cannot be undone."
    When the user confirms, call this tool again with confirmed: true.
    The employee cannot be deleted if they have any active (non-completed) tasks.`,

    schema: z.object({ // <-- 'inputSchema' changed to 'schema'
      employeeId: z.string().uuid().optional().describe('The unique UUID of the employee to delete'),
      employeeName: z.string().optional().describe('The name of the employee to delete (if ID not available)'),
      confirmed: z.boolean().default(false).describe('Must be true to confirm deletion. Default is false - ask user for confirmation first before setting to true.'),
    }).refine(data => data.employeeId || data.employeeName, {
      message: 'Either employeeId or employeeName must be provided',
    }),
  }
);

/**
 * Tool: Search employees by required skills
 */
export const searchEmployeesBySkills = tool(
  async ({ requiredSkills, availability, limit = 10 }) => {
    try {
      // Get all employees (or only available ones)
      let query = supabase
        .from('employee_profiles')
        .select('*');

      if (availability !== undefined) {
        query = query.eq('availability', availability);
      }

      const { data: empProfiles, error } = await query;

      if (error) {
        throw new Error(`Database error while searching employees: ${error.message}`);
      }

      if (!empProfiles || empProfiles.length === 0) {
        throw new Error(
          availability
            ? 'No employees found. Try removing the availability filter'
            : 'No employees found'
        );
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

          // Count matching skills (case-insensitive)
          const matchingSkills = requiredSkills.filter(reqSkill =>
            empSkills.some(empSkill =>
              empSkill.toLowerCase().includes(reqSkill.toLowerCase()) ||
              reqSkill.toLowerCase().includes(empSkill.toLowerCase())
            )
          );

          const skillMatchCount = matchingSkills.length;
          const skillMatchPercentage = (skillMatchCount / requiredSkills.length) * 100;

          // Calculate overall score (skills * 50% + performance * 30% + workload * 20%)
          const performanceScore = (emp.performance_score || 0) * 20; // Max 100
          const workloadScore = Math.max(0, 100 - (emp.current_workload || 0) * 20); // Lower workload = higher score
          const skillScore = skillMatchPercentage * 0.5;

          const totalScore = (
            skillScore +
            performanceScore * 0.3 +
            workloadScore * 0.2
          );

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
            skillMatchPercentage: Math.round(skillMatchPercentage),
            overallScore: Math.round(totalScore),
          };
        })
      );

      // Filter out null values and sort by score
      const validEmployees = employeesWithScores.filter(emp => emp !== null);
      const sortedEmployees = validEmployees.sort((a, b) => b.overallScore - a.overallScore);

      // Always return at least one employee (the best match)
      const topEmployees = sortedEmployees.slice(0, Math.max(limit, sortedEmployees.length > 0 ? 1 : 0));

      return {
        searchedSkills: requiredSkills,
        matches: topEmployees.map(emp => ({
          ...emp,
          recommendation: emp.skillMatchCount > 0 && emp.skillMatchPercentage >= 80 ? 'Excellent match' :
                        emp.skillMatchCount > 0 && emp.skillMatchPercentage >= 50 ? 'Good match' :
                        emp.skillMatchCount > 0 ? 'Related skills match' :
                        emp.overallScore >= 60 ? 'Suitable candidate' :
                        emp.overallScore >= 40 ? 'Potential candidate' : 'Available employee',
        })),
        count: topEmployees.length,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while searching for employees'
      );
    }
  },
  { // <-- Refactored to LangChain options object
    name: 'searchEmployeesBySkills',
    description: `Find employees who have specific skills. Perfect for task assignment - helps find the right person for a job.
    Returns employees sorted by best match (skills, availability, and workload).
    Use this when assigning tasks or looking for someone with specific expertise.`,

    schema: z.object({ // <-- 'inputSchema' changed to 'schema'
      requiredSkills: z.array(z.string()).min(1).describe('List of required skills to search for'),
      availability: z.boolean().optional().describe('Filter by availability - true to show only available employees'),
      limit: z.number().int().positive().optional().default(10).describe('Maximum number of results to return'),
    }),
  }
);