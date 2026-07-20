/**
 * offlineDb.ts — IndexedDB wrapper for offline data storage
 *
 * Provides two object stores:
 *   • pendingActions  — queued write operations to replay on reconnect
 *   • cachedLandPlots — locally-saved land plots for offline geometry
 *
 * Uses the raw IndexedDB API (no external dependencies).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type OfflineActionType =
  | "CULTIVATION_UPDATE"
  | "LAND_PLOT_CREATE"
  | "LAND_PLOT_UPDATE"
  | "LAND_PLOT_DELETE";

export type ActionStatus = "pending" | "syncing" | "failed";

export interface PendingAction {
  id?: number; // auto-incremented key
  type: OfflineActionType;
  payload: Record<string, any>;
  timestamp: string; // ISO string of when the action was performed offline
  status: ActionStatus;
  retryCount: number;
  error?: string;
}

export interface CachedLandPlot {
  id: string;
  farmerId?: string | number | null;
  data: Record<string, any>; // full plot object including geometry
  lastSynced: string | null; // ISO string — null if never synced
}

// ─── Database Setup ─────────────────────────────────────────────────────────

const DB_NAME = "offlineSync";
const DB_VERSION = 1;
const PENDING_STORE = "pendingActions";
const PLOTS_STORE = "cachedLandPlots";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Pending actions store — auto-increment key
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const store = db.createObjectStore(PENDING_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Cached land plots store — keyed by plot id
      if (!db.objectStoreNames.contains(PLOTS_STORE)) {
        const store = db.createObjectStore(PLOTS_STORE, { keyPath: "id" });
        store.createIndex("farmerId", "farmerId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.error("offlineDb: Failed to open IndexedDB", request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

// ─── Generic helpers ────────────────────────────────────────────────────────

function txStore(
  storeName: string,
  mode: IDBTransactionMode,
): Promise<IDBObjectStore> {
  return openDb().then((db) => {
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Pending Actions (Queue Management) ─────────────────────────────────────

/**
 * Add a new action to the offline queue.
 * Returns the auto-generated key (id).
 */
export async function addPendingAction(
  type: OfflineActionType,
  payload: Record<string, any>,
): Promise<number> {
  const store = await txStore(PENDING_STORE, "readwrite");
  const action: PendingAction = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  };
  const key = await idbRequest(store.add(action));
  return key as number;
}

/**
 * Retrieve all pending actions (regardless of status), ordered by id (FIFO).
 */
export async function getPendingActions(): Promise<PendingAction[]> {
  const store = await txStore(PENDING_STORE, "readonly");
  return idbRequest(store.getAll());
}

/**
 * Retrieve only actions with status = "pending" (ready to sync).
 */
export async function getReadyActions(): Promise<PendingAction[]> {
  const store = await txStore(PENDING_STORE, "readonly");
  const index = store.index("status");
  return idbRequest(index.getAll("pending"));
}

/**
 * Update an action's status to "syncing" (in-progress).
 */
export async function markActionSyncing(id: number): Promise<void> {
  const store = await txStore(PENDING_STORE, "readwrite");
  const action = await idbRequest(store.get(id));
  if (!action) return;
  action.status = "syncing";
  await idbRequest(store.put(action));
}

/**
 * Remove a successfully synced action from the queue.
 */
export async function markActionSynced(id: number): Promise<void> {
  const store = await txStore(PENDING_STORE, "readwrite");
  await idbRequest(store.delete(id));
}

/**
 * Mark an action as failed and record the error.
 */
export async function markActionFailed(
  id: number,
  error: string,
): Promise<void> {
  const store = await txStore(PENDING_STORE, "readwrite");
  const action = await idbRequest(store.get(id));
  if (!action) return;
  action.status = "failed";
  action.retryCount += 1;
  action.error = error;
  await idbRequest(store.put(action));
}

/**
 * Reset a failed action back to "pending" so it can be retried.
 */
export async function retryFailedAction(id: number): Promise<void> {
  const store = await txStore(PENDING_STORE, "readwrite");
  const action = await idbRequest(store.get(id));
  if (!action) return;
  action.status = "pending";
  action.error = undefined;
  await idbRequest(store.put(action));
}

/**
 * Clear all synced (deleted) actions — no-op since markActionSynced already
 * deletes, but provided for completeness / bulk cleanup.
 */
export async function clearSyncedActions(): Promise<void> {
  // Since we delete on sync, this clears any remaining "syncing" ghosts
  const store = await txStore(PENDING_STORE, "readwrite");
  const all: PendingAction[] = await idbRequest(store.getAll());
  for (const action of all) {
    if (action.status === "syncing" && action.id != null) {
      await idbRequest(store.delete(action.id));
    }
  }
}

/**
 * Count of actions still in the queue (pending + failed).
 */
export async function getPendingCount(): Promise<number> {
  const store = await txStore(PENDING_STORE, "readonly");
  const all: PendingAction[] = await idbRequest(store.getAll());
  return all.filter((a) => a.status === "pending" || a.status === "failed")
    .length;
}

/**
 * Retry all failed actions by resetting them to pending.
 */
export async function retryAllFailed(): Promise<void> {
  const store = await txStore(PENDING_STORE, "readwrite");
  const all: PendingAction[] = await idbRequest(store.getAll());
  for (const action of all) {
    if (action.status === "failed" && action.id != null) {
      action.status = "pending";
      action.error = undefined;
      await idbRequest(store.put(action));
    }
  }
}

// ─── Cached Land Plots ─────────────────────────────────────────────────────

/**
 * Cache a land plot locally (for offline viewing or pending create/update).
 */
export async function cacheLandPlot(
  id: string,
  data: Record<string, any>,
  farmerId?: string | number | null,
): Promise<void> {
  const store = await txStore(PLOTS_STORE, "readwrite");
  const entry: CachedLandPlot = {
    id,
    farmerId: farmerId ?? null,
    data,
    lastSynced: null,
  };
  await idbRequest(store.put(entry));
}

/**
 * Get all cached land plots, optionally filtered by farmer ID.
 */
export async function getCachedLandPlots(
  farmerId?: string | number,
): Promise<CachedLandPlot[]> {
  const store = await txStore(PLOTS_STORE, "readonly");
  if (farmerId != null) {
    const index = store.index("farmerId");
    return idbRequest(index.getAll(farmerId));
  }
  return idbRequest(store.getAll());
}

/**
 * Remove a cached land plot.
 */
export async function removeCachedLandPlot(id: string): Promise<void> {
  const store = await txStore(PLOTS_STORE, "readwrite");
  await idbRequest(store.delete(id));
}

/**
 * Mark a cached land plot as synced (update lastSynced timestamp).
 */
export async function markLandPlotSynced(id: string): Promise<void> {
  const store = await txStore(PLOTS_STORE, "readwrite");
  const entry = await idbRequest(store.get(id));
  if (!entry) return;
  entry.lastSynced = new Date().toISOString();
  await idbRequest(store.put(entry));
}
