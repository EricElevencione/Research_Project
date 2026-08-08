/**
 * offlineTileCache.ts — Registers a service worker for caching map tiles.
 *
 * The service worker (public/tile-cache-sw.js) intercepts fetch requests
 * to tile providers and serves them from cache when offline.
 */

/**
 * Register the tile-caching service worker.
 * Should be called once on app boot from main.tsx.
 */
export async function registerTileCacheServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/tile-cache-sw.js",
      { scope: "/" },
    );

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "activated") {
          }
        });
      }
    });

  } catch (error) {
    console.error("offlineTileCache: Service worker registration failed:", error);
  }
}

/**
 * Get approximate cache size information (if available).
 */
export async function getTileCacheInfo(): Promise<{
  entries: number;
  estimatedSizeMB: number;
} | null> {
  if (!("caches" in window)) return null;

  try {
    const cache = await caches.open("map-tiles-v1");
    const keys = await cache.keys();
    const entries = keys.length;

    // Estimate size — each tile is roughly 15-50KB
    const estimatedSizeMB = Math.round((entries * 30) / 1024);

    return { entries, estimatedSizeMB };
  } catch {
    return null;
  }
}

/**
 * Clear the tile cache entirely.
 */
export async function clearTileCache(): Promise<void> {
  if (!("caches" in window)) return;

  try {
    await caches.delete("map-tiles-v1");
  } catch (error) {
    console.error("offlineTileCache: Failed to clear tile cache:", error);
  }
}
