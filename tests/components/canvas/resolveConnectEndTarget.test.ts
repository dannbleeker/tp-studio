/**
 * Session 170 — Unit tests for `resolveConnectEndTarget`, the pure decision core
 * extracted from `useGraphMutations.onConnectEnd`.
 *
 * The handler's SIDE EFFECTS (Browse-Lock guard, store mutation, toast, hover-ref
 * clearing) are already covered by the integration tests in
 * `tests/{hooks,components/canvas}/useGraphMutations.test.tsx`. This file pins the
 * thing those can't cleanly assert: the DROP-TARGET PRIORITY ORDER — node body
 * beats junctor beats edge body beats empty — and the junctor group→member lookup.
 */

import { describe, expect, it } from 'vitest';
import {
  type ConnectEndEdge,
  resolveConnectEndTarget,
} from '@/components/canvas/hooks/resolveConnectEndTarget';
import type { HoveredJunctor } from '@/services/canvasRef';

const NO_HOVER = { hoveredJunctor: null, hoveredEdgeId: null, rfEdges: [] as ConnectEndEdge[] };

const andEdge = (id: string, groupId: string): ConnectEndEdge => ({
  id,
  data: { andGroupId: groupId },
});

describe('resolveConnectEndTarget — priority: node body', () => {
  it('connects when released over a different node body', () => {
    const t = resolveConnectEndTarget({ sourceId: 'A', toNodeId: 'B', ...NO_HOVER });
    expect(t).toEqual({ kind: 'connect', sourceId: 'A', targetId: 'B' });
  });

  it('is a noop on a self-loop (released over the source node)', () => {
    const t = resolveConnectEndTarget({ sourceId: 'A', toNodeId: 'A', ...NO_HOVER });
    expect(t).toEqual({ kind: 'noop' });
  });

  it('a node-body drop wins over a junctor / edge hover underneath it', () => {
    const junctor: HoveredJunctor = { groupId: 'g1', kind: 'AND' };
    const t = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: 'B',
      hoveredJunctor: junctor,
      hoveredEdgeId: 'e9',
      rfEdges: [andEdge('e9', 'g1')],
    });
    expect(t).toEqual({ kind: 'connect', sourceId: 'A', targetId: 'B' });
  });
});

describe('resolveConnectEndTarget — priority: junctor circle', () => {
  it('joins an AND group via a found member edge', () => {
    const junctor: HoveredJunctor = { groupId: 'g1', kind: 'AND' };
    const t = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: junctor,
      hoveredEdgeId: null,
      rfEdges: [andEdge('e1', 'other'), andEdge('e2', 'g1')],
    });
    expect(t).toEqual({
      kind: 'junctor',
      sourceId: 'A',
      junctorKind: 'and',
      label: 'AND',
      memberEdgeId: 'e2',
    });
  });

  it('maps OR / XOR display labels to the lowercase kind + matching group field', () => {
    const or = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: { groupId: 'g1', kind: 'OR' },
      hoveredEdgeId: null,
      rfEdges: [{ id: 'e1', data: { orGroupId: 'g1' } }],
    });
    expect(or).toMatchObject({
      kind: 'junctor',
      junctorKind: 'or',
      label: 'OR',
      memberEdgeId: 'e1',
    });

    const xor = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: { groupId: 'g2', kind: 'XOR' },
      hoveredEdgeId: null,
      rfEdges: [{ id: 'e2', data: { xorGroupId: 'g2' } }],
    });
    expect(xor).toMatchObject({
      kind: 'junctor',
      junctorKind: 'xor',
      label: 'XOR',
      memberEdgeId: 'e2',
    });
  });

  it('fails open (junctor-missing) when the group vanished mid-drag', () => {
    const t = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: { groupId: 'gone', kind: 'AND' },
      hoveredEdgeId: 'e9',
      rfEdges: [andEdge('e1', 'still-here')],
    });
    expect(t).toEqual({ kind: 'junctor-missing', label: 'AND' });
  });

  it('a junctor hover wins over an edge-body hover (more specific gesture)', () => {
    const t = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: { groupId: 'g1', kind: 'AND' },
      hoveredEdgeId: 'e-under',
      rfEdges: [andEdge('e1', 'g1')],
    });
    expect(t).toMatchObject({ kind: 'junctor', memberEdgeId: 'e1' });
  });

  it('does not match a member edge across kinds (AND junctor ignores an OR-group field)', () => {
    // An edge carrying the same group id but on a DIFFERENT junctor field must
    // not satisfy an AND lookup — else a kind addition could cross-wire.
    const t = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: { groupId: 'g1', kind: 'AND' },
      hoveredEdgeId: null,
      rfEdges: [{ id: 'e1', data: { orGroupId: 'g1' } }],
    });
    expect(t).toEqual({ kind: 'junctor-missing', label: 'AND' });
  });
});

describe('resolveConnectEndTarget — priority: edge body + empty', () => {
  it('adds an AND co-cause when released over an edge body', () => {
    const t = resolveConnectEndTarget({
      sourceId: 'A',
      toNodeId: null,
      hoveredJunctor: null,
      hoveredEdgeId: 'e7',
      rfEdges: [],
    });
    expect(t).toEqual({ kind: 'edge-andcause', sourceId: 'A', edgeId: 'e7' });
  });

  it('is a noop when released in empty space', () => {
    const t = resolveConnectEndTarget({ sourceId: 'A', toNodeId: null, ...NO_HOVER });
    expect(t).toEqual({ kind: 'noop' });
  });
});
