import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { installFlushOnLifecycleEvents } from './services/persistDebounced';
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

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found in index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
