import { useMemo } from 'react';

/**
 * `useMemo` keyed off a single string fingerprint.
 *
 * Several heavy memos (`validate(doc)`, `computeLayout(...)`) gate their
 * recompute on a string fingerprint that hashes only the doc fields the
 * computation depends on — not the doc reference itself, which changes
 * on every mutation. Plain `useMemo(fn, [doc])` would recompute on
 * title-only edits even though the result doesn't depend on the title.
 *
 * Writing this as plain `useMemo(fn, [fingerprint])` works but requires
 * a `// biome-ignore lint/correctness/useExhaustiveDependencies` comment
 * at every call site because the linter doesn't see the closed-over doc
 * read as covered by the fingerprint. This hook centralizes that
 * contract: callers pass the fingerprint explicitly, the contract is
 * the function name itself, and the linter sees a single-dep memo with
 * no missing dependencies.
 *
 * Example:
 *
 *     const fp = validationFingerprint(doc);
 *     const warnings = useFingerprintMemo(() => validate(doc), fp);
 */
export function useFingerprintMemo<T>(compute: () => T, fingerprint: string): T {
  // biome-ignore lint/correctness/useExhaustiveDependencies: by design — the contract is that `compute` may close over anything covered by `fingerprint`. The hook's name advertises this.
  return useMemo(compute, [fingerprint]);
}
