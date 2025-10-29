// Admin tools
import {
  listEmployees,
  getEmployeeDetails,
  updateEmployee,
  getEmployeePerformance,
  searchEmployeesBySkills,
} from './admin/employees';

import {
  createTask,
  assignTask,
  updateTask,
  deleteTask,
  listTasks,
  getTaskDetails,
} from './admin/tasks';

// Export type for tool registry
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolRegistry = Record<string, any>;

/**
 * Get tools based on user role
 */
export function getToolsForRole(role: 'admin' | 'employee'): ToolRegistry {
  if (role === 'admin') {
    return {
      // Employee Management Tools
      listEmployees,
      getEmployeeDetails,
      updateEmployee,
      getEmployeePerformance,
      searchEmployeesBySkills,
      
      // Task Management Tools
      createTask,
      assignTask,
      updateTask,
      deleteTask,
      listTasks,
      getTaskDetails,
      
      // Payment Management Tools (TODO: Add when implemented)
      // createPayment: createPaymentTool,
      // approvePayment: approvePaymentTool,
      // listPayments: listPaymentsTool,
      // getPaymentDetails: getPaymentDetailsTool,
      
      // Analytics Tools (TODO: Add when implemented)
      // getWorkforceAnalytics: getWorkforceAnalyticsTool,
      // getTaskAnalytics: getTaskAnalyticsTool,
      // getFinancialSummary: getFinancialSummaryTool,
    };
  }
  
  // Employee tools
  return {
    // Employee Task Tools (TODO: Add when implemented)
    // acceptTask: acceptTaskTool,
    // rejectTask: rejectTaskTool,
    // viewMyTasks: viewMyTasksTool,
    // updateTaskProgress: updateTaskProgressTool,
    // completeTask: completeTaskTool,
    // getMyTaskDetails: getMyTaskDetailsTool,
    // requestTaskHelp: requestTaskHelpTool,
    
    // Employee Profile Tools (TODO: Add when implemented)
    // viewMyProfile: viewMyProfileTool,
    // updateMyProfile: updateMyProfileTool,
    // viewMyPerformance: viewMyPerformanceTool,
    
    // Employee Inbox Tools (TODO: Add when implemented)
    // viewInvitations: viewInvitationsTool,
    // respondToInvitation: respondToInvitationTool,
  };
}

/**
 * Get all available tool names for a role
 */
export function getAvailableToolNames(role: 'admin' | 'employee'): string[] {
  return Object.keys(getToolsForRole(role));
}
