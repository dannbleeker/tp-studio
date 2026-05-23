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
//
// Session 135 — added `checkForUpdate()` for the `Check for updates`
// palette command, so users can force a check instead of waiting for
// the browser's natural cadence. `updateSW` is hoisted to module scope
// so the manual-check path can re-surface the "Refresh now" toast when
// an update is already waiting (e.g. the user dismissed the earlier
// prompt and wants it back).

import { registerSW } from 'virtual:pwa-register';
import { useDocumentStore } from '@/store';

let registered = false;
let cachedUpdateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/** Render the canonical "New version… Refresh now" toast. Shared by the
 *  plugin's `onNeedRefresh` callback and the manual check command's
 *  already-waiting branch. */
const showUpdateAvailableToast = (): void => {
  const refresh = cachedUpdateSW;
  useDocumentStore.getState().showToast('info', 'New version of TP Studio is available.', {
    // Session 91 — bump dwell well past the info default so the user
    // has time to read + decide. The Refresh button is rendered with
    // `prominent: true` styling (filled, not outline) since the call-
    // to-action is the whole point of this toast.
    ...(refresh
      ? {
          action: {
            label: 'Refresh now',
            run: () => {
              void refresh(true);
            },
            prominent: true,
          },
        }
      : {}),
    durationMs: 15000,
  });
};

export const initPwaUpdateToast = (): void => {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  cachedUpdateSW = registerSW({
    onNeedRefresh: () => {
      showUpdateAvailableToast();
    },
    onOfflineReady: () => {
      useDocumentStore.getState().showToast('success', 'TP Studio is ready to use offline.');
    },
  });
};

/**
 * Outcome of a manual `Check for updates` action:
 *   - `'unsupported'`     — no service-worker API / no registration yet
 *     (jsdom, plain `http://`, fresh first visit before the SW lands).
 *   - `'already-pending'` — an update was already waiting; the prompt
 *     has been re-surfaced via the existing "Refresh now" toast so the
 *     command itself doesn't need an extra "found" message.
 *   - `'newly-found'`     — `registration.update()` fetched a new SW
 *     that's now installing / waiting; the plugin's `onNeedRefresh`
 *     hook will fire its prompt when the install completes.
 *   - `'up-to-date'`      — the check completed with no new worker.
 */
export type UpdateCheckResult = 'unsupported' | 'already-pending' | 'newly-found' | 'up-to-date';

/**
 * Session 135 — force a service-worker update check.
 *
 * Normally the browser checks for a new SW on each page load + every
 * ~24h on its own cadence. This lets the user trigger one on demand
 * (palette command `Check for updates`).
 *
 * The branching mirrors `UpdateCheckResult`'s four outcomes; the caller
 * (palette command) chooses the right toast for each.
 */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return 'unsupported';
  // Already waiting — the user likely dismissed the earlier prompt.
  // Resurface the canonical "Refresh now" toast and report the state so
  // the caller doesn't double-up with a generic "found update" toast.
  if (reg.waiting) {
    showUpdateAvailableToast();
    return 'already-pending';
  }
  try {
    await reg.update();
  } catch {
    return 'unsupported';
  }
  // After `update()` resolves the fetch, the new SW (if any) is in
  // `installing` or has already advanced to `waiting`. Either way it's
  // on the way — `onNeedRefresh` will fire its prompt once it lands.
  if (reg.installing || reg.waiting) return 'newly-found';
  return 'up-to-date';
};

// Test hook — vitest needs a way to clear the module-level guard so
// the first-call branch can be re-exercised across tests. Production
// callers should never reach for this.
export const __resetPwaUpdateForTest = (): void => {
  registered = false;
  cachedUpdateSW = null;
};
