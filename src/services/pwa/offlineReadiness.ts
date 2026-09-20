/**
 * Is offline access actually working right now — and if not, can we fix
 * it before the user needs it?
 *
 * Field evidence (managed corporate Chrome, both TP Studio and MECE
 * Studio installed): both apps opened to "No internet access" offline on
 * the same machine, on the same day. MECE Studio's precache is 26 entries
 * / 0.59 MiB with zero failures, so an oversized install — the TP Studio
 * problem this session also fixes — cannot explain it. The shared
 * mechanism has to be that the origin's service worker registration
 * and/or Cache Storage was simply *gone* by the time he opened the app:
 * evicted under storage pressure, or cleared on browser exit by
 * enterprise policy.
 *
 * Be honest about the limit: if policy clears site data every session, no
 * code here makes the app work offline — the worker is deleted before it
 * can matter. What code *can* do is stop contributing to the problem
 * (see `persistentStorage.ts` and the precache shrink in `vite.config.ts`)
 * and repair the state the moment the user is next online. This module is
 * the repair half.
 *
 * The signature we look for is narrow on purpose: a worker is registered,
 * but its precache is missing or near-empty. That is a failed or wiped
 * install — a healthy origin has ~90 precache entries. It is NOT the same
 * as "Cache Storage was unreadable", which a locked-down profile also
 * produces; we report that as unknown and touch nothing, because firing a
 * repair at an origin we cannot inspect is how you build a retry loop.
 *
 * This module logs and returns data. It deliberately owns no user-facing
 * copy: what (if anything) to tell the user is a UI decision made
 * elsewhere, against the typed result below.
 */

import { log } from '../logger';
import { runWhenIdle } from './idle';

/** Workbox names its precache `workbox-precache-v2-<origin>`. */
const PRECACHE_NAME_PATTERN = /^workbox-precache/;

/**
 * A healthy install is ~90 entries. Comparing against a threshold rather
 * than an exact count means a build that adds or drops a file doesn't
 * turn every user's boot into a spurious repair — the only thing we are
 * trying to tell apart is "populated" from "empty or barely there".
 */
const MIN_HEALTHY_PRECACHE_ENTRIES = 10;

/** What the boot check concluded, and what it did about it. */
export type OfflineReadinessAction =
  /** No service worker API in this browser — offline was never on offer. */
  | 'unsupported'
  /** Nothing registered yet. Registration is `pwaUpdate.ts`'s job, not ours. */
  | 'not-registered'
  /** Cache Storage could not be read, so we can't tell. Nothing done. */
  | 'unknown'
  /** Precache looks populated. Nothing to do. */
  | 'healthy'
  /** Precache missing or near-empty while online — `update()` was requested. */
  | 'repair-requested'
  /** Same, but `update()` itself threw. */
  | 'repair-failed'
  /** Precache missing or near-empty, but we're offline — nothing to repair from. */
  | 'repair-deferred';

export type OfflineReadiness = {
  /** `serviceWorker` exists on `navigator`. */
  supported: boolean;
  /** A registration exists for this scope. */
  registered: boolean;
  /** That registration has an *activated* worker, i.e. it can serve fetches. */
  activated: boolean;
  /**
   * Entries found across the workbox precache(s), or `null` when Cache
   * Storage was absent or rejected. `null` and `0` mean different things
   * and callers must not conflate them.
   */
  precachedEntries: number | null;
  action: OfflineReadinessAction;
};

/**
 * Memoised so the check — and any repair it triggers — happens at most
 * once per page load. A genuinely broken origin must report once and stop,
 * not spin.
 */
let readiness: Promise<OfflineReadiness> | null = null;

/** Never throws: an unavailable or rejecting registration reads as "none". */
async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch (err) {
    log.warn('Offline readiness: could not read the service worker registration', err);
    return undefined;
  }
}

/**
 * Count entries across every workbox precache. Returns `null` — not `0` —
 * when the API is absent or rejects, so "we looked and it was empty" stays
 * distinguishable from "we could not look".
 */
async function countPrecachedEntries(): Promise<number | null> {
  // Each call is guarded separately: managed Chrome and private windows
  // variously omit `caches`, throw on `keys()`, or resolve `open()` and
  // then reject the read.
  if (typeof caches === 'undefined') return null;
  let names: string[];
  try {
    names = await caches.keys();
  } catch (err) {
    log.warn('Offline readiness: Cache Storage keys unreadable', err);
    return null;
  }

  const precacheNames = names.filter((name) => PRECACHE_NAME_PATTERN.test(name));
  if (precacheNames.length === 0) return 0;

  let total = 0;
  for (const name of precacheNames) {
    try {
      const cache = await caches.open(name);
      total += (await cache.keys()).length;
    } catch (err) {
      // One unreadable cache among several is still enough to say
      // "we could not inspect this origin" — don't report a short count
      // that would look like a wiped install and trigger a needless repair.
      log.warn(`Offline readiness: cache "${name}" unreadable`, err);
      return null;
    }
  }
  return total;
}

async function evaluate(): Promise<OfflineReadiness> {
  if (!('serviceWorker' in navigator)) {
    return {
      supported: false,
      registered: false,
      activated: false,
      precachedEntries: null,
      action: 'unsupported',
    };
  }

  const registration = await getRegistration();
  const base = {
    supported: true,
    registered: registration !== undefined,
    activated: registration?.active != null,
  };

  if (registration === undefined) {
    return { ...base, precachedEntries: null, action: 'not-registered' };
  }

  const precachedEntries = await countPrecachedEntries();
  if (precachedEntries === null) {
    return { ...base, precachedEntries, action: 'unknown' };
  }
  if (precachedEntries >= MIN_HEALTHY_PRECACHE_ENTRIES) {
    return { ...base, precachedEntries, action: 'healthy' };
  }

  // Registered but empty: a failed or wiped install. Only actionable
  // online — `update()` re-fetches the worker script and re-runs install,
  // which needs the network.
  if (navigator.onLine === false) {
    log.info(
      `Offline readiness: precache holds ${precachedEntries} entries but we're offline — deferring repair`
    );
    return { ...base, precachedEntries, action: 'repair-deferred' };
  }

  try {
    await registration.update();
    log.info(
      `Offline readiness: precache held ${precachedEntries} entries — requested a fresh install`
    );
    return { ...base, precachedEntries, action: 'repair-requested' };
  } catch (err) {
    log.warn('Offline readiness: service worker update failed', err);
    return { ...base, precachedEntries, action: 'repair-failed' };
  }
}

/**
 * Inspect offline readiness, repairing an empty precache if that is what
 * we find. Runs at most once per page load; never throws.
 */
export function checkOfflineReadiness(): Promise<OfflineReadiness> {
  readiness ??= evaluate();
  return readiness;
}

/** Run the readiness check once the browser reports an idle moment. */
export function scheduleOfflineReadinessCheck(): void {
  // Idle rather than immediate, so the check sees the registration that
  // `initPwaUpdateToast()` kicks off on the same boot rather than racing it.
  runWhenIdle(() => {
    void checkOfflineReadiness();
  });
}

/** Test-only: clear the memoised result so each case starts cold. */
export function __resetOfflineReadinessForTest(): void {
  readiness = null;
}
