/**
 * Session 94 (Top-30 #30) — convenience wrapper for the
 * `useDocumentStore(useShallow(s => ({ ... })))` pattern.
 *
 * 18 components currently spell out the pairing in full:
 *
 *   const x = useDocumentStore(useShallow(s => ({ a: s.a, b: s.b })))
 *
 * `useStoreSlice` collapses that to:
 *
 *   const x = useStoreSlice(s => ({ a: s.a, b: s.b }))
 *
 * Saves one import + one parameter per site. Functionally identical —
 * shallow comparison still runs on the returned record. The selector
 * still must return either primitives or stable references (nested
 * objects break shallow equality; see TPEdge's mutexCoords for the
 * canonical example of how to handle that).
 *
 * Why not call this `useShallowStore`: too easy to misread as "use a
 * shallow STORE." `useStoreSlice` reads as "give me a slice of the
 * store" which is what callers actually want.
 *
 * Existing call sites can migrate organically — there's no functional
 * difference, only an ergonomic one.
 */
import { useDocumentStore } from '@/store';
import type { RootStore } from '@/store/types';
import { useShallow } from 'zustand/shallow';

export function useStoreSlice<T>(selector: (state: RootStore) => T): T {
  return useDocumentStore(useShallow(selector));
}
