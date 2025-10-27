import { supabase } from '@/integrations/supabase/client';
import type { ToolResponse, ToolErrorResponse } from './types';

/**
 * Helper to create error responses
 */
export function createErrorResponse(
  error: string,
  details?: string,
  missingFields?: string[]
): ToolErrorResponse {
  return {
    success: false,
    error,
    details,
    missingFields,
  };
}

/**
 * Get employee skills from junction table
 */
export async function getEmployeeSkills(employeeProfileId: string): Promise<string[]> {
  const { data } = await supabase
    .from('employee_skills')
    .select('skill')
    .eq('employee_id', employeeProfileId);
  
  return data?.map(item => item.skill) || [];
}

/**
 * Get task required skills from junction table
 */
export async function getTaskRequiredSkills(taskId: string): Promise<string[]> {
  const { data } = await supabase
    .from('task_required_skills')
    .select('skill')
    .eq('task_id', taskId);
  
  return data?.map(item => item.skill) || [];
}

/**
 * Set employee skills (replaces all existing skills)
 */
export async function setEmployeeSkills(employeeProfileId: string, skills: string[]): Promise<ToolResponse<void>> {
  // Delete existing skills
  const { error: deleteError } = await supabase
    .from('employee_skills')
    .delete()
    .eq('employee_id', employeeProfileId);
  
  if (deleteError) {
    return createErrorResponse('Failed to update skills', deleteError.message);
  }
  
  // Insert new skills if any
  if (skills.length > 0) {
    const { error: insertError } = await supabase
      .from('employee_skills')
      .insert(skills.map(skill => ({
        employee_id: employeeProfileId,
        skill: skill.trim(),
      })));
    
    if (insertError) {
      return createErrorResponse('Failed to insert new skills', insertError.message);
    }
  }
  
  return {
    success: true,
    message: `Updated skills successfully`,
    data: undefined,
  };
}

/**
 * Set task required skills (replaces all existing skills)
 */
export async function setTaskRequiredSkills(taskId: string, skills: string[]): Promise<ToolResponse<void>> {
  // Delete existing skills
  const { error: deleteError } = await supabase
    .from('task_required_skills')
    .delete()
    .eq('task_id', taskId);
  
  if (deleteError) {
    return createErrorResponse('Failed to update required skills', deleteError.message);
  }
  
  // Insert new skills if any
  if (skills.length > 0) {
    const { error: insertError } = await supabase
      .from('task_required_skills')
      .insert(skills.map(skill => ({
        task_id: taskId,
        skill: skill.trim(),
      })));
    
    if (insertError) {
      return createErrorResponse('Failed to insert required skills', insertError.message);
    }
  }
  
  return {
    success: true,
    message: `Updated required skills successfully`,
    data: undefined,
  };
}

/**
 * Find an employee by name or ID - returns simple success/error response
 */
export async function findEmployee(identifier: string): Promise<ToolResponse<{
  user_id: string;
  employee_profile_id: string;
  full_name: string;
  email: string;
  department: string | null;
  designation: string | null;
  skills: string[];
  availability: boolean;
  current_workload: number;
  performance_score: number | null;
  hourly_rate: number | null;
  on_time_rate: number | null;
  quality_score: number | null;
  tasks_completed: number;
}>> {
  // Check if identifier is UUID
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  if (isUUID) {
    // Get by ID
    const { data: empProfile, error: empError } = await supabase
      .from('employee_profiles')
      .select('*')
      .eq('user_id', identifier)
      .single();
      
    if (empError || !empProfile) {
      return createErrorResponse(
        `No employee found with ID "${identifier}"`,
        empError?.message
      );
    }
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', empProfile.user_id)
      .single();
    
    if (profileError || !profile) {
      return createErrorResponse('Employee profile data incomplete');
    }
    
    // Get skills
    const skills = await getEmployeeSkills(empProfile.id);
    
    return {
      success: true,
      message: `Found employee: ${profile.full_name}`,
      data: {
        user_id: empProfile.user_id,
        employee_profile_id: empProfile.id,
        full_name: profile.full_name,
        email: profile.email,
        department: empProfile.department,
        designation: empProfile.designation,
        skills,
        availability: empProfile.availability,
        current_workload: empProfile.current_workload,
        performance_score: empProfile.performance_score,
        hourly_rate: empProfile.hourly_rate,
        on_time_rate: empProfile.on_time_rate,
        quality_score: empProfile.quality_score,
        tasks_completed: empProfile.tasks_completed,
      },
    };
  } else {
    // Search by name
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('full_name', `%${identifier}%`);
    
    if (error || !profiles || profiles.length === 0) {
      return createErrorResponse(
        `No employee found matching "${identifier}"`,
        undefined,
        ['Please check the employee name or ID']
      );
    }
    
    // Get employee profiles for found users
    const { data: empProfiles } = await supabase
      .from('employee_profiles')
      .select('*')
      .in('user_id', profiles.map(p => p.id));
    
    if (!empProfiles || empProfiles.length === 0) {
      return createErrorResponse('No employee profiles found for matching users');
    }
    
    if (empProfiles.length > 1) {
      const suggestions = empProfiles.map((emp, index) => {
        const profile = profiles.find(p => p.id === emp.user_id);
        return `${index + 1}. ${profile?.full_name} (${profile?.email}) - ${emp.department || 'No department'}`;
      }).join('\n');
      
      return createErrorResponse(
        `Multiple employees found. Please specify which one:`,
        suggestions
      );
    }
    
    const empProfile = empProfiles[0];
    const profile = profiles.find(p => p.id === empProfile.user_id)!;
    
    // Get skills
    const skills = await getEmployeeSkills(empProfile.id);
    
    return {
      success: true,
      message: `Found employee: ${profile.full_name}`,
      data: {
        user_id: empProfile.user_id,
        employee_profile_id: empProfile.id,
        full_name: profile.full_name,
        email: profile.email,
        department: empProfile.department,
        designation: empProfile.designation,
        skills,
        availability: empProfile.availability,
        current_workload: empProfile.current_workload,
        performance_score: empProfile.performance_score,
        hourly_rate: empProfile.hourly_rate,
        on_time_rate: empProfile.on_time_rate,
        quality_score: empProfile.quality_score,
        tasks_completed: empProfile.tasks_completed,
      },
    };
  }
}

