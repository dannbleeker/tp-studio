import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useRef,
} from 'react';
import type { EdgeId, EntityId } from '@/domain/types';
import { useDocumentStore } from '@/store';

// A press must be held this long, roughly stationary, to count as a long-press.
// 500ms matches the platform convention for touch context menus (iOS/Android).
const LONG_PRESS_MS = 500;
// If the finger travels more than this before the timer fires, it's a pan or a
// connection drag, not a long-press — cancel.
const MOVE_CANCEL_PX = 12;

/**
 * Touch long-press → context menu.
 *
 * The desktop path (`useCanvasContextMenuHandlers`) hangs off React Flow's
 * `onNodeContextMenu` / `onEdgeContextMenu` / `onPaneContextMenu`, which are
 * driven by the native `contextmenu` (right-click) event. Touch devices have no
 * right-click, and a long-press doesn't reliably surface through React Flow's
 * handlers — so touch users had no way to reach the rename / delete / group /
 * comment actions that live only in the context menu.
 *
 * This hook adds a pointer-level long-press detector for coarse pointers. Spread
 * the returned handlers on the canvas wrapper. On a stationary touch/pen press
 * held for {@link LONG_PRESS_MS}, it resolves the element under the point to an
 * entity / edge / pane target (mirroring the right-click select-then-open logic)
 * and opens the same menu at the press location. Mouse presses are ignored — the
 * native right-click path already covers them.
 */
export function useLongPressContextMenu() {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastPointerType = useRef<string>('mouse');
  // Set when a long-press opened the menu, so the trailing `click` (finger lift)
  // is swallowed before React Flow's `onPaneClick` / `onNodeClick` can fire and
  // immediately close what we just opened.
  const suppressNextClick = useRef(false);

  const cancel = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  };

  const openMenuAt = (x: number, y: number): void => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const s = useDocumentStore.getState();
    const nodeEl = el?.closest('.react-flow__node') as HTMLElement | null;
    const nodeId = nodeEl?.dataset.id as EntityId | undefined;
    if (nodeId) {
      const cur = s.selection;
      const inGroup = cur.kind === 'entities' && cur.ids.length > 1 && cur.ids.includes(nodeId);
      if (!inGroup) s.selectEntity(nodeId);
      s.openContextMenu({ kind: 'entity', id: nodeId }, x, y);
      return;
    }
    const edgeEl = el?.closest('.react-flow__edge') as HTMLElement | null;
    const edgeId = edgeEl?.dataset.id as EdgeId | undefined;
    if (edgeId) {
      const cur = s.selection;
      const inGroup = cur.kind === 'edges' && cur.ids.length > 1 && cur.ids.includes(edgeId);
      if (!inGroup) s.selectEdge(edgeId);
      s.openContextMenu({ kind: 'edge', id: edgeId }, x, y);
      return;
    }
    s.openContextMenu({ kind: 'pane' }, x, y);
  };

  const onPointerDown = (e: ReactPointerEvent): void => {
    lastPointerType.current = e.pointerType;
    if (e.pointerType === 'mouse') return;
    cancel();
    const { clientX: x, clientY: y } = e;
    start.current = { x, y };
    timer.current = window.setTimeout(() => {
      if (!start.current) return;
      suppressNextClick.current = true;
      openMenuAt(start.current.x, start.current.y);
      cancel();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: ReactPointerEvent): void => {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) cancel();
  };

  const onPointerUp = (): void => cancel();
  const onPointerCancel = (): void => cancel();

  // Capture-phase so it runs before React Flow's own listeners on the children.
  const onContextMenuCapture = (e: ReactMouseEvent): void => {
    // Swallow the browser's long-press `contextmenu` on touch so it can't
    // double-open (or race) with our detector. Mouse right-clicks fall through
    // to React Flow's handlers untouched.
    if (lastPointerType.current !== 'mouse') e.preventDefault();
  };

  const onClickCapture = (e: ReactMouseEvent): void => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenuCapture,
    onClickCapture,
  };
}
