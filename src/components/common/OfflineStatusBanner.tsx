/**
 * OfflineStatusBanner.tsx — Non-intrusive banner for technician screens.
 *
 * Shows connectivity status, pending sync count, and sync controls.
 * Hidden when online with nothing pending.
 */

import React, { useState, useEffect } from "react";
import { useOfflineStatus } from "../../hooks/useOfflineStatus";
import "../../assets/css/components/OfflineStatusBanner.css";

interface OfflineStatusBannerProps {
  /** If true, show a brief success message after sync completes, then auto-hide */
  showSyncSuccess?: boolean;
}

const OfflineStatusBanner: React.FC<OfflineStatusBannerProps> = ({
  showSyncSuccess = true,
}) => {
  const {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    triggerSync,
  } = useOfflineStatus();

  const [showSuccess, setShowSuccess] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show brief success message after sync completes
  useEffect(() => {
    if (
      showSyncSuccess &&
      lastSyncResult &&
      lastSyncResult.succeeded > 0 &&
      lastSyncResult.failed === 0
    ) {
      setShowSuccess(true);
      setDismissed(false);
      const timer = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult, showSyncSuccess]);

  // Reset dismissed state when going offline
  useEffect(() => {
    if (!isOnline) {
      setDismissed(false);
    }
  }, [isOnline]);

  // ─── Determine what to show ───────────────────────────────────────────

  // Syncing state
  if (isSyncing) {
    return (
      <div className="offline-banner offline-banner--syncing" role="status">
        <span className="offline-banner__icon">
          <span className="offline-banner__spinner" />
        </span>
        <span className="offline-banner__text">
          Syncing changes...
          {pendingCount > 0 && (
            <span className="offline-banner__count">{pendingCount}</span>
          )}
        </span>
      </div>
    );
  }

  // Sync success flash
  if (showSuccess && isOnline && pendingCount === 0) {
    return (
      <div className="offline-banner offline-banner--online-ok" role="status">
        <span className="offline-banner__icon">✅</span>
        <span className="offline-banner__text">
          All changes synced successfully!
        </span>
        <button
          className="offline-banner__dismiss"
          onClick={() => setShowSuccess(false)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  // Has failed items
  if (
    isOnline &&
    lastSyncResult &&
    lastSyncResult.failed > 0 &&
    pendingCount > 0
  ) {
    return (
      <div className="offline-banner offline-banner--failed" role="alert">
        <span className="offline-banner__icon">⚠️</span>
        <span className="offline-banner__text">
          {lastSyncResult.failed} change(s) failed to sync.
          <span className="offline-banner__count">{pendingCount}</span>
        </span>
        <button
          className="offline-banner__action"
          onClick={triggerSync}
          disabled={isSyncing}
        >
          Retry
        </button>
      </div>
    );
  }

  // Offline with pending items
  if (!isOnline && pendingCount > 0) {
    return (
      <div className="offline-banner offline-banner--offline" role="status">
        <span className="offline-banner__icon">📡</span>
        <span className="offline-banner__text">
          You're offline.{" "}
          <strong>{pendingCount} change(s)</strong> will sync when
          connection returns.
        </span>
      </div>
    );
  }

  // Offline, no pending items
  if (!isOnline) {
    if (dismissed) return null;
    return (
      <div className="offline-banner offline-banner--offline" role="status">
        <span className="offline-banner__icon">📡</span>
        <span className="offline-banner__text">
          You're offline. Changes will be saved locally.
        </span>
        <button
          className="offline-banner__dismiss"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    );
  }

  // Online with pending items (e.g. just came back online, sync not started yet)
  if (isOnline && pendingCount > 0) {
    return (
      <div className="offline-banner offline-banner--pending" role="status">
        <span className="offline-banner__icon">🔄</span>
        <span className="offline-banner__text">
          <strong>{pendingCount} offline change(s)</strong> ready to sync.
        </span>
        <button
          className="offline-banner__action"
          onClick={triggerSync}
          disabled={isSyncing}
        >
          Sync Now
        </button>
      </div>
    );
  }

  // Online, nothing pending — hide entirely
  return null;
};

export default OfflineStatusBanner;
