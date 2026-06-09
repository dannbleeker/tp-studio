/**
 * Session 135 / Perf #7+#8 — equality helpers for `useDocumentStoreWith`.
 *
 * Zustand v5's `useShallow` does `Object.is` per array element, which
 * is fine for arrays of primitives but fails on arrays of freshly-
 * allocated `{...}` objects (which is what most derived selectors
 * produce). These helpers handle the common derived-array shapes
 * without forcing every call site to write a bespoke comparator.
 */

/**
 * Compare two arrays element-by-element using shallow object equality
 * on a fixed set of keys. Returns `true` when both arrays have the
 * same length AND every item-pair at the same index has matching
 * values for every key in `keys`.
 *
 * Use for derived selectors that return arrays of small homogeneous
 * objects, e.g. the row arrays returned by the `MultiInspector` /
 * `GroupInspector` selectors. The keys list is the contract: changing the
 * shape of the selector's items requires updating the keys array,
 * which surfaces the contract explicitly.
 */
export const arrayShallowEqualByKeys =
  <T extends Record<string, unknown>>(keys: readonly (keyof T)[]) =>
  (a: readonly T[], b: readonly T[]): boolean => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const ai = a[i];
      const bi = b[i];
      if (ai === bi) continue;
      if (!ai || !bi) return false;
      for (const key of keys) {
        if (!Object.is(ai[key], bi[key])) return false;
      }
    }
    return true;
  };

/**
 * Compare two arrays of primitive values (strings / numbers / booleans)
 * by length + `Object.is` per element. Equivalent to what
 * `useShallow` does on an array of primitives, exposed here so a
 * selector that returns one of these can use `useDocumentStoreWith`
 * directly without pulling in `useShallow`.
 */
export const primitiveArrayEqual = <T>(a: readonly T[], b: readonly T[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
};
