import type { AnyTPNode, TPEdge, TPNode } from '@/components/canvas/flow-types';
import { useDocumentStore } from '@/store';
import type { ReactFlowInstance } from '@xyflow/react';

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
 * Used by the SelectionToolbar to anchor itself above whatever the
 * user has selected. Returns the union bounding box of the selected
 * entity nodes (group / edge selections fall back to the group / edge
 * endpoints) in CSS viewport coordinates.
 *
 * **DOM-first.** Phase 2's first attempt computed coords by feeding
 * React Flow's `getNodesBounds()` into `flowToScreenPosition()`. That
 * path turned out to race in Playwright on a fresh canvas — the RF
 * viewport transform wasn't fully measured by the time the toolbar
 * tried to position itself, so `flowToScreenPosition` returned NaN-ish
 * values and the toolbar effectively rendered off-screen.
 *
 * The DOM is the source of truth for "where is this element on
 * screen." Each TPNode carries `data-component="tp-node"` and a
 * `data-id={entity.id}` attribute (already used by the e2e splice
 * tests), so we can `querySelector` the selected nodes and union
 * their `getBoundingClientRect()` directly. No transform math
 * required, no race against React Flow's measure pass.
 *
 * Returns `null` when:
 *   - the React Flow instance hasn't initialised yet
 *   - nothing is selected
 *   - the selected elements aren't yet in the DOM (one render tick
 *     after the selection lands — the toolbar's effect retries)
 *
 * **Selection source.** Reads `selection.ids` from the zustand store
 * (canonical source), not React Flow's `n.selected` flag (one tick
 * behind our store as the prop reconciles).
 */
export const getSelectionViewportRect = (): DOMRect | null => {
  if (typeof document === 'undefined') return null;
  if (!cached) return null;
  const state = useDocumentStore.getState();
  const sel = state.selection;
  const ids = collectSelectionEntityIds(state, sel);
  if (ids.length === 0) return null;
  return unionRectsByEntityIds(ids);
};

/**
 * Map a Selection union into the entity ids the toolbar wants to
 * anchor on:
 *   - entities: the entity ids themselves
 *   - groups: the group's id (group nodes carry the same id)
 *   - edges: the endpoint entity ids (we anchor across the edge)
 */
const collectSelectionEntityIds = (
  state: ReturnType<typeof useDocumentStore.getState>,
  sel: ReturnType<typeof useDocumentStore.getState>['selection']
): string[] => {
  if (sel.kind === 'entities') return [...sel.ids];
  if (sel.kind === 'groups') return [...sel.ids];
  if (sel.kind === 'edges') {
    const endpointIds = new Set<string>();
    for (const edgeId of sel.ids) {
      const edge = state.doc.edges[edgeId];
      if (edge) {
        endpointIds.add(edge.sourceId);
        endpointIds.add(edge.targetId);
      }
    }
    return Array.from(endpointIds);
  }
  return [];
};

/**
 * Look up the DOM nodes that represent the given entity ids and
 * return their union bounding rect. React Flow renders each TPNode
 * inside a `.react-flow__node[data-id]` wrapper; we target the
 * wrapper since it holds the canonical screen geometry.
 */
const unionRectsByEntityIds = (entityIds: string[]): DOMRect | null => {
  const rects: DOMRect[] = [];
  for (const id of entityIds) {
    // Quote the id for CSS — entity ids are nanoid-style URL-safe,
    // but defensive quoting is cheap insurance against any future
    // id scheme that includes punctuation.
    const escaped = id.replace(/"/g, '\\"');
    const el = document.querySelector(`.react-flow__node[data-id="${escaped}"]`);
    if (el) rects.push((el as HTMLElement).getBoundingClientRect());
  }
  if (rects.length === 0) return null;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const r of rects) {
    if (r.left < left) left = r.left;
    if (r.top < top) top = r.top;
    if (r.right > right) right = r.right;
    if (r.bottom > bottom) bottom = r.bottom;
  }
  return new DOMRect(left, top, right - left, bottom - top);
};
