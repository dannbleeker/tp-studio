import { useStore as useRFStore } from '@xyflow/react';
import { useMemo } from 'react';
import { NODE_WIDTH } from '@/domain/constants';
import { currentDoc } from '@/store/selectors';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';
import { collectGroupSourceIds, junctorCenterX } from './junctorGeometry';

const EMPTY_IDS: string[] = [];

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
