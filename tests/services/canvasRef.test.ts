import type { ReactFlowInstance } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnyTPNode, TPEdge, TPNode } from '@/components/canvas/edges/flow-types';
import {
  getCanvasInstance,
  getCanvasNodes,
  getEdgeHitCandidates,
  getSelectedEdges,
  setCanvasInstance,
} from '@/services/canvasRef';

/**
 * `canvasRef` is the module-level cache of the active React Flow
 * instance. Commands (palette, context menu) reach into it to read the
 * live React Flow node/edge state from outside React. Tests assert
 * the basic store-and-fetch contract plus the helper filters.
 */

afterEach(() => setCanvasInstance(null));

// `canvasRef` parameterizes on `AnyTPNode` (entity / group / collapsed-
// group nodes) but the getter helpers only return entity nodes. The
// fake here returns whatever shape the test populates; cast to the
// instance type at the boundary so the helper API matches.
const fakeInstance = (
  nodes: AnyTPNode[],
  edges: TPEdge[]
): ReactFlowInstance<AnyTPNode, TPEdge> => {
  return {
    getNodes: () => nodes,
    getEdges: () => edges,
  } as ReactFlowInstance<AnyTPNode, TPEdge>;
};

describe('canvasRef', () => {
  it('round-trips the active instance', () => {
    expect(getCanvasInstance()).toBeNull();
    const inst = fakeInstance([], []);
    setCanvasInstance(inst);
    expect(getCanvasInstance()).toBe(inst);
  });

  it('getCanvasNodes filters group nodes out', () => {
    setCanvasInstance(
      fakeInstance(
        [
          { id: 'a', type: 'tp', position: { x: 0, y: 0 }, data: {} as TPNode['data'] },
          {
            id: 'g',
            type: 'tpGroup',
            position: { x: 0, y: 0 },
            data: {} as AnyTPNode['data'],
          } as AnyTPNode,
        ],
        []
      )
    );
    const nodes = getCanvasNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.id).toBe('a');
  });

  it('getSelectedEdges returns only edges marked selected', () => {
    setCanvasInstance(
      fakeInstance(
        [],
        [
          { id: 'e1', source: 'a', target: 'b', selected: true } as TPEdge,
          { id: 'e2', source: 'b', target: 'c', selected: false } as TPEdge,
          { id: 'e3', source: 'c', target: 'd' } as TPEdge,
        ]
      )
    );
    const sel = getSelectedEdges();
    expect(sel.map((e) => e.id)).toEqual(['e1']);
  });

  it('returns empty arrays when no canvas instance is set', () => {
    expect(getCanvasNodes()).toEqual([]);
    expect(getSelectedEdges()).toEqual([]);
  });
});

describe('getEdgeHitCandidates', () => {
  // `pt()` (a call, not an object literal) keeps the coordinate arrays inline —
  // biome force-breaks an array of bare object literals one-per-line.
  const pt = (x: number, y: number) => ({ x, y });

  const tpNode = (id: string, x: number, y: number): AnyTPNode =>
    ({
      id,
      type: 'tp',
      position: { x, y },
      measured: { width: 100, height: 50 },
      data: {} as TPNode['data'],
    }) as AnyTPNode;

  it('uses the smart-router waypoints when the edge has a route', () => {
    const edge = {
      id: 'e1',
      source: 'a',
      target: 'b',
      data: { route: { d: '', waypoints: [pt(0, 0), pt(50, 50)] } },
    } as unknown as TPEdge;
    setCanvasInstance(fakeInstance([], [edge]));
    const cands = getEdgeHitCandidates();
    expect(cands).toHaveLength(1);
    expect(cands[0]).toEqual({ id: 'e1', points: [pt(0, 0), pt(50, 50)] });
  });

  it('falls back to source/target node centres when there is no route', () => {
    const edge = { id: 'e1', source: 'a', target: 'b', data: {} } as TPEdge;
    setCanvasInstance(fakeInstance([tpNode('a', 0, 0), tpNode('b', 200, 100)], [edge]));
    // Centres: a = (0+50, 0+25) = (50, 25); b = (200+50, 100+25) = (250, 125).
    expect(getEdgeHitCandidates()[0]?.points).toEqual([pt(50, 25), pt(250, 125)]);
  });

  it('skips an edge whose endpoint node is missing (no route, no centre)', () => {
    const edge = { id: 'e1', source: 'a', target: 'b', data: {} } as TPEdge;
    setCanvasInstance(fakeInstance([], [edge]));
    expect(getEdgeHitCandidates()).toEqual([]);
  });

  it('returns empty when no instance is set', () => {
    expect(getEdgeHitCandidates()).toEqual([]);
  });
});
