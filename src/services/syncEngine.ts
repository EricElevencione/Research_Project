/**
 * syncEngine.ts — Manages the offline sync lifecycle.
 *
 * Listens for connectivity changes, replays queued actions (FIFO)
 * against the real API when online, and emits events so the UI can react.
 */

import {
  getReadyActions,
  markActionSyncing,
  markActionSynced,
  markActionFailed,
  removeCachedLandPlot,
  markLandPlotSynced,
  getPendingCount,
  type PendingAction,
} from "./offlineDb";

import {
  updateFarmParcel,
  updateRsbsaSubmission,
  createLandPlot,
  updateLandPlot,
  deleteLandPlot,
} from "../api";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  pending: number;
  failed: number;
  lastSync: Date | null;
}

export type SyncEventType =
  | "sync:start"
  | "sync:complete"
  | "sync:error"
  | "sync:item-success"
  | "sync:item-fail";

export interface SyncEvent {
  type: SyncEventType;
  detail?: any;
}

type SyncCallback = (event: SyncEvent) => void;

// ─── State ──────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;

let _isSyncing = false;
let _lastSync: Date | null = null;
let _listeners: SyncCallback[] = [];
let _started = false;

// ─── Event system ───────────────────────────────────────────────────────────

function emit(type: SyncEventType, detail?: any) {
  const event: SyncEvent = { type, detail };
  _listeners.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.error("syncEngine: listener error", e);
    }
  });
}

/**
 * Subscribe to sync events. Returns an unsubscribe function.
 */
export function onSyncEvent(callback: SyncCallback): () => void {
  _listeners.push(callback);
  return () => {
    _listeners = _listeners.filter((cb) => cb !== callback);
  };
}

// ─── Action handlers ────────────────────────────────────────────────────────

async function replayAction(action: PendingAction): Promise<void> {
  const { type, payload } = action;

  switch (type) {
    case "CULTIVATION_UPDATE": {
      // payload shape: { farmerId, parcels: [{id, updates}], submission: {id, updates} }
      const { parcels, submission } = payload;

      // Update each parcel's cultivation status
      if (Array.isArray(parcels)) {
        for (const parcel of parcels) {
          const resp = await updateFarmParcel(parcel.id, parcel.updates);
          if (resp.error) {
            throw new Error(
              `Failed to update parcel ${parcel.id}: ${resp.error}`,
            );
          }
        }
      }

      // Update the RSBSA submission status
      if (submission) {
        const resp = await updateRsbsaSubmission(
          submission.id,
          submission.updates,
        );
        if (resp.error) {
          throw new Error(
            `Failed to update submission ${submission.id}: ${resp.error}`,
          );
        }
      }
      break;
    }

    case "LAND_PLOT_CREATE": {
      const resp = await createLandPlot(payload.plotData);
      if (resp.error) {
        throw new Error(`Failed to create land plot: ${resp.error}`);
      }
      // Clean up cached plot after successful sync
      if (payload.plotData?.id) {
        await markLandPlotSynced(String(payload.plotData.id));
      }
      break;
    }

    case "LAND_PLOT_UPDATE": {
      const resp = await updateLandPlot(payload.plotId, payload.plotData);
      if (resp.error) {
        throw new Error(`Failed to update land plot: ${resp.error}`);
      }
      if (payload.plotId) {
        await markLandPlotSynced(String(payload.plotId));
      }
      break;
    }

    case "LAND_PLOT_DELETE": {
      const resp = await deleteLandPlot(payload.plotId);
      if (resp.error) {
        throw new Error(`Failed to delete land plot: ${resp.error}`);
      }
      // Remove from cache after successful delete
      if (payload.plotId) {
        await removeCachedLandPlot(String(payload.plotId));
      }
      break;
    }

    default:
      throw new Error(`Unknown action type: ${type}`);
  }
}

// ─── Core sync logic ────────────────────────────────────────────────────────

/**
 * Process all pending actions in FIFO order.
 */
export async function triggerSync(): Promise<SyncResult> {
  if (_isSyncing) {
    return { total: 0, succeeded: 0, failed: 0 };
  }

  if (!navigator.onLine) {
    return { total: 0, succeeded: 0, failed: 0 };
  }

  _isSyncing = true;
  emit("sync:start");

  const result: SyncResult = { total: 0, succeeded: 0, failed: 0 };

  try {
    const actions = await getReadyActions();
    result.total = actions.length;

    if (actions.length === 0) {
      return result;
    }

    console.log(
      `syncEngine: Processing ${actions.length} pending action(s)...`,
    );

    for (const action of actions) {
      if (!navigator.onLine) {
        console.log("syncEngine: Lost connectivity mid-sync, stopping.");
        break;
      }

      const actionId = action.id!;

      try {
        await markActionSyncing(actionId);
        await replayAction(action);
        await markActionSynced(actionId);
        result.succeeded++;
        emit("sync:item-success", {
          actionId,
          type: action.type,
        });
        console.log(
          `syncEngine: ✅ Synced action #${actionId} (${action.type})`,
        );
      } catch (err: any) {
        const errorMsg = err?.message || "Unknown sync error";
        result.failed++;

        if ((action.retryCount || 0) + 1 >= MAX_RETRIES) {
          await markActionFailed(actionId, errorMsg);
          console.error(
            `syncEngine: ❌ Action #${actionId} failed permanently after ${MAX_RETRIES} retries: ${errorMsg}`,
          );
        } else {
          await markActionFailed(actionId, errorMsg);
          console.warn(
            `syncEngine: ⚠️ Action #${actionId} failed (retry ${(action.retryCount || 0) + 1}/${MAX_RETRIES}): ${errorMsg}`,
          );
        }

        emit("sync:item-fail", {
          actionId,
          type: action.type,
          error: errorMsg,
        });
      }
    }
  } catch (err: any) {
    console.error("syncEngine: Unexpected sync error:", err);
    emit("sync:error", { error: err?.message });
  } finally {
    _isSyncing = false;
    _lastSync = new Date();
    emit("sync:complete", result);
    console.log(
      `syncEngine: Sync complete — ${result.succeeded}/${result.total} succeeded, ${result.failed} failed`,
    );
  }

  return result;
}

/**
 * Get the current sync status.
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const pending = await getPendingCount();
  return {
    isSyncing: _isSyncing,
    pending,
    failed: 0, // Could be enhanced to track separately
    lastSync: _lastSync,
  };
}

// ─── Auto-sync on connectivity restore ──────────────────────────────────────

function handleOnline() {
  console.log("syncEngine: Connection restored — triggering sync...");
  // Small delay to let the network fully stabilize
  setTimeout(() => {
    triggerSync();
  }, 2000);
}

/**
 * Start the sync engine. Call once on app boot.
 * Listens for online events and auto-syncs.
 */
export function startSyncEngine(): void {
  if (_started) return;
  _started = true;

  window.addEventListener("online", handleOnline);

  // If we're already online and have pending items, sync now
  if (navigator.onLine) {
    getPendingCount().then((count) => {
      if (count > 0) {
        console.log(
          `syncEngine: Found ${count} pending action(s) on startup — syncing...`,
        );
        triggerSync();
      }
    });
  }

  console.log("syncEngine: Started and listening for connectivity changes.");
}

/**
 * Stop the sync engine (cleanup).
 */
export function stopSyncEngine(): void {
  window.removeEventListener("online", handleOnline);
  _started = false;
  _listeners = [];
}
