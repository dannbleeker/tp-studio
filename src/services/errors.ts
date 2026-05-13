/**
 * Defensive error-message extraction for `catch (err)` blocks.
 *
 * `try { … } catch (err)` types `err` as `unknown` under TS strict mode.
 * The pattern `(err as Error).message` works for native throws but
 * silently produces `"undefined"` when something throws a string, a
 * plain object, `null`, or `undefined` — and the user sees a confusing
 * blank toast. Centralizing the unwrap means a future change to the
 * fallback ("Unknown error") propagates everywhere, and we get a
 * single grep-target for "where do we surface error text to users".
 */
export const errorMessage = (err: unknown, fallback = 'Unknown error'): string => {
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === 'string' && err.trim()) {
    return err;
  }
  // Plain objects, numbers, booleans, null, undefined — none have a
  // meaningful `.message`, so produce the fallback rather than a
  // misleading "[object Object]" or "undefined" toast.
  return fallback;
};
