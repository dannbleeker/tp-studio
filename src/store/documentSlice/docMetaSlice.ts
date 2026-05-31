import type { StateCreator } from 'zustand';
import { createDocument } from '@/domain/factory';
import { newDocumentId } from '@/domain/ids';
import {
  importFromJSON,
  loadAllTabsWithStatus,
  persistTabsManifest,
  removeDocFromStorage,
  saveDocToLocalStorage,
  type TabsLoadResult,
} from '@/domain/persistence';
import type {
  CustomEntityClass,
  DiagramType,
  DocumentId,
  LayoutConfig,
  Patch,
  SystemScope,
  TPDocument,
} from '@/domain/types';
import { flushPersist, persistDebounced } from '@/services/storage/persistDebounced';
import { type ActiveDocFields, activeDocState, setActiveDoc } from '../activeDoc';
import { applyTabSwitchHistory, pushHistoryEntry, stashHistory } from '../historySlice';
import { autoSnapshotOutgoing } from '../revisionsSlice';
import { currentDoc } from '../selectors';
import type { RootStore } from '../types';
import { speculationDefaults } from '../uiSlice/speculationSlice';
import { makeApplyDocChange, touch } from './docMutate';

/**
 * Top-level document state: the `doc` field itself plus the actions that
 * swap or restructure the whole document (setDocument, newDocument), edit
 * its metadata (setTitle, setDocumentMeta), or toggle CLR warning
 * resolution.
 *
 * Lives in its own sub-slice so the `doc` field has one owner — the other
 * sub-slices (entities, edges, groups) call `applyDocChange` to mutate
 * `doc` but don't define it.
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
  setDocument: (doc: TPDocument) => void;
  newDocument: (diagramType: DiagramType) => void;
  setTitle: (title: string) => void;
  setDocumentMeta: (patch: { author?: string; description?: string }) => void;
  /** Session 83 — flip the per-doc System Scope nudge flag without
   *  pushing a history entry. Used by `systemScopeNudge` after the
   *  toast fires so the nudge doesn't re-show on subsequent doc
   *  swaps. */
  markSystemScopeNudgeShown: () => void;

  // ── Multi-doc tabs (Phase 5, Batch 5.1) — the tab engine ─────────────
  /** Open `doc` in a NEW tab and activate it. The current tab stays open;
   *  its undo/redo stacks are parked in `historyByDoc`. */
  openTab: (doc: TPDocument) => void;
  /** Switch the active tab to `id` (no-op if already active or unknown).
   *  Swaps the live undo/redo stacks (via `applyTabSwitchHistory`) and
   *  drops any speculation overlay (locked decision #5). */
  switchTab: (id: DocumentId) => void;
  /** Close tab `id`. If it was active, activates the right-hand neighbour
   *  (clamped); if it was the last tab, opens a fresh blank CRT so there is
   *  never zero tabs. Drops the closed doc's per-doc storage slots. */
  closeTab: (id: DocumentId) => void;
  /** Reorder the tab strip. `order` must be a permutation of `tabOrder`;
   *  a non-permutation is ignored. */
  reorderTabs: (order: DocumentId[]) => void;
  /** Duplicate tab `id` into a new tab (fresh doc id, deep content copy,
   *  `(copy)` appended to the title) and activate it (locked decision #4). */
  duplicateTab: (id: DocumentId) => void;
  /** Session 138 (Batch 5.3) — open `doc` honouring the
   *  `openDocsInNewTab` preference: a NEW tab when enabled (default,
   *  returns `true`), otherwise replace the active document via
   *  `setDocument` (returns `false`). The boolean lets a caller tailor
   *  its post-load toast — a new tab is "undone" by closing it, so an
   *  "Undo" that restores the previous doc only makes sense in replace
   *  mode. */
  openDocInTab: (doc: TPDocument) => boolean;

  resolveWarning: (warningId: string) => void;
  unresolveWarning: (warningId: string) => void;

  /**
   * Block A — set or clear the document's per-doc layout configuration.
   * Passing `undefined` (or `{}`) wipes the doc-level override so the
   * diagram renders with the default dagre knobs again. The patch is
   * merged with the existing config so partial updates (e.g. just changing
   * `direction`) don't reset the other fields.
   *
   * The setter coalesces under one history key (`doc-layout`) so dragging
   * the compactness slider through 20 intermediate values collapses to a
   * single undo step.
   */
  // Session 117 — `Patch<LayoutConfig>` (rather than `LayoutConfig`)
  // so callers can pass `{ field: undefined }` to clear a specific
  // entry. The runtime delete-on-undefined loop below handles the
  // actual clearing; this type just lets the call sites compile.
  setLayoutConfig: (patch: Patch<LayoutConfig> | undefined) => void;

  /**
   * Patch the document's System Scope capture. Passing `undefined` for a
   * field clears it; passing an empty string clears it; non-empty strings
   * persist. Coalesces under `doc-scope` so typing into a textarea
   * collapses into one undo step per field.
   */
  setSystemScope: (patch: Partial<SystemScope>) => void;

  /**
   * Toggle one method-checklist step on the active document. Unchecked
   * steps are stored as absent keys (we never persist `false`) so the
   * JSON exports stay clean — `done=false` clears the key entirely.
   */
  setMethodStep: (stepId: string, done: boolean) => void;

  /**
   * Session 87 / EC PPT comparison item #4 — set the EC verbal style
   * on the active document. Passing `'neutral'` (the implicit default)
   * clears the field rather than persisting a redundant value, so a
   * doc that hasn't touched the toggle round-trips through JSON
   * unchanged. Coalesces under `doc-ec-verbal` so a rapid toggle
   * sequence collapses to a single undo step.
   */
  setECVerbalStyle: (style: 'neutral' | 'twoSided') => void;

  /**
   * B10 — add or replace a custom entity class on the active doc. The
   * `id` field on the class is the map key; passing an existing id
   * overwrites that class (label / color / supersetOf update in place).
   * The slug rules (lowercased, [a-z0-9-]+, no collision with a
   * built-in EntityType) are enforced at the persistence boundary —
   * the store accepts whatever the caller provides; the UI is
   * responsible for validating before calling this.
   */
  upsertCustomEntityClass: (entityClass: CustomEntityClass) => void;

  /**
   * B10 — remove a custom entity class by id. Entities currently typed
   * as this class are NOT auto-retyped: they continue to render via
   * `resolveEntityTypeMeta`'s "unknown" fallback (label = the id,
   * neutral stripe colour). The user can pick a different type from
   * the Inspector after the class is gone; this lets the user
   * experiment with class shapes without losing entity references.
   */
  removeCustomEntityClass: (id: string) => void;
};

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
  'doc' | 'docs' | 'activeDocId' | 'tabOrder'
