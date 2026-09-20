/**
 * Ask the browser to mark this origin's storage as *persistent*.
 *
 * TP Studio is local-first: the user's diagrams live in `localStorage`
 * and the app shell lives in the service worker's cache. Both sit in the
 * same best-effort storage bucket, which the browser is free to evict —
 * Chrome under storage pressure, iOS Safari after roughly seven days
 * without a visit. That eviction is the most plausible cause of the
 * "it worked offline, then one day it didn't" report: the shell and the
 * documents disappear together, silently, and the user reads it as the
 * app breaking rather than the browser reclaiming space.
 *
 * `navigator.storage.persist()` is the only lever a page has here. It is
 * cheap, needs no UI, and in Chromium is granted automatically once the
 * app is installed or sufficiently engaged with; Firefox prompts; Safari
 * grants on install. A refusal is a normal outcome, not an error — the
 * app keeps working exactly as before, it is just evictable again.
 *
 * Deliberately *not* surfaced to the user: there is no decision for them
 * to make (the browser owns the prompt) and no action to take on a
 * refusal, so a toast would be noise. The outcome goes to the console via
 * the logger, which is enough to answer a support question after the fact.
 */

import { log } from '../logger';

export type PersistentStorageOutcome = 'persisted' | 'already-persisted' | 'denied' | 'unsupported';

/**
 * Cached across calls so repeated invocations (boot plus any future
 * caller) neither re-prompt the user nor re-hit the Storage API. The
 * promise — not the resolved value — is memoised so concurrent callers
 * share the single in-flight request.
 */
let outcome: Promise<PersistentStorageOutcome> | null = null;

async function ask(): Promise<PersistentStorageOutcome> {
  // jsdom has no `navigator.storage` at all, and older Safari ships the
  // object without `persist`. Feature-detect both members rather than the
  // container, so a partial implementation degrades to 'unsupported'
  // instead of throwing at call time.
  const storage: StorageManager | undefined = navigator.storage;
  if (typeof storage?.persisted !== 'function' || typeof storage.persist !== 'function') {
    log.info('Persistent storage: unsupported by this browser');
    return 'unsupported';
  }

  try {
    // Check before asking. Once an origin is persistent it stays that way,
    // and calling `persist()` again on Firefox can re-surface the
    // permission prompt for a permission the user already granted.
    if (await storage.persisted()) {
      log.info('Persistent storage: already granted');
      return 'already-persisted';
    }

    const granted = await storage.persist();
    log.info(`Persistent storage: ${granted ? 'granted' : 'denied'}`);
    return granted ? 'persisted' : 'denied';
  } catch (err) {
    // Some browsers reject rather than resolve `false` in an insecure or
    // sandboxed context. That is indistinguishable from a refusal as far
    // as the app is concerned, so report it as one.
    log.info('Persistent storage: request failed, treating as denied', err);
    return 'denied';
  }
}

/**
 * Request persistent storage once per page load. Never throws — every
 * failure path resolves to an outcome the caller can ignore.
 */
export function requestPersistentStorage(): Promise<PersistentStorageOutcome> {
  outcome ??= ask();
  return outcome;
}

/** Test-only: clear the memoised result so each case starts cold. */
export function __resetPersistentStorageForTest(): void {
  outcome = null;
}
