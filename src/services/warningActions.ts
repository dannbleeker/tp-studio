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
  const goals = Object.values(doc.entities).filter((e) => e.type === 'goal');
  if (goals.length <= 1) return;
  // Sort by `annotationNumber` (per-doc monotonic counter assigned at
  // creation) — survives multiple entities created in the same
  // millisecond, unlike `createdAt`, which can collide.
  const sorted = goals.slice().sort((a, b) => a.annotationNumber - b.annotationNumber);
  const apex = sorted[0]!;
  for (const goal of sorted) {
    if (goal.id === apex.id) continue;
    store.updateEntity(goal.id, { type: 'criticalSuccessFactor' });
  }
};

export const WARNING_ACTIONS: Record<string, WarningActionHandler> = {
  'convert-extra-goals-to-csfs': convertExtraGoalsToCsfs,
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
