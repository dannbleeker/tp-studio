import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphNodeEmission } from '@/components/canvas/hooks/useGraphNodeEmission';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import type { DetailedRevisionDiff } from '@/domain/revisions';
import type { EntityState, TPDocument } from '@/domain/types';
import { resetStoreForTest } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

/**
 * Extra coverage for `useGraphNodeEmission` branches that are not exercised
 * by `useGraphNodeEmission.test.tsx`:
 *   - `openCommentCount` badge set when a doc has open comments anchored to
 *     an entity
 *   - `hiddenDescendantCount` badge on a F7-collapsed entity
 *   - `effectiveState` from derivedStates
 *   - `speculated` flag from speculationOverlay
 *   - `diffStatus = 'changed'` stamped from a compare diff
 */

const emptyDiff = (): DetailedRevisionDiff => ({
  entitiesAdded: new Set(),
  entitiesRemoved: new Set(),
  entitiesChanged: new Set(),
  edgesAdded: new Set(),
  edgesRemoved: new Set(),
  edgesChanged: new Set(),
  groupsAdded: new Set(),
  groupsRemoved: new Set(),
  groupsChanged: new Set(),
});

const emit = (
  doc: TPDocument,
  positions: Record<string, { x: number; y: number }>,
  opts: {
    compareDiff?: DetailedRevisionDiff | null;
    derivedStates?: Record<string, EntityState>;
    speculationOverlay?: Record<string, EntityState> | null;
    showEligibility?: boolean;
  } = {}
) =>
  renderHook(() => {
    const projection = useGraphProjection(doc);
    return useGraphNodeEmission(
      doc,
      projection,
      positions,
      opts.compareDiff ?? null,
      opts.derivedStates ?? {},
      opts.speculationOverlay ?? null,
      opts.showEligibility ?? false
    );
  }).result.current;

beforeEach(() => {
  resetStoreForTest();
  resetIds();
});

describe('useGraphNodeEmission — extra data fields', () => {
  it('stamps openCommentCount when an entity has open comments', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    // Attach a comment anchored to entity `a`
    doc.comments = {
      c1: {
        id: 'c1',
        anchor: { kind: 'entity', entityId: a.id },
        body: 'Is this causal?',
        author: 'Tester',
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } });
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { openCommentCount?: number }).openCommentCount).toBe(1);
  });

  it('does NOT stamp openCommentCount for resolved comments', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    doc.comments = {
      c1: {
        id: 'c1',
        anchor: { kind: 'entity', entityId: a.id },
        body: 'Resolved feedback',
        author: 'Tester',
        resolved: true,
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } });
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { openCommentCount?: number }).openCommentCount).toBeUndefined();
  });

  it('stamps hiddenDescendantCount on a F7-collapsed entity', () => {
    const a = makeEntity({ collapsed: true });
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    // Add an edge a→b so b is downstream (it will be hidden by projection)
    const edge = makeEdge(a.id, b.id);
    doc.edges = { [edge.id]: edge };

    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } });
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { hiddenDescendantCount?: number }).hiddenDescendantCount).toBe(1);
  });

  it('stamps effectiveState from derivedStates', () => {
    const a = makeEntity(); // no manual state set
    const doc = makeDoc([a], []);
    const nodes = emit(
      doc,
      { [a.id]: { x: 0, y: 0 } },
      {
        derivedStates: { [a.id]: 'true' as EntityState },
      }
    );
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { effectiveState?: EntityState }).effectiveState).toBe('true');
  });

  it('stamps speculated = true when the entity is in the speculationOverlay', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    const nodes = emit(
      doc,
      { [a.id]: { x: 0, y: 0 } },
      {
        speculationOverlay: { [a.id]: 'false' as EntityState },
      }
    );
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { speculated?: boolean }).speculated).toBe(true);
    // effectiveState comes from the overlay
    expect((node?.data as { effectiveState?: EntityState }).effectiveState).toBe('false');
  });

  it('stamps diffStatus = "changed" from a compare diff', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    const diff = { ...emptyDiff(), entitiesChanged: new Set([a.id]) };
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } }, { compareDiff: diff });
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { diffStatus?: string }).diffStatus).toBe('changed');
  });

  it('does NOT stamp effectiveState when it resolves to "unknown"', () => {
    const a = makeEntity(); // no state, no derivedStates entry
    const doc = makeDoc([a], []);
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } });
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { effectiveState?: EntityState }).effectiveState).toBeUndefined();
  });
});
