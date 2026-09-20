import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installFlushOnLifecycleEvents } from './services/storage/persistDebounced';
// Session 89 — `pwaInstall` is imported for side effects only: the
// module's top-level `beforeinstallprompt` listener captures the
// event Chrome / Edge fire once the install criteria are met. The
// command palette later reads the captured event via
// `triggerInstallPrompt()` so the "Install TP Studio…" entry has
// something to consume.
import './services/pwa/pwaInstall';
import { registerLaunchFileHandler } from './services/pwa/fileHandlers';
import { scheduleOfflineReadinessCheck } from './services/pwa/offlineReadiness';
import { scheduleOfflineWarmup } from './services/pwa/offlineWarmup';
import { requestPersistentStorage } from './services/pwa/persistentStorage';
import { initPwaUpdateToast } from './services/pwa/pwaUpdate';
import { installSystemScopeNudgeWatcher } from './services/systemScopeNudge';
import { maybeInstallTestHook } from './services/testHook';
import './styles/index.css';

// Make sure any pending debounced doc write lands before the tab closes or
// becomes hidden. Module-level — runs once at boot.
installFlushOnLifecycleEvents();
// Session 82 — install the Playwright test hook on `window` when the
// URL carries `?test=1`. No-op otherwise; production users never see it.
maybeInstallTestHook();
// Session 83 — fire a one-time CRT System Scope nudge toast on boot
// and on each doc swap. Self-suppresses once the user fills any scope
// field or dismisses (the toast auto-dismisses after the usual timeout
// and the per-doc flag prevents a re-show).
installSystemScopeNudgeWatcher();
// Session 89 — register the service worker and wire `onNeedRefresh`
// / `onOfflineReady` to the toast pipeline. Module-level so any
// existing tab picks up the new SW the next time the user opens
// the app. No-op during dev (`devOptions.enabled: false`).
initPwaUpdateToast();
// PWA file handling — if the OS launched TP Studio by opening a Flying Logic
// file (installed Chromium only), import it and open it in a new tab. No-op
// where the File Handling API is absent.
registerLaunchFileHandler();
// Ask the browser not to evict this origin. TP Studio keeps everything the
// user owns in best-effort storage — the diagrams in `localStorage`, the app
// shell in the SW cache — and the browser may reclaim both without warning
// (Chrome under storage pressure, iOS Safari after ~7 idle days). That single
// eviction reads to the user as "my work vanished AND the app stopped working
// offline", so it's worth asking once per boot. Fire-and-forget: a refusal is
// a normal outcome with nothing for the app (or the user) to do about it.
void requestPersistentStorage();
// Pull the lazily-loaded export/preview vendor chunks into the SW runtime
// cache once the tab is idle. They're excluded from the install-time precache
// on purpose (cold first paint), which used to leave PDF/PNG/PowerPoint export
// and the markdown preview dead offline until the user had run each one online
// at least once. Warming them after first paint keeps both properties.
scheduleOfflineWarmup();
// Verify that offline access actually works, and self-heal if it doesn't.
// A managed-Chrome report had both TP Studio and MECE Studio open to "No
// internet access" offline on the same machine — the signature of the
// origin's service worker cache being evicted or cleared on browser exit,
// not of a bad build. If we find a registered worker sitting on an empty
// precache while online, asking it to update re-runs install and puts the
// shell back. Once per load, never in a loop.
scheduleOfflineReadinessCheck();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
