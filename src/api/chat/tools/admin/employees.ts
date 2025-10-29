import { tool } from 'ai';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { ToolResponse } from '../shared/types';
import { createErrorResponse, getEmployeeSkills, setEmployeeSkills, findEmployee } from '../shared/helpers';

/**
 * Tool: List all employees with optional filters
 */
export const listEmployees = tool({
  description: `Get a comprehensive list of all employees with optional filters. 
  Use this when the user asks to "show employees", "list staff", "who works here", etc.
  You can filter by department, designation, availability, or search by name/skills.`,
  
  inputSchema: z.object({
    department: z.string().optional().describe('Filter by department (e.g., "Engineering", "Design", "Marketing")'),
    designation: z.string().optional().describe('Filter by job title/designation (e.g., "Senior Developer", "Designer")'),
    availability: z.boolean().optional().describe('Filter by availability status - true for available, false for unavailable'),
    searchQuery: z.string().optional().describe('Search employees by name or email (case-insensitive partial match)'),
    skills: z.array(z.string()).optional().describe('Filter by required skills (employees must have ALL specified skills)'),
  }),
  
  execute: async ({ department, designation, availability, searchQuery, skills }) => {
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
            const profile = profiles.find(p => p.id === ep.user_id)!;
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

      // Filter by skills if specified (requires all skills)
      let employees = employeesWithSkills;
      if (skills && skills.length > 0) {
        employees = employeesWithSkills.filter(emp =>
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
});

/**
 * Tool: Get detailed information about a specific employee
 */
export const getEmployeeDetails = tool({
  description: `Get comprehensive details about a specific employee including their profile, current tasks, performance metrics, and payment history.
  Use this when the user asks for details about a specific employee, their workload, performance, etc.
  If you have the employee ID, use it. Otherwise, search by name.`,
  
  inputSchema: z.object({
    employeeId: z.string().uuid().optional().describe('The unique UUID of the employee'),
    employeeName: z.string().optional().describe('The name of the employee to search for (if ID not available)'),
  }).refine(data => data.employeeId || data.employeeName, {
    message: 'Either employeeId or employeeName must be provided',
  }),
  
  execute: async ({ employeeId, employeeName }) => {
    try {
      // Find the employee using helper
      const employeeResult = await findEmployee(employeeId || employeeName!);
      
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
});

/**
 * Tool: Update employee profile information
 */
export const updateEmployee = tool({
  description: `Update an employee's profile information such as department, designation, hourly rate, skills, or availability.
  IMPORTANT: Always confirm the changes with the user before updating.
  Ask for confirmation if making significant changes (e.g., changing hourly rate, department).`,
  
  inputSchema: z.object({
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
  
  execute: async ({ employeeId, updates }) => {
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
      const updateData: Record<string, unknown> = {
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
});

/**
 * Tool: Get employee performance metrics
 */
export const getEmployeePerformance = tool({
  description: `Get detailed performance metrics for an employee including completion rate, on-time delivery, quality scores, and workload analysis.
  Use this to evaluate employee performance, answer questions about productivity, or generate performance reports.`,
  
  inputSchema: z.object({
    employeeId: z.string().uuid().describe('The unique UUID of the employee'),
    timeRange: z.enum(['week', 'month', 'quarter', 'year', 'all']).optional().default('month').describe('Time period for metrics calculation'),
  }),
  
  execute: async ({ employeeId, timeRange = 'month' }) => {
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
          const start = new Date(t.accepted_at!).getTime();
          const end = new Date(t.completed_at!).getTime();
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
});

/**
 * Tool: Search employees by required skills
 */
export const searchEmployeesBySkills = tool({
  description: `Find employees who have specific skills. Perfect for task assignment - helps find the right person for a job.
  Returns employees sorted by best match (skills, availability, and workload).
  Use this when assigning tasks or looking for someone with specific expertise.`,
  
  inputSchema: z.object({
    requiredSkills: z.array(z.string()).min(1).describe('List of required skills to search for'),
    availability: z.boolean().optional().describe('Filter by availability - true to show only available employees'),
    limit: z.number().int().positive().optional().default(10).describe('Maximum number of results to return'),
  }),
  
  execute: async ({ requiredSkills, availability, limit = 10 }) => {
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
          const profile = profiles.find(p => p.id === emp.user_id)!;
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

      // Filter and sort
      const scoredEmployees = employeesWithScores
        .filter(emp => emp.skillMatchCount > 0) // Only include those with at least one matching skill
        .sort((a, b) => b.overallScore - a.overallScore) // Sort by score descending
        .slice(0, limit); // Limit results

      if (scoredEmployees.length === 0) {
        throw new Error(
          `No employees found with skills: ${requiredSkills.join(', ')}. Try searching for different or fewer skills`
        );
      }

      return {
        searchedSkills: requiredSkills,
        matches: scoredEmployees.map(emp => ({
          ...emp,
          recommendation: emp.overallScore >= 70 ? 'Excellent match' :
                        emp.overallScore >= 50 ? 'Good match' :
                        emp.overallScore >= 30 ? 'Fair match' : 'Partial match',
        })),
        count: scoredEmployees.length,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'An unexpected error occurred while searching for employees'
      );
    }
  },
});
