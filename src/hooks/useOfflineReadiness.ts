import { useEffect, useState } from 'react';

/**
 * Whether the service worker is actually in a position to serve the app shell
 * when the network disappears.
 *
 * - `active`       — a worker is installed AND controlling this page. Offline
 *                    should work.
 * - `waiting`      — a worker exists but nothing is serving *this document*
 *                    yet: still installing, waiting behind
 *                    `registerType: 'prompt'`, or activated without ever
 *                    claiming this page. One refresh away from `active`.
 * - `unregistered` — registration never happened (or was cleared).
 * - `unsupported`  — no Service Worker API at all.
 */
export type ServiceWorkerStatus = 'active' | 'waiting' | 'unregistered' | 'unsupported';

/** yes / no / "the browser would not tell us". */
export type ReadinessTriState = 'yes' | 'no' | 'unknown';

export interface OfflineReadiness {
  /** False until the first probe resolves, so the UI can say "checking…". */
  probed: boolean;
  serviceWorker: ServiceWorkerStatus;
  /**
   * Entries in the workbox precache. `0` is the smoking gun for "shell does
   * not load offline"; `null` means Cache Storage itself was unreadable.
   */
  precachedEntries: number | null;
  /** `navigator.storage.persisted()` — 'no' means the browser may evict us. */
  persisted: ReadinessTriState;
  /** Bytes this origin currently occupies, or `null` when unavailable. */
  usageBytes: number | null;
}

const UNPROBED: OfflineReadiness = {
  probed: false,
  serviceWorker: 'unsupported',
  precachedEntries: null,
  persisted: 'unknown',
  usageBytes: null,
};

/**
 * Every probe below is individually try/caught and resolves to a "don't know"
 * value rather than rejecting. These four APIs are variously absent (older
 * Safari, jsdom), restricted (insecure origins) or outright rejecting (a
 * private window, or a browser with site data blocked) — and a diagnostics
 * panel that throws is worse than no panel at all.
 */

async function probeServiceWorker(): Promise<ServiceWorkerStatus> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'unregistered';
    // A worker that EXISTS is not a worker that is SERVING THIS PAGE, and this
    // panel is asked the second question. With `registerType: 'prompt'` there
    // is no `clientsClaim`, so a first load — and every load on a profile that
    // clears site data on exit — activates a worker that never controls the
    // document it installed from. `registration.active` is truthy there while
    // fetches bypass the worker entirely: the panel said "Active", enabled
    // "Download now", and quoted a size for a press that provably could not
    // cache a byte. `offlineWarmup.ts` already draws exactly this distinction
    // and defers on `!navigator.serviceWorker.controller`; the two now agree.
    //
    // `waiting` is the honest answer, and already means what this is: a worker
    // exists, it is not serving you, one refresh fixes it. Reporting it also
    // keeps the re-probe below running, so the row flips to `active` by itself
    // the moment the handover happens.
    if (registration.active && navigator.serviceWorker.controller) return 'active';
    if (registration.active || registration.waiting || registration.installing) return 'waiting';
    return 'unregistered';
  } catch {
    return 'unsupported';
  }
}

async function probePrecachedEntries(): Promise<number | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const names = await caches.keys();
    // Workbox names its precache `workbox-precache-v2-<scope>`. Matching on
    // the substring rather than the exact name keeps this working across
    // workbox versions and scope changes; the runtime caches
    // (`tp-studio-*`) are deliberately excluded — they say nothing about
    // whether the SHELL installed.
    const precacheNames = names.filter((name) => name.includes('precache'));
    let total = 0;
    for (const name of precacheNames) {
      const cache = await caches.open(name);
      total += (await cache.keys()).length;
    }
    return total;
  } catch {
    return null;
  }
}

