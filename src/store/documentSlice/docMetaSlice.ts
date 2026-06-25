import type { StateCreator } from 'zustand';
import { createDocument } from '@/domain/factory';
import { loadAllTabsWithStatus, type TabsLoadResult } from '@/domain/persistence';
import type { DocumentId, TPDocument } from '@/domain/types';
import { type ActiveDocFields, activeDocState } from '../activeDoc';
import type { RootStore } from '../types';
import { type CrossDocLinkActions, createCrossDocLinkActions } from './docMeta/crossDocLinks';
import { createMetadataActions, type MetadataActions } from './docMeta/metadata';
import { createTabActions, type TabActions } from './docMeta/tabs';
import { makeApplyDocChange } from './docMutate';

/**
 * Top-level document state — the `doc` field itself plus the boot-time tab
 * restore + recovery signal. The actions are composed from three focused
 * sub-modules under `docMeta/` (Session 190 — split from one 1029-line file,
 * mirroring `entitiesSlice` + `entities/`): the tab engine + document swaps
 * (`tabs.ts`), the metadata setters (`metadata.ts`), and cross-doc linking
 * (`crossDocLinks.ts`). The slice presented to Zustand stays ONE flat object,
 * so `useDocumentStore` selectors are unchanged.
 *
 * The `doc` field has one owner here — the other sub-slices (entities, edges,
 * groups) call `applyDocChange` to mutate `doc` but don't define it.
 */
export type DocMetaSlice = {
  /** The active tab's working document — canonical write target. What
   *  `currentDoc(state)` returns and what every read site subscribes to.
   *  Kept in lockstep with `docs[activeDocId]` via `setActiveDoc`. */
  doc: TPDocument;
  /** Multi-doc tabs — the open-document map (one entry per open tab),
   *  keyed by id. The tab engine (`openTab` / `switchTab` / `closeTab` /
   *  `reorderTabs` / `duplicateTab`, Batch 5.1) maintains it; the
   *  invariant `docs[activeDocId] === doc` always holds. See
   *  `src/store/activeDoc.ts` + `docs/MULTI_DOC_TABS_PLAN.md`. */
  docs: Record<DocumentId, TPDocument>;
  /** Which entry in `docs` is the active tab. Always `=== doc.id`. */
  activeDocId: DocumentId;
  /** Left-to-right tab-strip ordering (one id per open tab). */
  tabOrder: DocumentId[];
  /** Session 184 — bumped whenever the SAVED set changes in a way the open
   *  tabs don't reflect (a closed-tree delete / "Forget closed documents"), so
   *  the Start library (`useSavedTrees`) re-scans storage. */
  savedDocsVersion: number;
} & TabActions &
  MetadataActions &
  CrossDocLinkActions;

/**
 * Build the boot-time active-doc state from a multi-doc load (Batch 5.4).
 * Restores ALL open tabs (`docs` + `tabOrder` + `activeDocId`) so a reload
 * brings back every open tab, not just the active one. Falls back to a
 * single fresh CRT when nothing usable was stored (first run / cleared /
 * all bodies lost). Per-tab undo history isn't persisted across reload, so
 * restored tabs boot with empty `past` / `future` (the data-only defaults).
 */
export const tabStateFromLoad = (load: TabsLoadResult): ActiveDocFields => {
  const active = load.activeDocId ? load.docs[load.activeDocId] : undefined;
  if (load.activeDocId && active && load.tabOrder.length > 0) {
    return { doc: active, docs: load.docs, activeDocId: load.activeDocId, tabOrder: load.tabOrder };
  }
  return activeDocState(createDocument('crt'));
};

// Batch 5.4 — boot rebuilds the FULL tab set from the manifest + per-doc
// slots, so a reload restores every open tab (not just the active one).
const initialLoad = loadAllTabsWithStatus();
const initialTabState = tabStateFromLoad(initialLoad);

/**
 * FL-EX9 — boot-time recovery signal. The App component reads this on
 * first render and shows a toast if the previous session didn't shut
 * down cleanly. Module-level rather than store-state because (a) it's
 * read once at mount, never mutated; (b) the store creator runs before
 * the React tree, so we don't have a `showToast` callback yet.
 */
export const bootRecoveryStatus: {
  recoveredFromBackup: boolean;
  recoveredFromLiveDraftOnly: boolean;
} = {
  recoveredFromBackup: initialLoad.recoveredFromBackup,
  recoveredFromLiveDraftOnly: initialLoad.recoveredFromLiveDraftOnly,
};

/**
 * Data-only defaults for this sub-slice. Tests reset via the unified
 * `documentDefaults()` in `./index.ts`, which composes from here.
 *
 * Batch 2.1 — returns the full active-doc field set (`doc` + `docs` +
 * `activeDocId` + `tabOrder`) built around one fresh document so the
 * single-tab invariant holds the moment a test resets the store.
 */
export const docMetaDefaults = (): Pick<
  DocMetaSlice,
  'doc' | 'docs' | 'activeDocId' | 'tabOrder' | 'savedDocsVersion'
> => ({ ...activeDocState(createDocument('crt')), savedDocsVersion: 0 });

export const createDocMetaSlice: StateCreator<RootStore, [], [], DocMetaSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);
  const deps = { get, set, applyDocChange };

  return {
    ...initialTabState,
    savedDocsVersion: 0,
    ...createTabActions(deps),
    ...createMetadataActions(deps),
    ...createCrossDocLinkActions(deps),
  };
};
