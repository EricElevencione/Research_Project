/**
 * tile-cache-sw.js — Service Worker for caching map tiles offline.
 *
 * Strategy: Cache-first, network-fallback.
 *   - On fetch: serve from cache if available, otherwise fetch from network and cache.
 *   - When online: fresh tiles are cached for future offline use.
 *   - Cache limit: ~5000 entries (auto-evicts oldest when exceeded).
 *
 * Cached tile providers:
 *   - Esri World Imagery (satellite)
 *   - CARTO basemap labels
 *   - OpenStreetMap tiles
 */

const CACHE_NAME = "map-tiles-v1";
const MAX_CACHE_ENTRIES = 5000;

// Tile URL patterns to intercept
const TILE_PATTERNS = [
  "server.arcgisonline.com",
  "basemaps.cartocdn.com",
  "tile.openstreetmap.org",
];

/**
 * Check if a request URL is a map tile.
 */
function isTileRequest(url) {
  return TILE_PATTERNS.some((pattern) => url.includes(pattern));
}

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  // Activate immediately
  self.skipWaiting();
  console.log("[tile-cache-sw] Installed");
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  // Claim all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches if we bump the version
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("map-tiles-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      ),
    ]),
  );
  console.log("[tile-cache-sw] Activated");
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only intercept tile requests
  if (!isTileRequest(request.url)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Try cache first
      const cached = await cache.match(request);
      if (cached) {
        // If online, refresh the cache in the background (stale-while-revalidate)
        if (navigator.onLine) {
          fetch(request)
            .then((freshResponse) => {
              if (freshResponse && freshResponse.ok) {
                cache.put(request, freshResponse.clone());
              }
            })
            .catch(() => {
              /* network error, ignore — we already have the cached version */
            });
        }
        return cached;
      }

      // Not in cache — try network
      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.ok) {
          // Cache the tile for offline use
          cache.put(request, networkResponse.clone());

          // Evict old entries if we exceed the limit
          trimCache(cache);
        }
        return networkResponse;
      } catch (fetchError) {
        // Both cache and network failed — return a transparent 1x1 PNG placeholder
        console.warn(
          "[tile-cache-sw] Tile unavailable offline:",
          request.url.substring(0, 80),
        );
        return new Response(
          // Minimal 1x1 transparent PNG
          Uint8Array.from(
            atob(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB" +
                "Nl7BcQAAAABJRU5ErkJggg==",
            ),
            (c) => c.charCodeAt(0),
          ),
          {
            status: 200,
            headers: { "Content-Type": "image/png" },
          },
        );
      }
    }),
  );
});

// ─── Cache eviction ─────────────────────────────────────────────────────────

async function trimCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_CACHE_ENTRIES) return;

  // Delete oldest entries (first in the list)
  const toDelete = keys.length - MAX_CACHE_ENTRIES;
  console.log(`[tile-cache-sw] Evicting ${toDelete} old tile(s) from cache`);
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]);
  }
}
