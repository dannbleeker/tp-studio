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
 */

import { useMemo } from 'react';
import { propagateStates } from '@/domain/statePropagation';
import type { EntityId, EntityState } from '@/domain/types';
import { useDocumentStore } from '@/store';

export function usePropagatedStates(): Record<EntityId, EntityState> {
  const entities = useDocumentStore((s) => s.doc.entities);
  const edges = useDocumentStore((s) => s.doc.edges);
  return useMemo(() => propagateStates({ entities, edges }), [entities, edges]);
}
