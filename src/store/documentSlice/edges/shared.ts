/**
 * Shared dependencies threaded into the edges sub-slice factories.
 * `edgesSlice.ts` owns the parent `StateCreator`; the factories receive a
 * closure bag (`get` / `set` / `applyDocChange`) so they don't each rebuild
 * `makeApplyDocChange`. Mirrors `entities/shared.ts`.
 */

import type { RootStore } from '../../types';
import type { ApplyDocChange } from '../docMutate';

export type EdgesFactoryDeps = {
  get: () => RootStore;
  set: (partial: Partial<RootStore>) => void;
  applyDocChange: ApplyDocChange;
};
