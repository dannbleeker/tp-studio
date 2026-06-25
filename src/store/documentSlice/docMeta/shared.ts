/**
 * Shared dependencies threaded into the docMeta sub-slice factories.
 * `docMetaSlice.ts` owns the parent `StateCreator`; the factories receive a
 * closure bag (`get` / `set` / `applyDocChange`) so they don't each rebuild
 * `makeApplyDocChange`. The slice presented to Zustand stays ONE flat object,
 * so `useDocumentStore` selectors are unchanged. Mirrors `entities/shared.ts`.
 */

import type { RootStore } from '../../types';
import type { ApplyDocChange } from '../docMutate';

export type DocMetaFactoryDeps = {
  get: () => RootStore;
  set: (partial: Partial<RootStore>) => void;
  applyDocChange: ApplyDocChange;
};
