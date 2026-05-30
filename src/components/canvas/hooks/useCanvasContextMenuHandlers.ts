import { type MouseEvent as ReactMouseEvent, useCallback } from 'react';
import { useDocumentStore } from '@/store';
import type { AnyTPNode, TPEdge } from '../edges/flow-types';

/**
 * Session 138 — the canvas right-click (context-menu) handlers, lifted out of
 * `Canvas.tsx`'s JSX so the select-then-open logic is unit-testable without
 * mounting the React Flow host (the e2e path is racy by design — see
 * `selection-toolbar.spec.ts`). The handlers read live store state via
 * `getState()`, so the returned callbacks are stable.
 *
 * Each handler `preventDefault`s the native menu, then:
 *   - node / edge: selects the right-clicked target UNLESS it's already part
 *     of a multi-selection (so right-clicking inside a marquee keeps the group
 *     for a group-wide action), and opens the matching menu at the cursor.
 *   - pane: opens the pane menu without touching the selection.
 */
export const useCanvasContextMenuHandlers = () => {
  const onNodeContextMenu = useCallback((e: ReactMouseEvent, n: AnyTPNode) => {
    e.preventDefault();
    const s = useDocumentStore.getState();
    const cur = s.selection;
    const inCurrent =
      cur.kind === 'entities' && cur.ids.some((id) => id === n.id) && cur.ids.length > 1;
    if (!inCurrent) s.selectEntity(n.id);
    s.openContextMenu({ kind: 'entity', id: n.id }, e.clientX, e.clientY);
  }, []);

  const onEdgeContextMenu = useCallback((e: ReactMouseEvent, ed: TPEdge) => {
    e.preventDefault();
    const s = useDocumentStore.getState();
    const cur = s.selection;
    const inCurrent =
      cur.kind === 'edges' && cur.ids.some((id) => id === ed.id) && cur.ids.length > 1;
    if (!inCurrent) s.selectEdge(ed.id);
    s.openContextMenu({ kind: 'edge', id: ed.id }, e.clientX, e.clientY);
  }, []);

  const onPaneContextMenu = useCallback((e: ReactMouseEvent | MouseEvent) => {
    e.preventDefault();
    useDocumentStore.getState().openContextMenu({ kind: 'pane' }, e.clientX, e.clientY);
  }, []);

  return { onNodeContextMenu, onEdgeContextMenu, onPaneContextMenu };
};
