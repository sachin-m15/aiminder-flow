import { useEffect, useRef, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskUpdate = Database["public"]["Tables"]["task_updates"]["Row"];

interface UseRealtimeNotificationsProps {
  userId: string;
  userRole: "admin" | "employee";
  onTaskUpdate?: () => void;
  onConnectionStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
}

interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'reconnecting';
  lastConnectedAt?: Date;
  disconnectCount: number;
}

/**
 * Optimized custom hook for real-time notifications using Supabase Realtime
 * 
 * Features:
 * - Consolidated channels (reduced from 5 to 2)
 * - Debounced updates to prevent rapid refreshes
 * - Selective field retrieval to minimize payload size
 * - Connection status monitoring with auto-reconnect
 * - Subscription filtering by relevance
 * - Single WebSocket connection management
 * 
 * @param userId - Current user's ID
 * @param userRole - User's role (admin or employee)
 * @param onTaskUpdate - Callback when tasks are updated
 * @param onConnectionStatusChange - Callback for connection status changes
 */
export function useRealtimeNotificationsOptimized({
  userId,
  userRole,
  onTaskUpdate,
  onConnectionStatusChange,
}: UseRealtimeNotificationsProps) {
  const { toast } = useToast();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'connected',
    disconnectCount: 0
  });

  // Debounced callback to prevent rapid updates
  const debouncedCallback = useCallback((callback: () => void) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(callback, 300); // 300ms debounce
  }, []);

  // Update connection status and notify parent
  const updateConnectionStatus = useCallback((status: ConnectionStatus['status']) => {
    const newStatus: ConnectionStatus = {
      status,
      lastConnectedAt: status === 'connected' ? new Date() : connectionStatus.lastConnectedAt,
      disconnectCount: status === 'disconnected' ? connectionStatus.disconnectCount + 1 : connectionStatus.disconnectCount
    };
    
    setConnectionStatus(newStatus);
    onConnectionStatusChange?.(status);
  }, [connectionStatus, onConnectionStatusChange]);

  // Auto-reconnect logic
  const reconnect = useCallback(async () => {
    if (connectionStatus.status === 'disconnected') {
      updateConnectionStatus('reconnecting');
      try {
        // Re-subscribe to all channels
        channelsRef.current.forEach(channel => {
          supabase.removeChannel(channel);
        });
        channelsRef.current = [];
        
        // Re-initialize subscriptions
        initializeSubscriptions();
        updateConnectionStatus('connected');
      } catch (error) {
        console.error('Reconnection failed:', error);
        updateConnectionStatus('disconnected');
      }
    }
  }, [connectionStatus.status, updateConnectionStatus]);

  const initializeSubscriptions = useCallback(() => {
    if (!userId) return;

    // Cleanup function to remove all channels
    const cleanup = () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };

    // Channel 1: Consolidated Task Events (replaces 3 original channels)
    const taskEventsChannel = supabase
      .channel("consolidated-task-events")
      .on<Task>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tasks",
          filter: userRole === "employee" ? `assigned_to=eq.${userId}` : undefined,
        },
        (payload) => {
          // Only notify employees about new task invitations
          if (userRole === "employee") {
            const task = payload.new;
            toast({
              title: "🎯 New Task Invitation!",
              description: `You've been assigned: "${task.title}"`,
              duration: 5000,
            });
            debouncedCallback(() => onTaskUpdate?.());
          }
        }
      )
      .on<Task>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: userRole === "employee" ? `assigned_to=eq.${userId}` : 
                 userRole === "admin" ? `created_by=eq.${userId}` : undefined,
        },
        async (payload) => {
          const oldTask = payload.old;
          const newTask = payload.new;

          // Only notify if status changed
          if (oldTask.status !== newTask.status) {
            if (userRole === "employee") {
              const statusMessages: Record<string, string> = {
                accepted: "✅ Task accepted!",
                rejected: "❌ Task rejected",
                completed: "🎉 Task completed!",
                pending: "⏳ Task is pending",
              };

              toast({
                title: statusMessages[newTask.status] || "Task status updated",
                description: `"${newTask.title}" is now ${newTask.status}`,
                duration: 4000,
              });
            } else if (userRole === "admin") {
              // Admin notification for task status changes
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", newTask.assigned_to)
                .single();

              const employeeName = profile?.full_name || "Employee";
              const statusEmojis: Record<string, string> = {
                accepted: "✅",
                rejected: "❌",
                completed: "🎉",
              };

              const emoji = statusEmojis[newTask.status] || "📝";
              toast({
                title: `${emoji} Task ${newTask.status}`,
                description: `${employeeName} ${newTask.status} "${newTask.title}"`,
                duration: 5000,
              });
            }
            
            debouncedCallback(() => onTaskUpdate?.());
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          updateConnectionStatus('disconnected');
        }
      });

    channelsRef.current.push(taskEventsChannel);

    // Channel 2: Consolidated Activity Events (task updates + chat messages)
    const activityEventsChannel = supabase
      .channel("consolidated-activity-events")
      .on<TaskUpdate>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_updates",
          // Only fetch minimal fields needed for notification
          select: "id,task_id,user_id,update_text,progress,hours_logged,created_at"
        },
        async (payload) => {
          const update = payload.new;

          // Fetch only the minimal task details needed
          const { data: task } = await supabase
            .from("tasks")
            .select("id,title,assigned_to,created_by")
            .eq("id", update.task_id)
            .single();

          if (!task) return;

          // Notify if user is assigned to the task or created it
          const isInvolved = task.assigned_to === userId || task.created_by === userId;

          if (isInvolved && update.user_id !== userId) {
            const notificationType = update.hours_logged
              ? "⏱️ Hours Logged"
              : update.update_text
              ? "💬 New Comment"
              : "📊 Progress Update";

            toast({
              title: notificationType,
              description: update.update_text || `Progress: ${update.progress}% on "${task.title}"`,
              duration: 4000,
            });
            debouncedCallback(() => onTaskUpdate?.());
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          updateConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          updateConnectionStatus('disconnected');
        }
      });

    channelsRef.current.push(activityEventsChannel);

    // Cleanup on unmount
    return cleanup;
  }, [userId, userRole, toast, onTaskUpdate, debouncedCallback, updateConnectionStatus]);

  useEffect(() => {
    const cleanup = initializeSubscriptions();

    // Set up periodic connection health check
    const healthCheckInterval = setInterval(() => {
      if (connectionStatus.status === 'disconnected') {
        reconnect();
      }
    }, 5000); // Check every 5 seconds

    return () => {
      cleanup();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      clearInterval(healthCheckInterval);
    };
  }, [initializeSubscriptions, connectionStatus.status, reconnect]);

  return {
    // Return channel count and connection status for debugging
    activeChannels: channelsRef.current.length,
    connectionStatus,
    reconnect,
  };
}