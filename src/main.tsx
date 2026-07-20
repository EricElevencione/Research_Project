import './index.css';
import App from './index';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { startSyncEngine } from './services/syncEngine';
import { registerTileCacheServiceWorker } from './services/offlineTileCache';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

// ─── Offline Infrastructure ─────────────────────────────────────────────────
// Start the sync engine (auto-replays queued offline actions when connectivity returns)
startSyncEngine();

// Register the tile-caching service worker (caches map satellite tiles for offline use)
registerTileCacheServiceWorker();
