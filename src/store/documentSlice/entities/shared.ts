/**
 * Shared dependencies threaded into the four entity sub-slice
 * factories. `entitiesSlice.ts` owns the parent `StateCreator`; the
 * factories receive a closure bag (`get` / `set` / `applyDocChange`)
 * so they don't each rebuild `makeApplyDocChange`.
 *
 * This keeps the slice presented to Zustand as ONE flat object (so
 * the consumer-visible shape and `useDocumentStore` selectors stay
 * unchanged), while the implementation is composed from four focused
 * files.
 */

import type { RootStore } from '../../types';
import type { ApplyDocChange } from '../docMutate';

export type EntityFactoryDeps = {
  get: () => RootStore;
  set: (partial: Partial<RootStore>) => void;
  applyDocChange: ApplyDocChange;
};
