import type { AnyTPNode, TPEdge, TPNode } from '@/components/canvas/flow-types';
import { useDocumentStore } from '@/store';
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
 *
 * **Selection source.** We read the selection ids from the zustand
 * store (the canonical source), not React Flow's `n.selected` flag.
 * React Flow's flag sync trails our store by one tick because we
 * push `selected: boolean` onto each node in `useGraphView`, then
 * RF reconciles, then a Playwright `expect(...).toBeVisible()` may
 * race with that reconciliation. Reading from the store eliminates
 * the lag — the toolbar's effect already runs when our store's
 * `selection` changes, so the rect is computed against the same
 * source the visibility check already used.
 */
export const getSelectionViewportRect = (): DOMRect | null => {
  if (!cached) return null;
  const state = useDocumentStore.getState();
  const sel = state.selection;
  const allNodes = cached.getNodes();
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));

  if (sel.kind === 'entities' && sel.ids.length > 0) {
    const nodes = sel.ids
      .map((id) => nodeById.get(id))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    if (nodes.length === 0) return null;
    return flowBoundsToViewportRect(getNodesBounds(nodes));
  }

  if (sel.kind === 'groups' && sel.ids.length > 0) {
    const nodes = sel.ids
      .map((id) => nodeById.get(id))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
    if (nodes.length === 0) return null;
    return flowBoundsToViewportRect(getNodesBounds(nodes));
  }

  if (sel.kind === 'edges' && sel.ids.length > 0) {
    // Edge selection — derive from the edge's endpoint nodes.
    const endpointIds = new Set<string>();
    for (const edgeId of sel.ids) {
      const edge = state.doc.edges[edgeId];
      if (edge) {
        endpointIds.add(edge.sourceId);
        endpointIds.add(edge.targetId);
      }
    }
    const endpoints = allNodes.filter((n) => endpointIds.has(n.id));
    if (endpoints.length === 0) return null;
    return flowBoundsToViewportRect(getNodesBounds(endpoints));
  }

  return null;
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
