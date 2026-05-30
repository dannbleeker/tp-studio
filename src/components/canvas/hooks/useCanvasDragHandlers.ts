import { type MouseEvent as ReactMouseEvent, useCallback, useRef } from 'react';
import { findSpliceTargetEdge } from '@/domain/dragSplice';
import { edgesArray } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import { type CentroidBuf, populateCentroidsInto } from '../centroids';
import type { AnyTPNode } from '../edges/flow-types';

const SPLICE_TOLERANCE_PX = 40;

/** The dragged node's centre at its current position. */
const probeOf = (n: AnyTPNode) => ({
  x: n.position.x + (n.measured?.width ?? 200) / 2,
  y: n.position.y + (n.measured?.height ?? 60) / 2,
});

/**
 * Session 138 — the Alt-drag-to-splice gesture, lifted out of `Canvas.tsx`'s
 * JSX into a hook so the splice hit-test wiring is unit-testable without
 * mounting the React Flow host.
 *
 *   - `onNodeDrag` — per-frame highlight: while Alt is held during a drag,
 *     hit-test the dragged node's centre against every edge and set
 *     `spliceTargetEdgeId` (so `TPEdge` glows the target). Cleared the moment
 *     Alt is released.
 *   - `onNodeDragStop` — on an Alt-drop near an edge centerline, splice the
 *     entity into that edge (drops its prior connections, rewires through it).
 *     A plain (non-Alt) drop is left to React Flow's `onNodesChange` to persist.
 *
 * Perf #6 (Session 135): the centroid buffer is a `useRef` reused in-place
 * across the ~60fps drag rather than re-allocated per pointer frame.
 */
export const useCanvasDragHandlers = (doc: TPDocument, nodes: AnyTPNode[]) => {
  const centroidsRef = useRef<CentroidBuf>({});

  const onNodeDrag = useCallback(
    (e: ReactMouseEvent, draggedNode: AnyTPNode) => {
      const { setSpliceTargetEdge } = useDocumentStore.getState();
      if (!e.altKey) {
        setSpliceTargetEdge(null);
        return;
      }
      const hit = findSpliceTargetEdge({
        point: probeOf(draggedNode),
        draggedEntityId: draggedNode.id,
        edges: edgesArray(doc),
        entityPositions: populateCentroidsInto(centroidsRef.current, nodes),
        tolerance: SPLICE_TOLERANCE_PX,
      });
      setSpliceTargetEdge(hit?.edgeId ?? null);
    },
    [doc, nodes]
  );

  const onNodeDragStop = useCallback(
    (e: ReactMouseEvent, draggedNode: AnyTPNode) => {
      const s = useDocumentStore.getState();
      if (!e.altKey) return;
      if (!guardWriteOrToast()) return;
      if (!s.doc.entities[draggedNode.id]) return;
      const hit = findSpliceTargetEdge({
        point: probeOf(draggedNode),
        draggedEntityId: draggedNode.id,
        edges: edgesArray(doc),
        entityPositions: populateCentroidsInto(centroidsRef.current, nodes),
        tolerance: SPLICE_TOLERANCE_PX,
      });
      // The gesture is over — clear the highlight whether or not it spliced.
      s.setSpliceTargetEdge(null);
      if (!hit) return;
      const ok = s.spliceEntityIntoEdge(draggedNode.id, hit.edgeId);
      if (ok) s.showToast('success', 'Entity spliced into edge.');
      else s.showToast('info', 'Splice rejected — entity already endpoints that edge.');
    },
    [doc, nodes]
  );

  return { onNodeDrag, onNodeDragStop };
};
