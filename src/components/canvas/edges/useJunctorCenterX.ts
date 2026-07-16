import { useStore as useRFStore } from '@xyflow/react';
import { useMemo } from 'react';
import { NODE_WIDTH } from '@/domain/constants';
import { currentDoc } from '@/store/selectors';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';
import { collectGroupSourceIds, junctorCenterX, junctorSourceAnchor } from './junctorGeometry';

const EMPTY_IDS: string[] = [];

type XY = { x: number; y: number };

const xyEqual = (a: XY | null, b: XY | null): boolean =>
  a === b || (!!a && !!b && a.x === b.x && a.y === b.y);

const stringArrayEqual = (a: string[], b: string[]): boolean =>
  a === b || (a.length === b.length && a.every((v, i) => v === b[i]));

const numberArrayEqual = (a: number[] | null, b: number[] | null): boolean =>
  a === b || (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]));

/**
 * The X a junctor cause-edge should terminate at: the group's junctor center
 * (see {@link junctorCenterX}). Returns `null` for non-junctor edges, so the
 * caller keeps React Flow's target-handle X.
 *
 * This MUST agree with `JunctorOverlay`'s circle placement, so it runs the same
 * `junctorCenterX` against the SAME live node positions. Three gated
 * subscriptions, all no-ops for ordinary edges:
 *   1. the group's source ids (structure-only — stable across position churn);
 *   2. those sources' live center-X via React Flow's `nodeLookup` (so the
 *      terminus tracks a re-layout / drag exactly like the circle does);
 *   3. the TARGET's live center-X, read the same way (see below).
 */
export const useJunctorCenterX = (params: {
  isJunctorEdge: boolean;
  groupField: 'andGroupId' | 'orGroupId' | 'xorGroupId' | null;
  groupId: string | undefined;
  targetId: string;
  targetX: number;
}): number | null => {
  const { isJunctorEdge, groupField, groupId, targetId, targetX } = params;
  const sourceIds = useDocumentStoreWith(
    (s) =>
      isJunctorEdge && groupField && groupId
        ? collectGroupSourceIds(currentDoc(s).edges, groupField, groupId)
        : EMPTY_IDS,
    stringArrayEqual
  );
  const sourceXs = useRFStore((s) => {
    if (!isJunctorEdge) return null;
    const xs: number[] = [];
    for (const id of sourceIds) {
      const n = s.nodeLookup.get(id);
      if (n) xs.push(n.internals.positionAbsolute.x + (n.measured?.width ?? NODE_WIDTH) / 2);
    }
    return xs;
  }, numberArrayEqual);
  // The target's CENTER X, derived from the node box exactly as `JunctorOverlay`
  // derives it (`positionAbsolute.x + measuredWidth / 2`).
  //
  // Session 206 fix: this used React Flow's `props.targetX`, which is the target
  // HANDLE's X. On a vertical tree the target handle is Bottom, so its X is ~the
  // node's center and the two agreed by luck. On a HORIZONTAL (EC) layout the
  // target handle is Right — i.e. center + width/2 — so feeding it to
  // `junctorCenterX` slid the edges' meeting point `nudge * width/2` (= width/8
  // at the default 0.25 nudge) away from the circle the overlay drew. Reading the
  // box center makes both sides agree on every axis. Falls back to the handle X
  // until React Flow has measured the node (matching the sourceXs fallback).
  const targetCenterX = useRFStore((s) => {
    if (!isJunctorEdge) return null;
    const n = s.nodeLookup.get(targetId);
    return n ? n.internals.positionAbsolute.x + (n.measured?.width ?? NODE_WIDTH) / 2 : null;
  });
  return useMemo(
    () => (isJunctorEdge && sourceXs ? junctorCenterX(sourceXs, targetCenterX ?? targetX) : null),
    [isJunctorEdge, sourceXs, targetCenterX, targetX]
  );
};

/**
 * The bezier SOURCE point a junctor cause-edge should depart from — re-anchored
 * onto the source node's real edge (see {@link junctorSourceAnchor}). Junctor
 * cause-edges skip the smart router, so without this they start at React Flow's
 * raw handle position (~10px off the card, leaving a gap at the cause). Reads the
 * source node's live absolute top-left from React Flow so the anchor tracks drags
 * / re-layout; returns the unchanged handle point for non-junctor edges (the
 * subscription is a stable no-op then).
 */
export const useJunctorSourceAnchor = (params: {
  isJunctorEdge: boolean;
  sourceId: string;
  axis: 'vertical' | 'horizontal';
  sourceX: number;
  sourceY: number;
}): XY => {
  const { isJunctorEdge, sourceId, axis, sourceX, sourceY } = params;
  const topLeft = useRFStore((s) => {
    if (!isJunctorEdge) return null;
    const n = s.nodeLookup.get(sourceId);
    return n ? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y } : null;
  }, xyEqual);
  return useMemo(
    () => junctorSourceAnchor(axis, sourceX, sourceY, topLeft),
    [axis, sourceX, sourceY, topLeft]
  );
};
