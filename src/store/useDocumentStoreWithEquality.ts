import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useDocumentStore } from '.';
import type { RootStore } from './types';

/**
 * Session 135 / Perf #7+#8 — `useDocumentStore` variant that accepts a
 * custom equality function. Zustand v5 dropped the second-arg
 * equalityFn from the bound `create()` store; `useShallow` from
 * `zustand/shallow` is the public alternative, but it does
 * `Object.is` per array element — which fails as soon as a selector
 * returns an array of fresh objects (the common case for derived
 * selectors that build `{id, title}` triples).
 *
 * `useStoreWithEqualityFn` from `zustand/traditional` is the v5 way
 * back to the v4 second-arg behaviour. This thin wrapper binds it to
 * `useDocumentStore`'s API + leaves the selector + equality
 * signature exactly like v4's classic pattern, so call sites read
 * naturally:
 *
 * ```ts
 * const triples = useDocumentStoreWith(
 *   (s) => deriveTriples(s.doc),
 *   tripleArrayShallowEqual,
 * );
 * ```
 *
 * The component re-renders only when the equality fn says the
 * derived value actually changed. Use `arrayShallowEqualByKeys` from
 * `equality.ts` for the common "array of small objects with a known
 * key set" case.
 */
export function useDocumentStoreWith<U>(
  selector: (state: RootStore) => U,
  equalityFn: (a: U, b: U) => boolean
): U {
  return useStoreWithEqualityFn(useDocumentStore, selector, equalityFn);
}
