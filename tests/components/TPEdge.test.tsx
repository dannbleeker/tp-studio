import { TPEdge } from '@/components/canvas/TPEdge';
import type { TPEdgeData } from '@/components/canvas/flow-types';
import { resetStoreForTest } from '@/store';
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
});
