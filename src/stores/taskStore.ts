import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  deadline: string | null;
  assigned_to: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  } | null;
}

interface TaskState {
  tasks: Task[];
  selectedTask: Task | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  loadTasks: (userId: string, isAdmin: boolean) => Promise<void>;
  setSelectedTask: (task: Task | null) => void;
  acceptTask: (taskId: string) => Promise<void>;
  rejectTask: (taskId: string) => Promise<void>;
  updateTaskProgress: (taskId: string, progress: number) => Promise<void>;
  subscribeToTaskUpdates: (userId: string, isAdmin: boolean) => () => void;
  
  // Computed values
  getFilteredTasks: (filters: {
    searchQuery?: string;
    statusFilter?: string;
    priorityFilter?: string;
    sortBy?: string;
  }) => Task[];
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTask: null,
  loading: false,
  error: null,
  
  loadTasks: async (userId: string, isAdmin: boolean) => {
    set({ loading: true, error: null });
    
    try {
      let query = supabase
        .from("tasks")
        .select("*");

      if (!isAdmin) {
        query = query.eq("assigned_to", userId);
      }

      const { data: tasksData, error } = await query;

      if (error) {
        throw new Error("Failed to load tasks");
      }

      // Get assigned user profiles
      const assignedIds = tasksData?.filter(t => t.assigned_to).map(t => t.assigned_to) || [];

      if (assignedIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", assignedIds);

        const merged = tasksData?.map(task => ({
          ...task,
          profiles: task.assigned_to ? profileData?.find(p => p.id === task.assigned_to) || null : null
        })) || [];

        set({ tasks: merged, loading: false });
      } else {
        const merged = tasksData?.map(task => ({ ...task, profiles: null })) || [];
        set({ tasks: merged, loading: false });
      }
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      toast.error("Failed to load tasks");
    }
  },
  
  setSelectedTask: (task) => set({ selectedTask: task }),
  
  acceptTask: async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString()
        })
        .eq("id", taskId);

      if (error) throw error;
      
      toast.success("Task accepted!");
      get().loadTasks('', true); // Reload tasks
    } catch (error) {
      toast.error("Failed to accept task");
    }
  },
  
  rejectTask: async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "rejected" })
        .eq("id", taskId);

      if (error) throw error;
      
      toast.success("Task rejected");
      get().loadTasks('', true); // Reload tasks
    } catch (error) {
      toast.error("Failed to reject task");
    }
  },
  
  updateTaskProgress: async (taskId: string, progress: number) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ progress })
        .eq("id", taskId);

      if (error) throw error;
      
      toast.success("Progress updated!");
    } catch (error) {
      toast.error("Failed to update progress");
    }
  },
  
  subscribeToTaskUpdates: (userId: string, isAdmin: boolean) => {
    const channel = supabase
      .channel("optimized-tasks")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          select: "id,title,status,priority,assigned_to,created_by,progress,deadline"
        },
        () => {
          get().loadTasks(userId, isAdmin);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          select: "id,title,status,priority,assigned_to,created_by,progress,deadline"
        },
        () => {
          get().loadTasks(userId, isAdmin);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "tasks",
          select: "id"
        },
        () => {
          get().loadTasks(userId, isAdmin);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
  
  getFilteredTasks: (filters) => {
    const { tasks } = get();
    const { searchQuery = '', statusFilter = 'all', priorityFilter = 'all', sortBy = 'created_at' } = filters;
    
    let filtered = tasks.filter((task) => {
      // Search filter
      const matchesSearch = !searchQuery ||
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.profiles?.full_name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === "all" || task.status === statusFilter;

      // Priority filter
      const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });

    // Apply sorting
    filtered = filtered.sort((a, b) => {
      switch (sortBy) {
        case "deadline": {
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        case "priority": {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return (priorityOrder[a.priority as keyof typeof priorityOrder] || 3) -
            (priorityOrder[b.priority as keyof typeof priorityOrder] || 3);
        }
        case "progress":
          return b.progress - a.progress;
        case "created_at":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }
}));

// Selectors for optimized re-renders
export const useTasks = () => useTaskStore((state) => state.tasks);
export const useSelectedTask = () => useTaskStore((state) => state.selectedTask);
export const useTaskLoading = () => useTaskStore((state) => state.loading);
export const useTaskError = () => useTaskStore((state) => state.error);
export const useTaskActions = () => useTaskStore((state) => ({
  loadTasks: state.loadTasks,
  setSelectedTask: state.setSelectedTask,
  acceptTask: state.acceptTask,
  rejectTask: state.rejectTask,
  updateTaskProgress: state.updateTaskProgress,
  subscribeToTaskUpdates: state.subscribeToTaskUpdates,
  getFilteredTasks: state.getFilteredTasks
}));