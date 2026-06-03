import { type Node as RFNode, useStore as useRFStore } from '@xyflow/react';
import { useMemo } from 'react';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { useDocumentStore } from '@/store';
import {
  type Box,
  computeRadialEdgePath,
  nodeBoxOf,
  type Point,
  type RadialEdgeRoute,
} from './radialEdgeRouting';

/**
 * Equality for the radial-mode obstacle subscription. React Flow's `s.nodes`
 * is a FRESH array reference on every store write (selection, hover, dimension
 * churn — not just position), so subscribing to it bare re-renders every TPEdge
 * on every frame during any drag in radial mode. Gating on node geometry (id +
 * position + size) means the radial router only re-runs when an obstacle
 * actually moves. Returns the previous reference otherwise, keeping the
 * `radialRoute` memo stable.
 */
export const radialNodesEqual = (a: RFNode[] | null, b: RFNode[] | null): boolean => {
  if (a === b) return true;
  if (a === null || b === null || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const na = a[i];
    const nb = b[i];
    if (
      !na ||
      !nb ||
      na.id !== nb.id ||
      na.position.x !== nb.position.x ||
      na.position.y !== nb.position.y ||
      na.width !== nb.width ||
      na.height !== nb.height
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Pure core of the radial router: collect obstacle boxes from the other visible
 * nodes (the edge's own source / target are the endpoints, not obstacles) and
 * deflect a bezier around them. Each node's emitted `width` / `height` is the
 * canonical box size; fall back to the constants if a future emission path
 * forgets to set them.
 *
 * Extracted from the `useRadialRoute` hook so the obstacle-collection logic
 * (the source/target filter + the size fallback) is unit-testable without a
 * React Flow store or a mounted edge — `computeRadialEdgePath` itself already
 * has its own geometry tests.
 */
export const radialRouteForEdge = (
  source: string,
  target: string,
  sourcePoint: Point,
  targetPoint: Point,
  nodes: readonly RFNode[]
): RadialEdgeRoute => {
  const obstacles: Box[] = [];
  for (const node of nodes) {
    if (node.id === source || node.id === target) continue;
    const w = node.width ?? NODE_WIDTH;
    const h = node.height ?? NODE_MIN_HEIGHT;
    obstacles.push(nodeBoxOf(node.position, w, h));
  }
  return computeRadialEdgePath(sourcePoint, targetPoint, obstacles);
};

/**
 * Session 99 — obstacle-aware routing for the radial layout, as a self-contained
 * hook. The radial / sunburst layout places nodes on concentric rings; the
 * default React Flow bezier between source / target handles often passes through
 * cousin or sibling node boxes, especially on trees deeper than two rings. When
 * `layoutMode === 'radial'` we read all OTHER node positions via React Flow's
 * store and let `computeRadialEdgePath` deflect the bezier perpendicular to its
 * axis enough to clear the obstacles. Returns `null` (so the caller falls back
 * to its bezier / routed path) in every non-radial case.
 *
 * The React Flow subscription is gated on `isRadialMode` — the selector returns
 * a stable `null` in flow / manual modes so unrelated node drags don't fan
 * re-renders into every edge. `isRadialMode` is its own primitive selector
 * (rather than folded into TPEdge's `edgeView` bundle) so Zustand's fast-path
 * `Object.is` short-circuits unrelated updates and the flag can gate the React
 * Flow `nodes` subscription independently.
 *
 * Junctor and mutex edges keep their existing special-case paths (the junctor
 * terminus already redirects to the circle perimeter; the mutex straight-line
 * override is more useful than routing around boxes for vertically-stacked
 * Wants), so the caller passes `isJunctorEdge` / `hasMutexOverride` and the hook
 * returns `null` for them.
 */
export const useRadialRoute = (params: {
  source: string;
  target: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  effectiveTargetY: number;
  isJunctorEdge: boolean;
  hasMutexOverride: boolean;
}): RadialEdgeRoute | null => {
  const {
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    effectiveTargetY,
    isJunctorEdge,
    hasMutexOverride,
  } = params;
  const isRadialMode = useDocumentStore((s) => s.layoutMode === 'radial');
  const radialNodes = useRFStore((s) => (isRadialMode ? s.nodes : null), radialNodesEqual);
  return useMemo(() => {
    if (!isRadialMode || !radialNodes) return null;
    if (isJunctorEdge) return null;
    if (hasMutexOverride) return null;
    return radialRouteForEdge(
      source,
      target,
      { x: sourceX, y: sourceY },
      { x: targetX, y: effectiveTargetY },
      radialNodes
    );
  }, [
    isRadialMode,
    radialNodes,
    isJunctorEdge,
    hasMutexOverride,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    effectiveTargetY,
  ]);
};
