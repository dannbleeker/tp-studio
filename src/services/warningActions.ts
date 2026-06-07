import { defaultEntityType } from '@/domain/entityPalettes';
import { entitiesOfType } from '@/domain/graph';
import { spawnECFromConflict } from '@/domain/spawnEC';
import type { TPDocument, Warning } from '@/domain/types';
import type { RootStore } from '@/store/types';

/**
 * Session 79 — registry of one-click remedies for CLR warnings.
 *
 * Warning objects can carry an optional `action: { actionId, label }`.
 * When the user clicks the action button in `WarningsList`, this
 * registry's handler runs with the live document and the warning
 * payload, dispatching whatever store mutations the remedy requires.
 *
 * Handlers are pure plumbing — they don't render, don't toast, don't
 * navigate. The component that calls them is responsible for any
 * post-action UI feedback.
 */

export type WarningActionHandler = (store: RootStore, doc: TPDocument, warning: Warning) => void;

/**
 * Action: convert every `goal` entity on a Goal Tree EXCEPT the
 * oldest into a `criticalSuccessFactor`. Used by the
 * `goalTree-multiple-goals` warning. Sort key is `(createdAt asc, id
 * asc)` so the warning's anchor stays stable across re-validations.
 */
const convertExtraGoalsToCsfs: WarningActionHandler = (store, doc) => {
  if (doc.diagramType !== 'goalTree') return;
  const goals = entitiesOfType(doc, 'goal');
  if (goals.length <= 1) return;
  // Sort by `annotationNumber` (per-doc monotonic counter assigned at
  // creation) — survives multiple entities created in the same
  // millisecond, unlike `createdAt`, which can collide. `.slice()`
  // copies the cached by-type array before sorting.
  const sorted = goals.slice().sort((a, b) => a.annotationNumber - b.annotationNumber);
  const apex = sorted[0]!;
  for (const goal of sorted) {
    if (goal.id === apex.id) continue;
    store.updateEntity(goal.id, { type: 'criticalSuccessFactor' });
  }
};

/**
 * Action: seed a fresh Evaporating Cloud from the warning's anchor entity and
 * open it in a new tab. Used by `crt-tied-core-drivers` — when two root causes
 * tie for the most UDEs, a conflict often sits beneath the tree; this surfaces
 * it via the same `spawnECFromConflict` the palette command uses. `openDocInTab`
 * is a store action (it adds + activates a tab); the CRT stays in its own tab.
 */
const spawnEcFromConflict: WarningActionHandler = (store, doc, warning) => {
  if (warning.target.kind !== 'entity') return;
  store.openDocInTab(spawnECFromConflict(doc, warning.target.id));
};

/**
 * Action: splice a blank intermediate entity into the flagged edge and open
 * it for editing, so the user can name the missing step. Used by the
 * `long-arrow` (E5) warning. Mirrors the `splice-into-edge` palette command:
 * add a fresh default-typed entity, splice it onto the edge, and roll the
 * entity back if the splice fails (self-loop / unknown edge — neither
 * reachable from a real warning, but defensive).
 */
const insertStep: WarningActionHandler = (store, doc, warning) => {
  if (warning.target.kind !== 'edge') return;
  const fresh = store.addEntity({ type: defaultEntityType(doc.diagramType), startEditing: true });
  const ok = store.spliceEntityIntoEdge(fresh.id, warning.target.id);
  if (!ok) store.deleteEntity(fresh.id);
};

export const WARNING_ACTIONS: Record<string, WarningActionHandler> = {
  'convert-extra-goals-to-csfs': convertExtraGoalsToCsfs,
  'spawn-ec-from-conflict': spawnEcFromConflict,
  'insert-step': insertStep,
};

/**
 * Dispatch a warning's action by id. Returns `true` when an action
 * actually fired, `false` when no handler is registered (the caller
 * can then surface a "no-op" toast).
 */
export const runWarningAction = (store: RootStore, doc: TPDocument, warning: Warning): boolean => {
  if (!warning.action) return false;
  const handler = WARNING_ACTIONS[warning.action.actionId];
  if (!handler) return false;
  handler(store, doc, warning);
  return true;
};
