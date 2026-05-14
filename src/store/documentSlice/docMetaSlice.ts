import { createDocument } from '@/domain/factory';
import { loadFromLocalStorageWithStatus } from '@/domain/persistence';
import type {
  CustomEntityClass,
  DiagramType,
  LayoutConfig,
  SystemScope,
  TPDocument,
} from '@/domain/types';
import { flushPersist, persistDebounced } from '@/services/persistDebounced';
import type { StateCreator } from 'zustand';
import { pushHistoryEntry } from '../historySlice';
import { autoSnapshotOutgoing } from '../revisionsSlice';
import type { RootStore } from '../types';
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
  doc: TPDocument;
  setDocument: (doc: TPDocument) => void;
  newDocument: (diagramType: DiagramType) => void;
  setTitle: (title: string) => void;
  setDocumentMeta: (patch: { author?: string; description?: string }) => void;
  /** Session 83 — flip the per-doc System Scope nudge flag without
   *  pushing a history entry. Used by `systemScopeNudge` after the
   *  toast fires so the nudge doesn't re-show on subsequent doc
   *  swaps. */
  markSystemScopeNudgeShown: () => void;

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
  setLayoutConfig: (patch: LayoutConfig | undefined) => void;

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

const initialLoad = loadFromLocalStorageWithStatus();
const initialDoc = initialLoad.doc ?? createDocument('crt');

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
 */
export const docMetaDefaults = (): Pick<DocMetaSlice, 'doc'> => ({
  doc: createDocument('crt'),
});

/**
 * FL-EX8 — sync the active workspace tab's `id` + `title` with the new
 * doc. Called by `setDocument` / `newDocument` so the tab bar reflects
 * loaded / imported / freshly-created docs without a separate
 * caller-side update. A no-op when the workspace hasn't been
 * initialized yet (no tabs).
 */
const syncActiveTabToDoc = (
  get: () => RootStore,
  set: (s: Partial<RootStore>) => void,
  newDoc: TPDocument
): void => {
  const ws = get().workspace;
  if (!ws || ws.tabs.length === 0) return;
  const activeIdx = ws.tabs.findIndex((t) => t.id === ws.activeTabId);
  if (activeIdx === -1) return;
  const nextTabs = ws.tabs.slice();
  nextTabs[activeIdx] = { id: newDoc.id, title: newDoc.title };
  set({
    workspace: {
      ...ws,
      tabs: nextTabs,
      activeTabId: newDoc.id,
    },
  });
};

export const createDocMetaSlice: StateCreator<RootStore, [], [], DocMetaSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);

  return {
    doc: initialDoc,

    setDocument: (doc) => {
      const prev = get().doc;
      // H1 — capture the outgoing doc as a revision so the user can roll
      // back. Suppressed when the swap is itself a revision restore (the
      // restore path captures its own safety snapshot first). Skipped
      // when the outgoing doc is empty (no entities and the title is
      // still "Untitled") — a brand-new fresh-boot doc has nothing
      // worth snapshotting.
      autoSnapshotOutgoing(prev, 'document swap');
      // Document swap is explicit user intent — persist synchronously.
      persistDebounced(doc);
      flushPersist();
      set({
        doc,
        selection: { kind: 'none' },
        editingEntityId: null,
        past: pushHistoryEntry(get().past, { doc: prev, t: Date.now() }),
        future: [],
      });
      // FL-EX8 — keep the active tab in sync with the swapped doc.
      syncActiveTabToDoc(get, set, doc);
      // Refresh the revisions panel view: it's keyed by the active doc id,
      // and that just changed.
      get().reloadRevisionsForActiveDoc();
    },

    newDocument: (diagramType) => {
      const prev = get().doc;
      autoSnapshotOutgoing(prev, `new ${diagramType} document`);
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
      persistDebounced(doc);
      flushPersist();
      set({
        doc,
        selection: { kind: 'none' },
        editingEntityId: null,
        past: pushHistoryEntry(get().past, { doc: prev, t: Date.now() }),
        future: [],
      });
      // FL-EX8 — keep the active tab in sync with the new doc.
      syncActiveTabToDoc(get, set, doc);
      get().reloadRevisionsForActiveDoc();
      // Session 78: open the creation wizard panel when the diagram
      // type has one AND the user hasn't turned it off. Goal Tree +
      // EC are the two that have a wizard today.
      if (diagramType === 'goalTree' && get().showGoalTreeWizard) {
        get().openCreationWizard('goalTree');
      } else if (diagramType === 'ec' && get().showECWizard) {
        get().openCreationWizard('ec');
      } else {
        // Closing covers the case where a wizard from a previous doc
        // was open; switching to a non-wizardable diagram clears it.
        get().closeCreationWizard();
      }
    },

    setTitle: (title) => {
      applyDocChange((prev) => touch({ ...prev, title }), { coalesceKey: 'doc-title' });
      // FL-EX8 — push the new title into the active tab's cached
      // title so the tab bar reflects rename-in-place.
      get().syncActiveTabTitle();
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
      const prev = get().doc;
      if (prev.systemScopeNudgeShown) return;
      const next = touch({ ...prev, systemScopeNudgeShown: true });
      persistDebounced(next);
      set({ doc: next });
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
          return touch({ ...prev, layoutConfig: next });
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
