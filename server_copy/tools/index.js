// Server-side tools implementation
import { tool } from 'langchain';
import { z } from 'zod';
import { supabase } from '../supabase.js';

// Import individual tool modules
import * as employeeTools from './admin/employees.js';
import * as adminTaskTools from './admin/tasks.js';
import * as employeeTaskTools from './employee/tasks.js'; // <-- Import new employee tools

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
      analyzeAndPlanTask: adminTaskTools.analyzeAndPlanTask,
      createTask: adminTaskTools.createTask,
      assignTask: adminTaskTools.assignTask,
      updateTask: adminTaskTools.updateTask,
      deleteTask: adminTaskTools.deleteTask,
      listTasks: adminTaskTools.listTasks,
      getTaskDetails: adminTaskTools.getTaskDetails,
    };
  }
  
  // Employee tools
  return {
    listMyTasks: employeeTaskTools.listMyTasks,
    updateMyTask: employeeTaskTools.updateMyTask,
    addProgressUpdate: employeeTaskTools.addProgressUpdate,

    // Employees can also search for colleagues and view task/employee details
    getTaskDetails: adminTaskTools.getTaskDetails,
    getEmployeeDetails: employeeTools.getEmployeeDetails,
    searchEmployeesBySkills: employeeTools.searchEmployeesBySkills,
  };
}

/**
 * Get all available tool names for a role
 */
export function getAvailableToolNames(role) {
  return Object.keys(getToolsForRole(role));
}