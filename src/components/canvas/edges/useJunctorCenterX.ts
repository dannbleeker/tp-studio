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
 * `junctorCenterX` against the SAME live node positions. Two gated subscriptions,
 * both no-ops for ordinary edges:
 *   1. the group's source ids (structure-only — stable across position churn);
 *   2. those sources' live center-X via React Flow's `nodeLookup` (so the
 *      terminus tracks a re-layout / drag exactly like the circle does).
 */
export const useJunctorCenterX = (params: {
  isJunctorEdge: boolean;
  groupField: 'andGroupId' | 'orGroupId' | 'xorGroupId' | null;
  groupId: string | undefined;
  targetX: number;
}): number | null => {
  const { isJunctorEdge, groupField, groupId, targetX } = params;
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
  return useMemo(
    () => (isJunctorEdge && sourceXs ? junctorCenterX(sourceXs, targetX) : null),
    [isJunctorEdge, sourceXs, targetX]
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
