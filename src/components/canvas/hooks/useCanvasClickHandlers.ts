import { type MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import type { AnyTPNode, TPEdge } from '../edges/flow-types';

/**
 * Session 138 — the canvas's special-case click handlers, lifted out of
 * `Canvas.tsx`'s JSX so the gesture logic is unit-testable without mounting
 * the React Flow host. The handlers read live store state via `getState()`
 * (they fire on user clicks, not on render), so the hook itself doesn't
 * subscribe and the returned callbacks are stable.
 *
 * Plain / shift / ctrl clicks are NOT handled here — they fall through to
 * React Flow's own selection model, which `Canvas`'s `onSelectionChange`
 * mirrors into the store.
 */
export const useCanvasClickHandlers = () => {
  // Alt+click an entity while exactly one OTHER entity is selected → create an
  // edge from the selected source to the clicked target.
  const onNodeClick = useCallback((e: ReactMouseEvent, n: AnyTPNode) => {
    if (!e.altKey) return;
    const s = useDocumentStore.getState();
    const cur = s.selection;
    if (cur.kind === 'entities' && cur.ids.length === 1 && cur.ids[0] && cur.ids[0] !== n.id) {
      if (guardWriteOrToast()) s.connect(cur.ids[0], n.id);
    }
  }, []);

  // Edge-join mode (Session 133): the next edge click is the second edge to
  // AND-group with the held one. Clicking the source edge again cancels.
  const onEdgeClick = useCallback((e: ReactMouseEvent, ed: TPEdge) => {
    const s = useDocumentStore.getState();
    const joinSource = s.canvasMode.kind === 'edge-join' ? s.canvasMode.edgeId : null;
    if (!joinSource) return;
    if (joinSource === ed.id) {
      s.cancelEdgeJoinMode();
      s.showToast('info', 'Join mode cancelled.');
      return;
    }
    e.stopPropagation();
    if (!guardWriteOrToast()) {
      s.cancelEdgeJoinMode();
      return;
    }
    const result = s.groupAsAnd([joinSource, ed.id]);
    s.cancelEdgeJoinMode();
    if (result.ok) s.showToast('success', 'AND-joined.');
    else s.showToast('info', result.reason);
  }, []);

  // Pane click deselects, and exits edge-join mode first (same cancel
  // semantics as Esc / clicking the source edge again).
  const onPaneClick = useCallback(() => {
    const s = useDocumentStore.getState();
    if (s.canvasMode.kind === 'edge-join') s.cancelEdgeJoinMode();
    s.clearSelection();
  }, []);

  // Double-clicking an edge is a deliberate "inspect this connector" gesture:
  // select it and force the Inspector panel open (even if the user toggled it
  // off via the TopBar). The first click of the double already selects via
  // React Flow's selection model; re-selecting here is idempotent and keeps the
  // gesture self-contained + unit-testable.
  const onEdgeDoubleClick = useCallback((e: ReactMouseEvent, ed: TPEdge) => {
    e.stopPropagation();
    const s = useDocumentStore.getState();
    s.selectEdge(ed.id);
    s.showInspector();
  }, []);

  return { onNodeClick, onEdgeClick, onEdgeDoubleClick, onPaneClick };
};
