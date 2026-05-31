/**
 * Session 135 / spec gap #4 Phase 1B — propagated-state subscription
 * hook.
 *
 * Wraps `propagateStates` with React + Zustand plumbing:
 *   - Subscribes to ONLY `doc.entities` + `doc.edges` so unrelated
 *     doc mutations (title edit, layout knob, scope text) don't
 *     re-trigger propagation.
 *   - Memoizes the result so the propagation pass runs once per
 *     entities/edges reference change, not once per consumer render.
 *
 * Consumers ask `derived[id]` and get the entity's derived state
 * (`'unknown'` when no edges contribute). Apply manual override via
 * `effectiveState(entity, derived)` from `@/domain/statePropagation`.
 *
 * Phase 1C — when a speculation overlay is active, it's threaded into
 * the engine so `derived` reflects the *hypothetical* cascade. The
 * overlay is UI-only and never mutates the doc; flipping it triggers
 * one re-propagation. Non-speculation sessions (`overlay === null`)
 * compute exactly as Phase 1B did.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { propagateStates } from '@/domain/statePropagation';
import type { EntityId, EntityState } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

export function usePropagatedStates(): Record<EntityId, EntityState> {
  // One shallow-equal bundle instead of three separate subscriptions: same
  // re-render triggers (a change to the entities / edges / overlay reference),
  // but one store walk per update instead of three.
  const { entities, edges, overlay } = useDocumentStore(
    useShallow((s) => {
      const doc = currentDoc(s);
      return { entities: doc.entities, edges: doc.edges, overlay: s.speculationOverlay };
    })
  );
  return useMemo(
    () => propagateStates({ entities, edges }, overlay ?? undefined),
    [entities, edges, overlay]
  );
}