/**
 * Find a task by title or ID
 */
export async function findTask(identifier: string): Promise<ToolResponse<{
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  deadline: string | null;
  progress: number;
  estimated_hours: number | null;
  complexity_multiplier: number;
  required_skills: string[];
}>> {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
  
  let query = supabase.from('tasks').select('*');

  if (isUUID) {
    query = query.eq('id', identifier);
  } else {
    query = query.ilike('title', `%${identifier}%`);
  }

  const { data, error } = await query;

  if (error) {
    return createErrorResponse('Database error while finding task', error.message);
  }

  if (!data || data.length === 0) {
    return createErrorResponse(
      `No task found matching "${identifier}"`,
      undefined,
      ['Please check the task title or ID']
    );
  }

  if (data.length > 1) {
    const suggestions = data.map((task, index) => 
      `${index + 1}. ${task.title} (${task.status}) - Priority: ${task.priority}`
    ).join('\n');
    
    return createErrorResponse(
      `Multiple tasks found. Please specify which one:`,
      suggestions
    );
  }

  const task = data[0];
  
  // Get required skills
  const required_skills = await getTaskRequiredSkills(task.id);
  
  return {
    success: true,
    message: `Found task: ${task.title}`,
    data: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      deadline: task.deadline,
      progress: task.progress,
      estimated_hours: task.estimated_hours,
      complexity_multiplier: task.complexity_multiplier,
      required_skills,
    },
  };
}

/**
 * Calculate AI-suggested payment based on task details
 */
export async function calculateAIPayment(
  taskId: string,
  hoursLogged?: number
): Promise<ToolResponse<{ suggestedAmount: number; calculation: string }>> {
  const { data: task, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error || !task) {
    return createErrorResponse('Task not found', 'Unable to calculate payment');
  }

  if (!task.assigned_to) {
    return createErrorResponse('Task has no assigned employee');
  }

  const { data: empProfile } = await supabase
    .from('employee_profiles')
    .select('hourly_rate')
    .eq('user_id', task.assigned_to)
    .single();

  const hourlyRate = empProfile?.hourly_rate || 0;
  const hours = hoursLogged || task.estimated_hours || 0;
  const complexityMultiplier = task.complexity_multiplier || 1.0;
  
  const baseAmount = hourlyRate * hours;
  const suggestedAmount = baseAmount * complexityMultiplier;

  const calculation = `Hourly Rate: $${hourlyRate}, Hours: ${hours}, Complexity: ${complexityMultiplier}x = $${suggestedAmount.toFixed(2)}`;

  return {
    success: true,
    message: 'Payment calculated successfully',
    data: {
      suggestedAmount: Math.round(suggestedAmount * 100) / 100,
      calculation,
    },
  };
}

/**
 * Check if user has permission for an operation
 */
export async function checkPermission(
  userId: string,
  requiredRole: 'admin' | 'employee'
): Promise<ToolResponse<{ hasPermission: boolean; userRole: string }>> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return createErrorResponse('Unable to verify user permissions', error?.message);
  }

  const userRole = data.role;
  const hasPermission = userRole === 'admin' || userRole === requiredRole;

  return {
    success: true,
    message: hasPermission ? 'Permission granted' : 'Permission denied',
    data: {
      hasPermission,
      userRole,
    },
  };
}
