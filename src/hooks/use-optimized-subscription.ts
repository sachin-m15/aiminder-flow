import { useEffect, useRef, useState, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface UseOptimizedSubscriptionProps {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  select?: string;
  onEvent: (payload: any) => void;
  debounceMs?: number;
  channelName?: string;
}

interface SubscriptionStatus {
  isConnected: boolean;
  lastEventAt?: Date;
  eventCount: number;
  error?: string;
}

/**
 * Optimized subscription hook with debouncing, selective field retrieval,
 * and connection management for real-time updates
 */
export function useOptimizedSubscription({
  table,
  event,
  filter,
  select,
  onEvent,
  debounceMs = 300,
  channelName = `optimized-${table}-${event}`,
}: UseOptimizedSubscriptionProps) {
  const channelRef = useRef<RealtimeChannel>();
  const debounceRef = useRef<NodeJS.Timeout>();
  const [status, setStatus] = useState<SubscriptionStatus>({
    isConnected: false,
    eventCount: 0
  });

  // Debounced event handler
  const debouncedOnEvent = useCallback((payload: any) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      onEvent(payload);
      setStatus(prev => ({
        ...prev,
        lastEventAt: new Date(),
        eventCount: prev.eventCount + 1
      }));
    }, debounceMs);
  }, [onEvent, debounceMs]);

  useEffect(() => {
    // Cleanup previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new optimized subscription
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          filter,
          select,
        },
        debouncedOnEvent
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus(prev => ({ ...prev, isConnected: true, error: undefined }));
        } else if (subscriptionStatus === 'CHANNEL_ERROR') {
          setStatus(prev => ({ ...prev, isConnected: false, error: 'Channel error' }));
        }
      });

    channelRef.current = channel;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [table, event, filter, select, channelName, debouncedOnEvent]);

  const reconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = undefined;
    }
    setStatus(prev => ({ ...prev, isConnected: false }));
    
    // Re-initialize subscription
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event,
          schema: "public",
          table,
          filter,
          select,
        },
        debouncedOnEvent
      )
      .subscribe();

    channelRef.current = channel;
  }, [table, event, filter, select, channelName, debouncedOnEvent]);

  return {
    status,
    reconnect,
    disconnect: () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = undefined;
      }
      setStatus(prev => ({ ...prev, isConnected: false }));
    }
  };
}

/**
 * Hook for managing multiple optimized subscriptions with shared connection
 */
export function useOptimizedSubscriptions(
  subscriptions: UseOptimizedSubscriptionProps[]
) {
  const [overallStatus, setOverallStatus] = useState<{
    connected: number;
    total: number;
    lastEventAt?: Date;
  }>({
    connected: 0,
    total: subscriptions.length
  });

  const individualStatuses = subscriptions.map((config, index) => {
    const { status, reconnect, disconnect } = useOptimizedSubscription(config);
    
    // Update overall status when individual status changes
    useEffect(() => {
      setOverallStatus(prev => ({
        ...prev,
        connected: prev.connected + (status.isConnected ? 1 : 0),
        lastEventAt: status.lastEventAt || prev.lastEventAt
      }));
    }, [status.isConnected, status.lastEventAt]);

    return { status, reconnect, disconnect };
  });

  const reconnectAll = useCallback(() => {
    individualStatuses.forEach(({ reconnect }) => reconnect());
  }, [individualStatuses]);

  const disconnectAll = useCallback(() => {
    individualStatuses.forEach(({ disconnect }) => disconnect());
  }, [individualStatuses]);

  return {
    overallStatus,
    individualStatuses,
    reconnectAll,
    disconnectAll
  };
}