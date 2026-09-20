import { useEffect, useState } from 'react';

/**
 * Whether the service worker is actually in a position to serve the app shell
 * when the network disappears.
 *
 * - `active`       — a worker is installed and serving. Offline should work.
 * - `waiting`      — a worker exists but nothing is serving yet (still
 *                    installing, or waiting behind `registerType: 'prompt'`).
 *                    One refresh away from `active`.
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
    // `active` is the only state that serves fetches. A worker that is merely
    // installing or waiting (the `registerType: 'prompt'` case) is reported as
    // `waiting` precisely because the user has to refresh before it helps.
    if (registration.active) return 'active';
    if (registration.waiting || registration.installing) return 'waiting';
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
 * Read-only snapshot of offline readiness, taken once when the component
 * mounts (the About dialog, which only mounts while it is open — so this is
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
export function useOfflineReadiness(): OfflineReadiness {
  const [readiness, setReadiness] = useState<OfflineReadiness>(UNPROBED);

  useEffect(() => {
    let cancelled = false;
    void probeOfflineReadiness().then((next) => {
      if (!cancelled) setReadiness(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return readiness;
}
