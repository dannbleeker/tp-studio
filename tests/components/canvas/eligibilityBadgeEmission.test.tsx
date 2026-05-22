import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useGraphNodeEmission } from '@/components/canvas/hooks/useGraphNodeEmission';
import type { GraphPositions } from '@/components/canvas/hooks/useGraphPositions';
import type { GraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import { propagateStates } from '@/domain/statePropagation';
import type { TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

/**
 * Session 135 — at-a-glance action-eligibility badge. `useGraphNodeEmission`
 * stamps `data.eligibility` onto Action nodes ONLY when the
 * `showActionEligibility` toggle is on (passed as the last arg) and the
 * action has a precondition slot. These tests lock that gate + the folded
 * status; the badge rendering itself is exercised by the TPNode suite.
 */

/** Build the canonical TT step: action A + precondition P both feed
 *  outcome O. P is `true`, so the step is eligible. */
const seedStep = () => {
  resetIds();
  const action = makeEntity({ type: 'action', title: 'Do it' });
  const precond = makeEntity({ type: 'effect', title: 'Ready', state: 'true' });
  const outcome = makeEntity({ type: 'effect', title: 'Done' });
  const doc = makeDoc(
    [action, precond, outcome],
    [makeEdge(action.id, outcome.id), makeEdge(precond.id, outcome.id)]
  );
  return { action, precond, outcome, doc };
};

// Minimal projection for a no-groups doc: the group + collapsed-root loops
// are skipped, so only the visible-entity set + the (empty) collapser map
// are read. Cast the partial shape — the rest is unused here.
const projectionFor = (doc: TPDocument): GraphProjection =>
  ({
    proj: { groupToCollapsedRoot: new Map() },
    visibleEntityIds: new Set(Object.keys(doc.entities)),
    visibleCollapsedRoots: [],
    hoistVisibleGroups: new Set(),
    remap: (id: string) => id,
    hiddenCountByCollapser: new Map(),
  }) as unknown as GraphProjection;

const positionsFor = (doc: TPDocument): GraphPositions =>
  Object.fromEntries(Object.keys(doc.entities).map((id) => [id, { x: 0, y: 0 }])) as GraphPositions;

const actionNode = (doc: TPDocument, actionId: string, showActionEligibility: boolean) => {
  const derived = propagateStates(doc);
  const { result } = renderHook(() =>
    useGraphNodeEmission(
      doc,
      projectionFor(doc),
      positionsFor(doc),
      null,
      derived,
      null,
      showActionEligibility
    )
  );
  // Narrow to the `tp` entity node so `data` is `TPNodeData` (the group /
  // collapsed-root variants don't carry `eligibility`).
  const node = result.current.find((n) => n.id === actionId);
  return node?.type === 'tp' ? node : undefined;
};

describe('useGraphNodeEmission — action-eligibility badge gate', () => {
  it('stamps data.eligibility on the action node when the toggle is ON', () => {
    const { action, doc } = seedStep();
    const node = actionNode(doc, action.id, true);
    expect(node?.data?.eligibility).toBe('eligible');
  });

  it('omits data.eligibility entirely when the toggle is OFF', () => {
    const { action, doc } = seedStep();
    const node = actionNode(doc, action.id, false);
    expect(node?.data?.eligibility).toBeUndefined();
  });

  it('never stamps eligibility on a non-action entity', () => {
    const { precond, doc } = seedStep();
    const node = actionNode(doc, precond.id, true);
    expect(node?.data?.eligibility).toBeUndefined();
  });
});
