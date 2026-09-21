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
//        a toast whose action asks the waiting SW to `skipWaiting` and
//        then reloads the page itself. The reload is ours on purpose:
//        see `reloadWhenWorkerTakesOver` for why the plugin's own one
//        is unreachable on a page the worker is not serving.
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
// Deliberately typed WITHOUT the plugin's `reloadPage` parameter. In prompt
// mode vite-plugin-pwa names it `_reloadPage` and never reads it, so a
// signature advertising it invites exactly the assumption that left the toast
// below unable to do the one thing it promises.
let cachedUpdateSW: (() => Promise<void>) | null = null;

/**
 * How long to wait for the incoming worker to take over before reloading
 * regardless — long enough for a normal activation, short enough that the click
 * still feels like it did something.
 */
const RELOAD_FALLBACK_MS = 3000;

/**
 * Reload once the new worker takes over — and reload anyway if it never does.
 *
 * TP owns this rather than leaning on the plugin. The plugin's reload lives in a
 * `controlling` listener it attaches inside its private `showSkipWaitingPrompt`,
 * gated on workbox's `isUpdate` — which is `Boolean(navigator.serviceWorker.controller)`
 * sampled at register time. A page the worker is not serving fails that gate and
 * never receives `controllerchange` either: `registerType: 'prompt'` means no
 * `clientsClaim` (verified: `dist/sw.js` contains none), and a worker only claims
 * clients it already controls. The manual "Check for updates" path re-surfaces
 * this toast itself, so when another tab left a worker waiting, that listener was
 * never attached in this page at all. Either way "Refresh now" dismissed the
 * toast and left the user on the old build — the same defect fixed in the sibling
 * project, reachable here through the identical plugin path.
 *
 * Reloading twice is harmless (the first navigation wins), but the latch keeps
 * the timer from firing into a reload that already started.
 */
const reloadWhenWorkerTakesOver = (): void => {
  let reloaded = false;
  const reload = (): void => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  };
  const sw = typeof navigator === 'undefined' ? undefined : navigator.serviceWorker;
  if (typeof sw?.addEventListener === 'function') {
    sw.addEventListener('controllerchange', reload, { once: true });
  }
  setTimeout(reload, RELOAD_FALLBACK_MS);
};

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
              // Arm the reload BEFORE asking the worker to skip waiting, so a
              // fast handover cannot fire `controllerchange` before anyone is
              // listening for it.
              reloadWhenWorkerTakesOver();
              void refresh().catch(() => {
                // The reload is armed either way: a failed skip-waiting still
                // leaves the user better off on a fresh load than on a toast
                // they watched disappear.
              });
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
 *   - `'check-failed'`    — we could not complete the check. `update()` re-fetches
 *     the worker script over the network, so it rejects simply because you are
 *     offline; a managed profile can also reject the registration lookup itself.
 *     Distinct from `'unsupported'` because a worker provably EXISTS in this case
 *     and is the very thing serving the page — reporting "the service worker
 *     isn't running" is the one claim that is definitely false here.
 *   - `'already-pending'` — an update was already waiting; the prompt
 *     has been re-surfaced via the existing "Refresh now" toast so the
 *     command itself doesn't need an extra "found" message.
 *   - `'newly-found'`     — `registration.update()` fetched a new SW
 *     that's now installing / waiting; the plugin's `onNeedRefresh`
 *     hook will fire its prompt when the install completes.
 *   - `'up-to-date'`      — the check completed with no new worker.
 */
export type UpdateCheckResult =
  | 'unsupported'
  | 'check-failed'
  | 'already-pending'
  | 'newly-found'
  | 'up-to-date';

/**
 * Session 135 — force a service-worker update check.
 *
 * Normally the browser checks for a new SW on each page load + every
 * ~24h on its own cadence. This lets the user trigger one on demand
 * (palette command `Check for updates`).
 *
 * The branching mirrors `UpdateCheckResult`'s outcomes; the caller
 * (palette command) chooses the right toast for each.
 */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unsupported';
  }
  // A managed or locked-down profile rejects the lookup outright rather than
  // resolving null, and the palette command drops this promise (`run` is async
  // and nothing catches), so an unguarded rejection was a silent command plus an
  // unhandled rejection.
  let reg: ServiceWorkerRegistration | null;
  try {
    reg = (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return 'check-failed';
  }
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
    // NOT 'unsupported'. A registration resolved a few lines above, so a worker
    // exists and is serving this page; `update()` failed because it needs the
    // network. Reporting "the service worker isn't running" contradicted the
    // readiness panel in the same app and pointed the user at reinstalling or
    // clearing site data — which would take their locally stored diagrams with it.
    return 'check-failed';
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
