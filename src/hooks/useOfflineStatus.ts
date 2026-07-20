/**
 * useOfflineStatus.ts — React hook for offline awareness.
 *
 * Provides connectivity status, pending action count, and sync controls
 * to any component that needs to react to offline/online changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getPendingCount } from "../services/offlineDb";
import {
  triggerSync,
  onSyncEvent,
  type SyncResult,
} from "../services/syncEngine";

export interface OfflineStatus {
  /** Whether the browser currently has network connectivity */
  isOnline: boolean;
  /** Number of actions waiting to be synced */
  pendingCount: number;
  /** Whether a sync is currently in progress */
  isSyncing: boolean;
  /** Timestamp of the last successful sync */
  lastSyncTime: Date | null;
  /** Result of the most recent sync attempt */
  lastSyncResult: SyncResult | null;
  /** Manually trigger a sync */
  triggerSync: () => Promise<void>;
}

/**
 * Hook that tracks online/offline status and pending sync count.
 *
 * @param pollIntervalMs - How often to refresh the pending count (default: 5000ms)
 */
export function useOfflineStatus(pollIntervalMs = 5000): OfflineStatus {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(
    null,
  );
  const mountedRef = useRef(true);

  // Track online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (mountedRef.current) setIsOnline(true);
    };
    const handleOffline = () => {
      if (mountedRef.current) setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Poll pending count
  useEffect(() => {
    const refreshCount = () => {
      getPendingCount()
        .then((count) => {
          if (mountedRef.current) setPendingCount(count);
        })
        .catch(() => {
          /* IndexedDB error — ignore */
        });
    };

    // Initial fetch
    refreshCount();

    const interval = setInterval(refreshCount, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  // Listen to sync events
  useEffect(() => {
    const unsubscribe = onSyncEvent((event) => {
      if (!mountedRef.current) return;

      switch (event.type) {
        case "sync:start":
          setIsSyncing(true);
          break;
        case "sync:complete":
          setIsSyncing(false);
          setLastSyncTime(new Date());
          if (event.detail) setLastSyncResult(event.detail);
          // Refresh pending count after sync
          getPendingCount()
            .then((count) => {
              if (mountedRef.current) setPendingCount(count);
            })
            .catch(() => {});
          break;
        case "sync:error":
          setIsSyncing(false);
          break;
        case "sync:item-success":
        case "sync:item-fail":
          // Refresh count on each item
          getPendingCount()
            .then((count) => {
              if (mountedRef.current) setPendingCount(count);
            })
            .catch(() => {});
          break;
      }
    });

    return unsubscribe;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleTriggerSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;
    await triggerSync();
  }, [isSyncing, isOnline]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncTime,
    lastSyncResult,
    triggerSync: handleTriggerSync,
  };
}
