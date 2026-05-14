// Session 89 — wire the vite-plugin-pwa service worker into the
// existing toast pipeline. We use `registerType: 'prompt'` over in
// `vite.config.ts` so users explicitly opt in to refreshing — silent
// background reloads are an anti-pattern for a diagramming tool where
// the user might have unsaved canvas state.
//
// Flow:
//   1. `registerSW` (from the plugin-generated virtual module) hooks
//      the new SW into `navigator.serviceWorker`.
//   2. When the SW detects a new build's precache list:
//      • `onOfflineReady` fires once on first-ever install — tells the
//        user the app now works offline (a meaningful capability).
//      • `onNeedRefresh` fires on every subsequent update — surfaces
//        a toast with an action button that calls `updateSW(true)`,
//        which triggers `skipWaiting` on the waiting SW and reloads.
//   3. The user can dismiss the toast; the next natural reload picks
//      up the new SW anyway, so the worst case is "one cold reload
//      later than expected".
//
// The module-level `registered` guard guarantees we never wire the
// hook twice, even if `initPwaUpdateToast` is imported in tests or
// re-invoked via hot reload.

import { registerSW } from 'virtual:pwa-register';
import { useDocumentStore } from '@/store';

let registered = false;

export const initPwaUpdateToast = (): void => {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  const updateSW = registerSW({
    onNeedRefresh: () => {
      useDocumentStore.getState().showToast('info', 'New version of TP Studio is available.', {
        action: {
          label: 'Refresh now',
          run: () => {
            void updateSW(true);
          },
        },
      });
    },
    onOfflineReady: () => {
      useDocumentStore.getState().showToast('success', 'TP Studio is ready to use offline.');
    },
  });
};

// Test hook — vitest needs a way to clear the module-level guard so
// the first-call branch can be re-exercised across tests. Production
// callers should never reach for this.
export const __resetPwaUpdateForTest = (): void => {
  registered = false;
};
