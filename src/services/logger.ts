/**
 * Tiny wrapper around the `console.*` calls the codebase makes from
 * production paths. Centralizing gives one knob to:
 *
 *   - **Silence in tests.** Vitest runs with `import.meta.env.MODE === 'test'`,
 *     so the logger no-ops there — keeps "expected error during test"
 *     console noise out of the run output.
 *   - **Route to remote logging.** A future Sentry / Honeycomb integration
 *     hooks here once, not at every `console.error` call site.
 *
 * Two methods today: `warn` and `error`. Add `info`/`debug` only when a
 * caller needs them — keeping the surface minimal makes the "where do
 * we log?" question easier to answer.
 *
 * Callers should pass a short summary string and any structured payload
 * separately so a future remote hook can serialize the payload cleanly:
 *
 *     log.error('Storage write failed', err, { key, size });
 */

const isTestEnv = (): boolean => {
  // Vitest sets `MODE === 'test'`. If `import.meta.env` isn't available
  // (e.g. a pure Node script importing this module), assume non-test
  // and log. The browser-side path is the one that matters for the
  // "silence in tests" goal.
  try {
    return import.meta.env?.MODE === 'test';
  } catch {
    return false;
  }
};

const enabled = !isTestEnv();

export const log = {
  warn(summary: string, ...rest: unknown[]): void {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.warn(summary, ...rest);
  },
  error(summary: string, ...rest: unknown[]): void {
    if (!enabled) return;
    // eslint-disable-next-line no-console
    console.error(summary, ...rest);
  },
};
