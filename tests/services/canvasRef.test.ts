import type { AnyTPNode, TPEdge, TPNode } from '@/components/canvas/flow-types';
import {
  getCanvasInstance,
  getCanvasNodes,
  getSelectedEdges,
  setCanvasInstance,
} from '@/services/canvasRef';
import type { ReactFlowInstance } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';

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
