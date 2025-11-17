// Shared helper functions for server-side tools
import { supabase } from '../../supabase.js';

/**
 * Get employee skills from the database
 */
export async function getEmployeeSkills(employeeProfileId) {
  try {
    const { data: skills, error } = await supabase
      .from('employee_skills')
      .select('skill_name')
      .eq('employee_profile_id', employeeProfileId);

    if (error) {
      console.error('Error fetching employee skills:', error);
      return [];
    }

    return skills.map(s => s.skill_name);
  } catch (error) {
    console.error('Error in getEmployeeSkills:', error);
    return [];
  }
}

/**
 * Set employee skills (replace existing)
 */
export async function setEmployeeSkills(employeeProfileId, skills) {
  try {
    // Delete existing skills
    const { error: deleteError } = await supabase
      .from('employee_skills')
      .delete()
      .eq('employee_profile_id', employeeProfileId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Insert new skills
    if (skills.length > 0) {
      const skillsToInsert = skills.map(skill => ({
        employee_profile_id: employeeProfileId,
        skill_name: skill.trim()
      }));

      const { error: insertError } = await supabase
        .from('employee_skills')
        .insert(skillsToInsert);

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Find employee by ID or name
 */
export async function findEmployee(identifier) {
  try {
    // Check if it's a UUID (employee ID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (uuidRegex.test(identifier)) {
      // Search by user ID
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('id', identifier)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Employee not found by ID' };
      }

      const { data: empProfile, error: empError } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('user_id', identifier)
        .single();

      if (empError || !empProfile) {
        return { success: false, error: 'Employee profile not found' };
      }

      const skills = await getEmployeeSkills(empProfile.id);

      return {
        success: true,
        data: {
          user_id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          department: empProfile.department,
          designation: empProfile.designation,
          availability: empProfile.availability,
          current_workload: empProfile.current_workload,
          performance_score: empProfile.performance_score,
          hourly_rate: empProfile.hourly_rate,
          on_time_rate: empProfile.on_time_rate,
          quality_score: empProfile.quality_score,
          tasks_completed: empProfile.tasks_completed,
          skills
        }
      };
    } else {
      // Search by name
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .ilike('full_name', `%${identifier}%`)
        .limit(5);

      if (profileError || !profiles || profiles.length === 0) {
        return { success: false, error: 'Employee not found by name' };
      }

      if (profiles.length > 1) {
        return {
          success: false,
          error: 'Multiple employees found. Please be more specific or use employee ID.',
          matches: profiles.map(p => ({ id: p.id, name: p.full_name, email: p.email }))
        };
      }

      const profile = profiles[0];
      const { data: empProfile, error: empError } = await supabase
        .from('employee_profiles')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      if (empError || !empProfile) {
        return { success: false, error: 'Employee profile not found' };
      }

      const skills = await getEmployeeSkills(empProfile.id);

      return {
        success: true,
        data: {
          user_id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          department: empProfile.department,
          designation: empProfile.designation,
          availability: empProfile.availability,
          current_workload: empProfile.current_workload,
          performance_score: empProfile.performance_score,
          hourly_rate: empProfile.hourly_rate,
          on_time_rate: empProfile.on_time_rate,
          quality_score: empProfile.quality_score,
          tasks_completed: empProfile.tasks_completed,
          skills
        }
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get required skills for a task
 */
export async function getTaskRequiredSkills(taskId) {
  try {
    const { data: skills, error } = await supabase
      .from('task_required_skills')
      .select('skill_name')
      .eq('task_id', taskId);

    if (error) {
      console.error('Error fetching task skills:', error);
      return [];
    }

    return skills.map(s => s.skill_name);
  } catch (error) {
    console.error('Error in getTaskRequiredSkills:', error);
    return [];
  }
}

/**
 * Set required skills for a task
 */
export async function setTaskRequiredSkills(taskId, skills) {
  try {
    // Delete existing skills
    const { error: deleteError } = await supabase
      .from('task_required_skills')
      .delete()
      .eq('task_id', taskId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Insert new skills
    if (skills.length > 0) {
      const skillsToInsert = skills.map(skill => ({
        task_id: taskId,
        skill_name: skill.trim()
      }));

      const { error: insertError } = await supabase
        .from('task_required_skills')
        .insert(skillsToInsert);

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create error response for tools
 */
export function createErrorResponse(message, details, additionalInfo = []) {
  return {
    success: false,
    message,
    details,
    additionalInfo
  };
}