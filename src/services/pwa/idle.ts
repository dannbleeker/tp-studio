/**
 * One place to say "do this when the browser isn't busy".
 *
 * The PWA boot path has two background jobs — warming the offline cache
 * and checking that offline access actually works — and neither may
 * compete with first paint or with the user's first interaction. Both
 * want identical scheduling, so the knobs live here rather than being
 * re-picked (and drifting) per caller.
 */

/**
 * Deadline for `requestIdleCallback`. Without one, a tab that never goes
 * idle — a user who starts editing immediately — would never run the
 * task, and that engaged user is exactly the one most likely to need it.
 */
const IDLE_TIMEOUT_MS = 10_000;

/**
 * Delay used where `requestIdleCallback` is missing (Safari < 16). Long
 * enough to be clear of first paint, short enough that a tab closed after
 * a brief visit still had a chance to run.
 */
const FALLBACK_DELAY_MS = 3_000;

/** Run `task` at the next idle moment. Fire-and-forget; never throws. */
export function runWhenIdle(task: () => void): void {
  // Probe rather than trust the DOM typings: `requestIdleCallback` is
  // declared unconditionally but is genuinely absent on older Safari.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(task, { timeout: IDLE_TIMEOUT_MS });
  } else {
    window.setTimeout(task, FALLBACK_DELAY_MS);
  }
}
