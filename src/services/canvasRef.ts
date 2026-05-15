import type { AnyTPNode, TPEdge, TPNode } from '@/components/canvas/flow-types';
import { type ReactFlowInstance, getNodesBounds } from '@xyflow/react';

// The active React Flow instance, parameterized with our concrete node and
// edge types. Set on RF onInit, cleared on canvas unmount. Lets command-palette
// actions and exporters reach into the live canvas from outside React.
type TPFlow = ReactFlowInstance<AnyTPNode, TPEdge>;

let cached: TPFlow | null = null;

export const setCanvasInstance = (instance: TPFlow | null): void => {
  cached = instance;
};

export const getCanvasInstance = (): TPFlow | null => cached;

/** Returns only entity (`tp`) nodes — group nodes are filtered out. */
export const getCanvasNodes = (): TPNode[] =>
  (cached?.getNodes() ?? []).filter((n): n is TPNode => n.type === 'tp');

export const getSelectedEdges = (): TPEdge[] =>
  cached?.getEdges().filter((e) => e.selected === true) ?? [];

/**
 * Session 95 — viewport-coords bounding rect of the current selection.
 *
 * Used by the new SelectionToolbar to anchor itself above whatever
 * the user has selected. Returns the union bounding box of the
 * selected entity nodes (group + edge selections fall back to the
 * group / edge endpoints) in CSS viewport coordinates — the toolbar
 * lives outside React Flow's coordinate space, so we have to convert.
 *
 * Returns `null` when:
 *   - the React Flow instance hasn't initialised yet
 *   - nothing is selected
 *   - the selection has no resolvable geometry (e.g. an edge whose
 *     endpoints don't exist in the node graph — defensive)
 *
 * The caller decides what to do with `null` (typically: hide the
 * overlay).
 */
export const getSelectionViewportRect = (): DOMRect | null => {
  if (!cached) return null;
  const allNodes = cached.getNodes();
  const selected = allNodes.filter((n) => n.selected === true);
  if (selected.length === 0) {
    // Edge-only selection — derive from the edge's endpoint nodes.
    const selectedEdges = cached.getEdges().filter((e) => e.selected === true);
    if (selectedEdges.length === 0) return null;
    const endpointIds = new Set<string>();
    for (const e of selectedEdges) {
      endpointIds.add(e.source);
      endpointIds.add(e.target);
    }
    const endpoints = allNodes.filter((n) => endpointIds.has(n.id));
    if (endpoints.length === 0) return null;
    return flowBoundsToViewportRect(getNodesBounds(endpoints));
  }
  return flowBoundsToViewportRect(getNodesBounds(selected));
};

/**
 * Convert a React Flow bounding box (flow-coordinate space) into a
 * DOMRect in CSS viewport space, taking the current pan + zoom into
 * account. Kept here next to `getSelectionViewportRect` so the
 * conversion math is shared if any future overlay needs the same.
 *
 * React Flow exposes the conversion via `flowToScreenPosition` which
 * lives on the same `ReactFlowInstance`. We resolve top-left and
 * bottom-right separately and rebuild the DOMRect from those — width
 * + height fall out of the math.
 */
const flowBoundsToViewportRect = (bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}): DOMRect | null => {
  if (!cached) return null;
  const tl = cached.flowToScreenPosition({ x: bounds.x, y: bounds.y });
  const br = cached.flowToScreenPosition({
    x: bounds.x + bounds.width,
    y: bounds.y + bounds.height,
  });
  return new DOMRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
};
