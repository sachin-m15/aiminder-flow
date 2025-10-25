import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  type: 'task_update' | 'new_message' | 'payment_update' | 'system';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  subscribeToRealtimeUpdates: (userId: string, userRole: string) => () => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  
  addNotification: (notification) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false
    };
    
    set((state) => ({
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1
    }));
  },
  
  markAsRead: (id) => {
    set((state) => {
      const updatedNotifications = state.notifications.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      );
      
      return {
        notifications: updatedNotifications,
        unreadCount: updatedNotifications.filter(n => !n.read).length
      };
    });
  },
  
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map(notif => ({ ...notif, read: true })),
      unreadCount: 0
    }));
  },
  
  clearNotifications: () => {
    set({ notifications: [], unreadCount: 0 });
  },
  
  subscribeToRealtimeUpdates: (userId: string, userRole: string) => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: userRole === 'employee' ? `assigned_to=eq.${userId}` : undefined
        },
        (payload) => {
          const { addNotification } = get();
          
          if (payload.eventType === 'INSERT') {
            addNotification({
              type: 'task_update',
              title: 'New Task Assigned',
              message: `You have been assigned a new task: ${payload.new.title}`,
              metadata: { taskId: payload.new.id }
            });
          } else if (payload.eventType === 'UPDATE') {
            addNotification({
              type: 'task_update',
              title: 'Task Updated',
              message: `Task "${payload.new.title}" has been updated`,
              metadata: { taskId: payload.new.id }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: userRole === 'employee' ? `user_id=eq.${userId}` : undefined
        },
        (payload) => {
          const { addNotification } = get();
          
          if (payload.eventType === 'UPDATE' && payload.new.status === 'approved') {
            addNotification({
              type: 'payment_update',
              title: 'Payment Approved',
              message: `Your payment for task has been approved`,
              metadata: { paymentId: payload.new.id }
            });
          } else if (payload.eventType === 'UPDATE' && payload.new.status === 'paid') {
            addNotification({
              type: 'payment_update',
              title: 'Payment Processed',
              message: `Your payment has been processed successfully`,
              metadata: { paymentId: payload.new.id }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}));

// Selectors for optimized re-renders
export const useNotifications = () => useNotificationStore((state) => state.notifications);
export const useUnreadCount = () => useNotificationStore((state) => state.unreadCount);
export const useNotificationActions = () => useNotificationStore((state) => ({
  addNotification: state.addNotification,
  markAsRead: state.markAsRead,
  markAllAsRead: state.markAllAsRead,
  clearNotifications: state.clearNotifications,
  subscribeToRealtimeUpdates: state.subscribeToRealtimeUpdates
}));