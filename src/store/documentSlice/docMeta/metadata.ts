/**
 * Document-metadata edits — the bulk of docMetaSlice's `applyDocChange`-driven
 * setters (title, layout config, system scope, EC verbal style, cloud type,
 * performance anchors, method checklist, warning resolution, core-problem
 * marker, custom entity classes) plus the two get/set-direct actions that don't
 * push history (`markSystemScopeNudgeShown`, `commitThreeCloudDiagnosis`).
 *
 * Most setters share the same shape: drop-on-default + a no-op short-circuit so
 * an untouched doc round-trips through JSON unchanged and history coalesces.
 */

import { buildThreeCloudCoreDoc, type ThreeCloudInput } from '@/domain/threeCloud';
import type {
  CloudType,
  CustomEntityClass,
  EntityId,
  LayoutConfig,
  Patch,
  SystemScope,
  TPDocument,
} from '@/domain/types';
import { persistDebounced } from '@/services/storage/persistDebounced';
import { setActiveDoc } from '../../activeDoc';
import { currentDoc } from '../../selectors';
import { touch } from '../docMutate';
import type { DocMetaFactoryDeps } from './shared';

export type MetadataActions = {
  setTitle: (title: string) => void;
  setDocumentMeta: (patch: { author?: string; description?: string }) => void;
  /** Session 83 — flip the per-doc System Scope nudge flag without
   *  pushing a history entry. Used by `systemScopeNudge` after the
   *  toast fires so the nudge doesn't re-show on subsequent doc
   *  swaps. */
  markSystemScopeNudgeShown: () => void;
  /** E3 — build a Core Cloud document from a completed 3-Cloud rapid diagnosis,
   *  open it (honouring `openDocsInNewTab`), and dismiss the wizard overlay. */
  commitThreeCloudDiagnosis: (input: ThreeCloudInput) => void;
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
   * clears the field rather than persisting a redundant value.
   */
  setECVerbalStyle: (style: 'neutral' | 'twoSided') => void;
  /**
   * Phase 1 (TP completeness #1) — set the Cloud progression label on the
   * active EC doc. Passing `undefined` clears it (the implicit "untyped"
   * default). Coalesces under `doc-cloud-type`.
   */
  setCloudType: (cloudType: CloudType | undefined) => void;
  /**
   * Phase 3 (TP completeness #5) — set the gap-analysis performance anchors on
   * the active doc: `performanceLow` (current / unacceptable level) and
   * `performanceHigh` (target / desired level). A blank value clears the field.
   */
  setPerformanceLow: (value: string) => void;
  setPerformanceHigh: (value: string) => void;
  /**
   * Phase 2b (TP completeness #2 — U-Shape) — toggle the user-set "core
   * problem" marker on an entity (the U-Shape hinge; undoable).
   */
  toggleCoreProblem: (entityId: EntityId) => void;
  /**
   * B10 — add or replace a custom entity class on the active doc. The `id`
   * field on the class is the map key; passing an existing id overwrites that
   * class. Slug rules are enforced at the persistence boundary.
   */
  upsertCustomEntityClass: (entityClass: CustomEntityClass) => void;
  /**
   * B10 — remove a custom entity class by id. Entities currently typed as this
   * class are NOT auto-retyped: they render via `resolveEntityTypeMeta`'s
   * "unknown" fallback until the user picks a different type.
   */
  removeCustomEntityClass: (id: string) => void;
};

export function createMetadataActions({
  get,
  set,
  applyDocChange,
}: DocMetaFactoryDeps): MetadataActions {
  return {
    commitThreeCloudDiagnosis: (input) => {
      // E3 — turn a completed rapid diagnosis into a Core Cloud document and
      // open it (honouring the new-tab preference, exactly like loading any
      // doc). The builder is pure; this action owns the tab-open and dismissing
      // the wizard overlay so the panel just gathers input and fires once.
      const doc = buildThreeCloudCoreDoc(input);
      get().openDocInTab(doc);
      get().closeThreeCloud();
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

    setCloudType: (cloudType) => {
      applyDocChange(
        (prev) => {
          // `undefined` clears the tag (implicit "untyped") — drop the field
          // rather than persisting it.
          if (cloudType === undefined) {
            if (prev.cloudType === undefined) return prev;
            const { cloudType: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          if (prev.cloudType === cloudType) return prev;
          return touch({ ...prev, cloudType });
        },
        { coalesceKey: 'doc-cloud-type' }
      );
    },

    setPerformanceLow: (value) => {
      applyDocChange(
        (prev) => {
          // Blank clears the anchor (implicit "unset") — drop the field rather
          // than persisting an empty string.
          if (value.trim().length === 0) {
            if (prev.performanceLow === undefined) return prev;
            const { performanceLow: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          if (prev.performanceLow === value) return prev;
          return touch({ ...prev, performanceLow: value });
        },
        { coalesceKey: 'doc-perf-low' }
      );
    },

    setPerformanceHigh: (value) => {
      applyDocChange(
        (prev) => {
          if (value.trim().length === 0) {
            if (prev.performanceHigh === undefined) return prev;
            const { performanceHigh: _drop, ...rest } = prev;
            return touch(rest as TPDocument);
          }
          if (prev.performanceHigh === value) return prev;
          return touch({ ...prev, performanceHigh: value });
        },
        { coalesceKey: 'doc-perf-high' }
      );
    },

    toggleCoreProblem: (entityId) => {
      applyDocChange((prev) => {
        const e = prev.entities[entityId];
        if (!e) return prev;
        if (e.coreProblem) {
          const { coreProblem: _drop, ...rest } = e;
          return touch({ ...prev, entities: { ...prev.entities, [entityId]: rest } });
        }
        return touch({
          ...prev,
          entities: { ...prev.entities, [entityId]: { ...e, coreProblem: true } },
        });
      });
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
}