async function probePersisted(): Promise<ReadinessTriState> {
  try {
    if (typeof navigator === 'undefined') return 'unknown';
    const storage = navigator.storage as StorageManager | undefined;
    if (typeof storage?.persisted !== 'function') return 'unknown';
    return (await storage.persisted()) ? 'yes' : 'no';
  } catch {
    return 'unknown';
  }
}

async function probeUsageBytes(): Promise<number | null> {
  try {
    if (typeof navigator === 'undefined') return null;
    const storage = navigator.storage as StorageManager | undefined;
    if (typeof storage?.estimate !== 'function') return null;
    const estimate = await storage.estimate();
    return typeof estimate.usage === 'number' ? estimate.usage : null;
  } catch {
    return null;
  }
}

/** Run all four probes; never rejects. Exported for direct unit testing. */
export async function probeOfflineReadiness(): Promise<OfflineReadiness> {
  const [serviceWorker, precachedEntries, persisted, usageBytes] = await Promise.all([
    probeServiceWorker(),
    probePrecachedEntries(),
    probePersisted(),
    probeUsageBytes(),
  ]);
  return { probed: true, serviceWorker, precachedEntries, persisted, usageBytes };
}

/**
 * How long to wait before looking again while a worker could still show up.
 * Long enough not to be a spin, short enough that a dialog left open catches
 * an activation the user is waiting on.
 */
const REPROBE_DELAY_MS = 3_000;

/**
 * Read-only snapshot of offline readiness, re-taken while the component is
 * mounted (the About dialog, which only mounts while it is open — so this is
 * not a background poll).
 *
 * Read-only on purpose, and that is what keeps it separate from
 * `services/pwa/offlineReadiness.ts` despite the overlapping probes: that one
 * runs ONCE per boot, is memoised, and *repairs* an empty precache by asking
 * the worker to update. A panel the user can reopen must not carry a side
 * effect, and must re-read rather than replay a boot-time snapshot — "is it
 * fixed now?" is the question they will reopen it to ask. Requesting
 * persistence and registering/updating the worker stay over there.
 *
 * The point: the user can screenshot one panel and we can tell whether the
 * worker installed, whether the precache populated, and whether storage was
 * evicted.
 */
export function useOfflineReadiness(reprobeKey: unknown = null): OfflineReadiness {
  const [readiness, setReadiness] = useState<OfflineReadiness>(UNPROBED);

  // `reprobeKey` is not read by the effect — it IS the trigger. Re-running when
  // it changes is the entire contract, so the rule's "more dependencies than
  // necessary" reading is inverted here: removing it restores the stale-panel bug
  // the dependency exists to fix. Suppressed rather than worked around, because
  // every alternative (a ref, a counter read inside the body) hides the trigger.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reprobeKey is the trigger, not an input — see above.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const probe = (): void => {
      void probeOfflineReadiness().then((next) => {
        if (cancelled) return;
        setReadiness(next);
        // A first visit opens this panel BEFORE the worker finishes activating,
        // and the extras control is disabled until it has. Probing once at
        // mount meant the panel described a state that stopped being true a
        // second later and stayed wrong for the whole dialog session.
        //
        // Re-probe only while a worker could still arrive — `waiting` and
        // `unregistered`. `active` is the answer we were waiting for, and
        // `unsupported` means the API is absent, which no amount of waiting
        // fixes. So this stops on its own rather than polling forever.
        const mayStillArrive =
          next.serviceWorker === 'waiting' || next.serviceWorker === 'unregistered';
        if (mayStillArrive) timer = window.setTimeout(probe, REPROBE_DELAY_MS);
      });
    };
    probe();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
    // `reprobeKey` lets the caller force a fresh reading when it knows the
    // answer just changed. The probe stops once a worker is `active`, which is
    // right for "is a worker serving me" but wrong for the byte counts beside
    // it: a completed top-up moved "Cached size" and the precache count, and
    // without this the panel went on quoting pre-download figures that
    // contradicted the extras row it had just refreshed.
  }, [reprobeKey]);

  return readiness;
}
