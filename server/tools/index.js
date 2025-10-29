// Server-side tools implementation
import { tool } from 'ai';
import { z } from 'zod';
import { supabase } from '../supabase.js';

// Import individual tool modules
import * as employeeTools from './admin/employees.js';
import * as taskTools from './admin/tasks.js';

/**
 * Get tools based on user role
 */
export function getToolsForRole(role) {
  if (role === 'admin') {
    return {
      // Employee Management Tools
      listEmployees: employeeTools.listEmployees,
      getEmployeeDetails: employeeTools.getEmployeeDetails,
      updateEmployee: employeeTools.updateEmployee,
      getEmployeePerformance: employeeTools.getEmployeePerformance,
      searchEmployeesBySkills: employeeTools.searchEmployeesBySkills,
      
      // Task Management Tools
      createTask: taskTools.createTask,
      assignTask: taskTools.assignTask,
      updateTask: taskTools.updateTask,
      deleteTask: taskTools.deleteTask,
      listTasks: taskTools.listTasks,
      getTaskDetails: taskTools.getTaskDetails,
    };
  }
  
  // Employee tools (to be implemented)
  return {};
}

/**
 * Get all available tool names for a role
 */
export function getAvailableToolNames(role) {
  return Object.keys(getToolsForRole(role));
}