> => activeDocState(createDocument('crt'));

/**
 * The per-doc *ephemeral* UI state that must reset whenever the active
 * document changes. Every field keys off the *previous* doc's
 * entities/edges — the selection's ids, the editing-entity id, the
 * walkthrough's targetIds, the speculation overlay's entity→state map, and
 * `searchMatchIndex` (an index into the active doc's match list) — so
 * carrying any of it into a different document is a bug. Each doc-change
 * action (`setDocument` / `newDocument` / `openTab` / `switchTab` /
 * `closeTab`) spreads this, so a new action physically can't forget one.
 *
 * History (`past` / `future`) is deliberately NOT here — each caller swaps
 * or pushes it differently (tab park/restore vs. a single undo entry).
 */
const activeDocEphemeralReset = () => ({
  selection: { kind: 'none' as const },
  editingEntityId: null,
  walkthrough: { kind: 'closed' as const },
  searchMatchIndex: 0,
  ...speculationDefaults(),
});

export const createDocMetaSlice: StateCreator<RootStore, [], [], DocMetaSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);

  // Shared "swap the active document" sequence used by `setDocument` and
  // `newDocument`: snapshot the outgoing doc as a revision (suppressed on a
  // restore swap; skipped for an empty fresh-boot doc), persist the incoming
  // doc synchronously (explicit user intent), rebuild the single-tab
  // map/order around it + reset ephemeral UI state, push the outgoing doc onto
  // history, and refresh the revisions panel. Extracted so the two callers
  // can't drift out of sync.
  const performDocumentSwap = (doc: TPDocument, reason: string): void => {
    const prev = currentDoc(get());
    autoSnapshotOutgoing(prev, reason);
    persistDebounced(doc);
    flushPersist();
    set({
      ...setActiveDoc(get(), doc),
      ...activeDocEphemeralReset(),
      past: pushHistoryEntry(get().past, { doc: prev, t: Date.now() }),
      future: [],
    });
    get().reloadRevisionsForActiveDoc();
  };

  return {
    ...initialTabState,

    setDocument: (doc) => {
      performDocumentSwap(doc, 'document swap');
    },

    newDocument: (diagramType) => {
      const base = createDocument(diagramType);
      // FL-TO3: seed the fresh doc with the user's preferred layout
      // direction when set. `'auto'` falls back to the diagram-type
      // default (BT/TB/etc.). Manual-layout diagrams (EC) ignore the
      // field at render time, so seeding it is harmless there.
      const pref = get().defaultLayoutDirection;
      const doc =
        pref && pref !== 'auto'
          ? { ...base, layoutConfig: { ...(base.layoutConfig ?? {}), direction: pref } }
          : base;
      performDocumentSwap(doc, `new ${diagramType} document`);
      // Session 78: open the creation wizard panel when the diagram
      // type has one AND the user hasn't turned it off. Goal Tree +
      // EC are the two that have a wizard today.
      //
      // Session 135 / spec gap #9 Phase 1C — Guided mode forces the
      // wizards to surface even when the per-diagram suppress flag
      // is off. The user explicitly opted into the hand-holding flow
      // by switching to Guided; honour that over their dismissed-by-
      // default state. Expert / Workshop / Presentation keep the
      // user's persisted flag as-is.
      const guidedOverride = get().appMode === 'guided';
      if (diagramType === 'goalTree' && (get().showGoalTreeWizard || guidedOverride)) {
        get().openCreationWizard('goalTree');
      } else if (diagramType === 'ec' && (get().showECWizard || guidedOverride)) {
        get().openCreationWizard('ec');
      } else if (diagramType === 'crt' && (get().showCRTWizard || guidedOverride)) {
        // Session 136 — CRT wizard parallel to GT / EC. Walks the
        // user through capturing the first three UDEs; the causal
        // chain back to a root cause is the user's work.
        get().openCreationWizard('crt');
      } else {
        // Closing covers the case where a wizard from a previous doc
        // was open; switching to a non-wizardable diagram clears it.
        get().closeCreationWizard();
      }
    },

    setTitle: (title) => {
      applyDocChange((prev) => touch({ ...prev, title }), { coalesceKey: 'doc-title' });
    },

    setDocumentMeta: (patch) => {
      const keys = Object.keys(patch).sort().join(',');
      applyDocChange((prev) => touch({ ...prev, ...patch }), { coalesceKey: `doc-meta:${keys}` });
    },

    markSystemScopeNudgeShown: () => {
      // Bypass `applyDocChange` deliberately — this flag flip isn't
      // an undoable user action, so pushing a history entry would be
      // noise (Cmd+Z would "un-show" a toast that's already gone).
      // Persist directly so the flag survives the next reload.
      const prev = currentDoc(get());
      if (prev.systemScopeNudgeShown) return;
      const next = touch({ ...prev, systemScopeNudgeShown: true });
      persistDebounced(next);
      // Same id as `prev` (content-only flag flip) so `setActiveDoc`
      // refreshes the active tab's doc in place; other tabs, activeDocId,
      // and tabOrder are unchanged.
      set(setActiveDoc(get(), next));
    },

    // ── Multi-doc tabs (Phase 5, Batch 5.1) — the tab engine ─────────────
    openTab: (doc) => {
      const state = get();
      // Persist the outgoing tab before leaving it: flush any pending
      // debounced write, then force-commit its body — a never-edited tab
      // has no pending write to flush, and its body must be in storage for
      // a reload to restore it (Batch 5.4).
      flushPersist();
      saveDocToLocalStorage(state.doc);
      const tabOrder = [...state.tabOrder, doc.id];
      set({
        doc,
        docs: { ...state.docs, [doc.id]: doc },
        activeDocId: doc.id,
        tabOrder,
        // Park the outgoing tab's live stacks; the new tab starts empty.
        historyByDoc: stashHistory(state.historyByDoc, state.activeDocId, {
          past: state.past,
          future: state.future,
        }),
        past: [],
        future: [],
        ...activeDocEphemeralReset(),
      });
      saveDocToLocalStorage(doc);
      persistTabsManifest({ activeDocId: doc.id, tabOrder });
      get().reloadRevisionsForActiveDoc();
    },

    switchTab: (id) => {
      const state = get();
      if (id === state.activeDocId) return;
      const target = state.docs[id];
      if (!target) return;
      // Persist the outgoing tab (force-commit, not just flush pending) so
      // a reload restores it (Batch 5.4).
      flushPersist();
      saveDocToLocalStorage(state.doc);
      // Park the leaving tab's live stacks; promote the entering tab's.
      const swapped = applyTabSwitchHistory(
        state.historyByDoc,
        state.activeDocId,
        { past: state.past, future: state.future },
        id
      );
      set({
        doc: target,
        activeDocId: id,
        historyByDoc: swapped.historyByDoc,
        past: swapped.past,
        future: swapped.future,
        ...activeDocEphemeralReset(),
      });
      persistTabsManifest({ activeDocId: id, tabOrder: state.tabOrder });
      get().reloadRevisionsForActiveDoc();
    },

    closeTab: (id) => {
      const state = get();
      if (!state.docs[id]) return;
      const idx = state.tabOrder.indexOf(id);
      const remaining = state.tabOrder.filter((t) => t !== id);
      const { [id]: _closedDoc, ...docsRest } = state.docs;
      const { [id]: _closedHist, ...historyRest } = state.historyByDoc;
      flushPersist();

      // Last tab closed → never zero tabs; replace with a fresh blank CRT.
      if (remaining.length === 0) {
        const fresh = createDocument('crt');
        set({
          ...activeDocState(fresh),
          historyByDoc: {},
          past: [],
          future: [],
          ...activeDocEphemeralReset(),
        });
        saveDocToLocalStorage(fresh);
        persistTabsManifest({ activeDocId: fresh.id, tabOrder: [fresh.id] });
        removeDocFromStorage(id);
        get().reloadRevisionsForActiveDoc();
        return;
      }

      // Closing a background tab → active tab untouched.
      if (id !== state.activeDocId) {
        set({ docs: docsRest, tabOrder: remaining, historyByDoc: historyRest });
        persistTabsManifest({ activeDocId: state.activeDocId, tabOrder: remaining });
        removeDocFromStorage(id);
        return;
      }

      // Closing the active tab → activate the right-hand neighbour (clamped
      // to the new last tab when the closed tab was rightmost).
      const nextActiveId = remaining[Math.min(idx, remaining.length - 1)];
      const target = nextActiveId ? docsRest[nextActiveId] : undefined;
      if (!nextActiveId || !target) return;
      const restored = historyRest[nextActiveId] ?? { past: [], future: [] };
      const { [nextActiveId]: _nowLive, ...historyParked } = historyRest;
      set({
        doc: target,
        docs: docsRest,
        activeDocId: nextActiveId,
        tabOrder: remaining,
        historyByDoc: historyParked,
        past: restored.past,
        future: restored.future,
        ...activeDocEphemeralReset(),
      });
      persistTabsManifest({ activeDocId: nextActiveId, tabOrder: remaining });
      removeDocFromStorage(id);
      get().reloadRevisionsForActiveDoc();
    },

    reorderTabs: (order) => {
      const state = get();
      // Ignore anything that isn't a permutation of the current open set.
      if (order.length !== state.tabOrder.length || !order.every((tid) => state.docs[tid])) {
        return;
      }
      set({ tabOrder: order });
      persistTabsManifest({ activeDocId: state.activeDocId, tabOrder: order });
    },

    duplicateTab: (id) => {
      const src = get().docs[id];
      if (!src) return;
      // Deep copy via a JSON round-trip (validates + clones nested maps),
      // then a fresh id + `(copy)` title so the duplicate is fully
      // independent — its own history, persistence, share link (decision #4).
      const cloned = importFromJSON(JSON.stringify(src));
      const copy: TPDocument = {
        ...cloned,
        id: newDocumentId(),
        title: `${src.title} (copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      get().openTab(copy);
    },

    openDocInTab: (doc) => {
      // Decision #6 — loaded documents open in a new tab by default; the
      // `openDocsInNewTab` pref lets users restore the pre-tabs "replace
      // the active document" behavior. Returns whether a new tab opened.
      if (get().openDocsInNewTab) {
        get().openTab(doc);
        return true;
      }
      get().setDocument(doc);
      return false;
    },

    resolveWarning: (warningId) => {
      applyDocChange((prev) =>
        touch({
          ...prev,
          resolvedWarnings: { ...prev.resolvedWarnings, [warningId]: true },
        })
      );
    },

    unresolveWarning: (warningId) => {
      applyDocChange((prev) => {
        if (!prev.resolvedWarnings[warningId]) return prev;
        const { [warningId]: _removed, ...rest } = prev.resolvedWarnings;
        return touch({ ...prev, resolvedWarnings: rest });
      });
    },

    setLayoutConfig: (patch) => {
      applyDocChange(
        (prev) => {
          // `undefined` or an empty patch clears the override entirely.
          if (!patch || Object.keys(patch).length === 0) {
            if (prev.layoutConfig === undefined) return prev;
            const { layoutConfig: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          const next = { ...(prev.layoutConfig ?? {}), ...patch };
          // Drop fields that were explicitly set to undefined in the patch
          // (TypeScript-wise they're still keys; semantically they should
          // disappear so the dagre adapter falls back to defaults).
          for (const key of Object.keys(patch) as (keyof LayoutConfig)[]) {
            if (patch[key] === undefined) delete next[key];
          }
          // If the merged patch ended up empty (everything cleared), drop
          // the field entirely rather than persisting an empty object.
          if (Object.keys(next).length === 0) {
            if (prev.layoutConfig === undefined) return prev;
            const { layoutConfig: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          // No-op short-circuit: every patched field already matches.
          if (prev.layoutConfig) {
            let identical = true;
            for (const key of Object.keys(next) as (keyof LayoutConfig)[]) {
              if (prev.layoutConfig[key] !== next[key]) {
                identical = false;
                break;
              }
            }
            if (identical && Object.keys(next).length === Object.keys(prev.layoutConfig).length) {
              return prev;
            }
          }
          // After the delete-on-undefined loop above, `next` is
          // guaranteed to have no `undefined` values. Cast to
          // LayoutConfig to assert that to the exactOptional type
          // checker.
          return touch({ ...prev, layoutConfig: next as LayoutConfig });
        },
        { coalesceKey: 'doc-layout' }
      );
    },

    setSystemScope: (patch) => {
      const keys = Object.keys(patch).sort().join(',');
      applyDocChange(
        (prev) => {
          const current = prev.systemScope ?? {};
          const next: SystemScope = { ...current };
          let changed = false;
          for (const key of Object.keys(patch) as (keyof SystemScope)[]) {
            const value = patch[key];
            // Treat empty / whitespace-only strings as a clear so JSON
            // exports don't carry placeholder blanks.
            if (value === undefined || (typeof value === 'string' && value.trim() === '')) {
              if (next[key] !== undefined) {
                delete next[key];
                changed = true;
              }
            } else if (next[key] !== value) {
              next[key] = value;
              changed = true;
            }
          }
          if (!changed) return prev;
          if (Object.keys(next).length === 0) {
            if (prev.systemScope === undefined) return prev;
            const { systemScope: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          return touch({ ...prev, systemScope: next });
        },
        { coalesceKey: `doc-scope:${keys}` }
      );
    },

    setECVerbalStyle: (style) => {
      applyDocChange(
        (prev) => {
          // Treat 'neutral' as the implicit default — drop the field
          // rather than persisting it.
          if (style === 'neutral') {
            if (prev.ecVerbalStyle === undefined) return prev;
            const { ecVerbalStyle: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          if (prev.ecVerbalStyle === style) return prev;
          return touch({ ...prev, ecVerbalStyle: style });
        },
        { coalesceKey: 'doc-ec-verbal' }
      );
    },

    setMethodStep: (stepId, done) => {
      applyDocChange((prev) => {
        const current = prev.methodChecklist ?? {};
        if (done) {
          if (current[stepId] === true) return prev;
          return touch({
            ...prev,
            methodChecklist: { ...current, [stepId]: true },
          });
        }
        if (current[stepId] !== true) return prev;
        const { [stepId]: _removed, ...rest } = current;
        if (Object.keys(rest).length === 0) {
          // Drop the whole field rather than persisting an empty map.
          const { methodChecklist: _drop, ...docRest } = prev;
          return touch(docRest as TPDocument);
        }
        return touch({ ...prev, methodChecklist: rest });
      });
    },

    // ── B10: custom entity classes ──────────────────────────────────
    upsertCustomEntityClass: (entityClass) => {
      applyDocChange((prev) => {
        const existing = prev.customEntityClasses?.[entityClass.id];
        // No-op guard: identical entry → preserve history-coalesce
        // semantics.
        if (
          existing &&
          existing.label === entityClass.label &&
          existing.color === entityClass.color &&
          existing.hint === entityClass.hint &&
          existing.supersetOf === entityClass.supersetOf
        ) {
          return prev;
        }
        return touch({
          ...prev,
          customEntityClasses: {
            ...(prev.customEntityClasses ?? {}),
            [entityClass.id]: entityClass,
          },
        });
      });
    },

    removeCustomEntityClass: (id) => {
      applyDocChange((prev) => {
        if (!prev.customEntityClasses || !(id in prev.customEntityClasses)) return prev;
        const { [id]: _drop, ...rest } = prev.customEntityClasses;
        // Empty map collapses to undefined so the doc doesn't carry
        // a useless `customEntityClasses: {}` after the last class is
        // deleted.
        if (Object.keys(rest).length === 0) {
          const { customEntityClasses: _omit, ...docRest } = prev;
          return touch(docRest as TPDocument);
        }
        return touch({ ...prev, customEntityClasses: rest });
      });
    },
  };
};
