import { useEffect, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskUpdate = Database["public"]["Tables"]["task_updates"]["Row"];
type ChatMessage = Database["public"]["Tables"]["chat_messages"]["Row"];

interface UseRealtimeNotificationsProps {
  userId: string;
  userRole: "admin" | "employee";
  onTaskUpdate?: () => void;
  onNewMessage?: () => void;
}

/**
 * Custom hook for real-time notifications using Supabase Realtime
 * 
 * Subscribes to:
 * - Tasks: New invitations, status changes
 * - Task Updates: Progress updates, comments
 * - Chat Messages: New chat messages
 * 
 * @param userId - Current user's ID
 * @param userRole - User's role (admin or employee)
 * @param onTaskUpdate - Callback when tasks are updated
 * @param onNewMessage - Callback when new messages arrive
 */
export function useRealtimeNotifications({
  userId,
  userRole,
  onTaskUpdate,
  onNewMessage,
}: UseRealtimeNotificationsProps) {
  const { toast } = useToast();
  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    if (!userId) return;

    // Cleanup function to remove all channels
    const cleanup = () => {
      channelsRef.current.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      channelsRef.current = [];
    };

    // Channel 1: Task Invitations (for employees)
    if (userRole === "employee") {
      const taskInvitationChannel = supabase
        .channel("task-invitations")
        .on<Task>(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tasks",
            filter: `assigned_to=eq.${userId}`,
          },
          (payload) => {
            const task = payload.new;
            toast({
              title: "🎯 New Task Invitation!",
              description: `You've been assigned: "${task.title}"`,
              duration: 5000,
            });
            onTaskUpdate?.();
          }
        )
        .subscribe();

      channelsRef.current.push(taskInvitationChannel);
    }

    // Channel 2: Task Status Changes (for employees)
    if (userRole === "employee") {
      const taskStatusChannel = supabase
        .channel("task-status-changes")
        .on<Task>(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tasks",
            filter: `assigned_to=eq.${userId}`,
          },
          (payload) => {
            const oldTask = payload.old;
            const newTask = payload.new;

            // Only notify if status changed
            if (oldTask.status !== newTask.status) {
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
              onTaskUpdate?.();
            }
          }
        )
        .subscribe();

      channelsRef.current.push(taskStatusChannel);
    }

    // Channel 3: Task Updates/Comments (for both roles)
    const taskUpdatesChannel = supabase
      .channel("task-updates")
      .on<TaskUpdate>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "task_updates",
        },
        async (payload) => {
          const update = payload.new;

          // Fetch task details to check if user is involved
          const { data: task } = await supabase
            .from("tasks")
            .select("title, assigned_to, created_by")
            .eq("id", update.task_id)
            .single();

          if (!task) return;

          // Notify if user is assigned to the task or created it
          const isInvolved =
            task.assigned_to === userId || task.created_by === userId;

          if (isInvolved && update.user_id !== userId) {
            const notificationType = update.hours_logged
              ? "⏱️ Hours Logged"
              : update.update_text
              ? "💬 New Comment"
              : "📊 Progress Update";

            toast({
              title: notificationType,
              description:
                update.update_text ||
                `Progress: ${update.progress}% on "${task.title}"`,
              duration: 4000,
            });
            onTaskUpdate?.();
          }
        }
      )
      .subscribe();

    channelsRef.current.push(taskUpdatesChannel);

    // Channel 4: Chat Messages (for both roles)
    const chatMessagesChannel = supabase
      .channel("chat-messages")
      .on<ChatMessage>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload) => {
          const message = payload.new;

          // Don't notify for own messages
          if (message.user_id === userId) return;

          // Fetch sender name
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", message.user_id)
            .single();

          const senderName = profile?.full_name || "Someone";

          toast({
            title: `💬 ${senderName}`,
            description: message.message.substring(0, 50) + "...",
            duration: 3000,
          });
          onNewMessage?.();
        }
      )
      .subscribe();

    channelsRef.current.push(chatMessagesChannel);

    // Channel 5: Admin - Task completion notifications
    if (userRole === "admin") {
      const adminTaskChannel = supabase
        .channel("admin-task-notifications")
        .on<Task>(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tasks",
            filter: `created_by=eq.${userId}`,
          },
          async (payload) => {
            const oldTask = payload.old;
            const newTask = payload.new;

            // Notify when employee accepts/rejects/completes task
            if (oldTask.status !== newTask.status) {
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
              onTaskUpdate?.();
            }
          }
        )
        .subscribe();

      channelsRef.current.push(adminTaskChannel);
    }

    // Cleanup on unmount
    return cleanup;
  }, [userId, userRole, toast, onTaskUpdate, onNewMessage]);

  return {
    // Return channel count for debugging
    activeChannels: channelsRef.current.length,
  };
}
