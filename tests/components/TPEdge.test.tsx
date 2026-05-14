import { TPEdge } from '@/components/canvas/TPEdge';
import type { TPEdgeData } from '@/components/canvas/flow-types';
import { buildExampleEC } from '@/domain/examples/ec';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Smoke tests for `TPEdge`. React Flow's `BaseEdge` requires a
 * provider context. We render an SVG host (React Flow's edge layer is
 * an `<svg>`) so the SVG-namespaced children don't warn.
 */

type MinimalEdgeProps = Parameters<typeof TPEdge>[0];
const makeEdgeProps = (
  data: TPEdgeData = {},
  overrides: Record<string, unknown> = {}
): MinimalEdgeProps =>
  ({
    id: 'edge-1',
    source: 'a',
    target: 'b',
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: 'bottom',
    targetPosition: 'top',
    data,
    selected: false,
    ...overrides,
  }) as unknown as MinimalEdgeProps;

describe('TPEdge', () => {
  it('renders without crashing for a default edge', () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg aria-label="test host">
          <title>test edge host</title>
          <TPEdge {...makeEdgeProps()} />
        </svg>
      </ReactFlowProvider>
    );
    // BaseEdge renders a <path>; presence of any path means TPEdge mounted.
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('is memoized with a displayName', () => {
    // `React.memo` wrapping should preserve displayName for DevTools.
    expect(TPEdge.displayName).toBe('TPEdge');
  });

  describe('mutex edge routing (Session 87 UX fix #5)', () => {
    it('renders a straight-line path between two vertically-stacked wants', () => {
      // Load the EC example so the store carries 2 wants at canonical
      // y=100 (D) / y=400 (D′) with the mutex edge wired between them.
      useDocumentStore.setState({ doc: buildExampleEC() });
      const doc = useDocumentStore.getState().doc;
      const mutexEdge = Object.values(doc.edges).find((e) => e.isMutualExclusion === true);
      expect(mutexEdge).toBeDefined();
      if (!mutexEdge) return;

      const { container } = render(
        <ReactFlowProvider>
          <svg aria-label="test host">
            <title>test edge host</title>
            <TPEdge
              {...makeEdgeProps(
                {},
                {
                  id: mutexEdge.id,
                  source: mutexEdge.sourceId,
                  target: mutexEdge.targetId,
                  // The default React Flow bezier coordinates — the
                  // mutex special-case in TPEdge overrides these with
                  // raw entity positions from the store.
                  sourceX: 800,
                  sourceY: 100,
                  targetX: 800,
                  targetY: 400,
                  sourcePosition: 'left',
                  targetPosition: 'right',
                }
              )}
            />
          </svg>
        </ReactFlowProvider>
      );

      const path = container.querySelector('path');
      expect(path).toBeTruthy();
      const d = path?.getAttribute('d') ?? '';
      // Mutex override produces a straight-line SVG path: "M x,y L x,y".
      // Bezier paths use "C" curves; their presence here would mean the
      // override didn't fire.
      expect(d.startsWith('M ')).toBe(true);
      expect(d).toContain(' L ');
      expect(d).not.toContain(' C ');
      // Both endpoints should sit on the canonical centerline (x = 800
      // + NODE_WIDTH/2 = 910). Allow ±2 px tolerance for any future
      // rounding tweaks.
      const matches = Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).map((m) => Number(m[0]));
      expect(matches).toHaveLength(4);
      const [x1, , x2] = matches as [number, number, number, number];
      expect(Math.abs(x1 - 910)).toBeLessThanOrEqual(2);
      expect(Math.abs(x2 - 910)).toBeLessThanOrEqual(2);
    });

    it('does not override for horizontally-aligned mutex edges', () => {
      // Defensive: if two wants somehow land side-by-side (custom
      // layout / user drag), the vertical-gap guard should keep the
      // bezier path rather than drawing a forced straight line.
      const doc = buildExampleEC();
      const wants = Object.values(doc.entities).filter((e) => e.type === 'want');
      expect(wants).toHaveLength(2);
      const [dEnt, dPrimeEnt] = wants;
      if (!dEnt || !dPrimeEnt) return;
      // Hand-edit positions so the two wants are side-by-side rather
      // than stacked.
      doc.entities[dEnt.id] = { ...dEnt, position: { x: 600, y: 200 } };
      doc.entities[dPrimeEnt.id] = { ...dPrimeEnt, position: { x: 1000, y: 200 } };
      useDocumentStore.setState({ doc });

      const mutexEdge = Object.values(doc.edges).find((e) => e.isMutualExclusion === true);
      if (!mutexEdge) return;

      const { container } = render(
        <ReactFlowProvider>
          <svg aria-label="test host">
            <title>test edge host</title>
            <TPEdge
              {...makeEdgeProps(
                {},
                {
                  id: mutexEdge.id,
                  source: mutexEdge.sourceId,
                  target: mutexEdge.targetId,
                  sourceX: 600,
                  sourceY: 200,
                  targetX: 1000,
                  targetY: 200,
                  sourcePosition: 'left',
                  targetPosition: 'right',
                }
              )}
            />
          </svg>
        </ReactFlowProvider>
      );

      const d = container.querySelector('path')?.getAttribute('d') ?? '';
      // Override-skipped path must not be the simple two-point straight
      // line the mutex override emits. The bezier may contain C / Q /
      // additional control-point coords; whatever React Flow chooses,
      // it should carry more than the 4 coordinate numbers a plain M-L
      // produces.
      const coordCount = Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).length;
      expect(coordCount).toBeGreaterThan(4);
    });
  });
});
