import type { SupabaseClient } from '@supabase/supabase-js';

// Tool execution context
export interface ToolContext {
  userId: string;
  userRole: 'admin' | 'employee';
  supabase: SupabaseClient;
}

// Database types
export interface Employee {
  user_id: string;
  department: string | null;
  designation: string | null;
  skills: string[];
  availability: boolean | null;
  current_workload: number | null;
  performance_score: number | null;
  hourly_rate: number | null;
  tasks_completed: number | null;
  on_time_rate: number | null;
  quality_score: number | null;
  bio: string | null;
  profiles: {
    full_name: string;
    email: string;
    contact: string | null;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'invited' | 'accepted' | 'ongoing' | 'completed' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number;
  deadline: string | null;
  assigned_to: string | null;
  created_by: string;
  required_skills: string[];
  estimated_hours: number | null;
  complexity_multiplier: number | null;
  started_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  user_id: string;
  update_text: string;
  progress: number | null;
  hours_logged: number | null;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  task_id: string;
  amount_manual: number | null;
  amount_ai_suggested: number | null;
  status: 'pending' | 'approved' | 'paid';
  created_at: string;
  paid_at: string | null;
}

export interface Invitation {
  id: string;
  task_id: string;
  to_user_id: string;
  from_user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
  responded_at: string | null;
}

// Tool response types
export interface ToolSuccessResponse<T = any> {
  success: true;
  message?: string;
  data: T;
}

export interface ToolErrorResponse {
  success: false;
  error: string;
  details?: string;
  missingFields?: string[];
}

export type ToolResponse<T = any> = ToolSuccessResponse<T> | ToolErrorResponse;

// Helper type for task with employee info
export interface TaskWithEmployee extends Task {
  assignedEmployee?: {
    id: string;
    name: string;
    email: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

// Helper type for employee with current tasks
export interface EmployeeWithTasks extends Employee {
  currentTasks: Array<{
    id: string;
    title: string;
    status: string;
    progress: number;
  }>;
}

// Performance metrics
export interface PerformanceMetrics {
  tasksCompleted: number;
  onTimeRate: number;
  qualityScore: number;
  averageCompletionTime: number;
  currentWorkload: number;
  totalEarnings: number;
  pendingPayments: number;
}

// Statistics
export interface TaskStatistics {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  completionRate: number;
  onTimeRate: number;
  averageProgressPercentage: number;
}

export interface DepartmentWorkload {
  department: string;
  employeeCount: number;
  totalTasks: number;
  completedTasks: number;
  ongoingTasks: number;
  averageWorkload: number;
  topPerformers: Array<{
    name: string;
    performanceScore: number;
  }>;
}
