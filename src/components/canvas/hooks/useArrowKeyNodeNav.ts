import { useReactFlow } from '@xyflow/react';
import { useEffect } from 'react';
import { incomingEdges, outgoingEdges } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';
import { isEditableTarget, isInteractiveTarget } from '@/hooks/keyboardUtils';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 135 — canvas a11y slice 4. Arrow-key navigation between
 * connected nodes.
 *
 * When a `.react-flow__node` has keyboard focus — OR a single entity is
 * selected (e.g. via a mouse click, whose DOM focus may sit on the body) —
 * the arrow keys jump focus + selection to the connected neighbour in that
 * direction. This is the single biggest UX win for keyboard-only diagram
 * reading: Tab gets you onto the canvas, then arrows walk the structure the
 * way the human eye does, without a long Tab cycle. Since Session 192 this is
 * the ONLY arrow-nav owner (the causal ↑effect/↓cause variant that used to
 * live in `useSelectionShortcuts` was removed to end the focus-path split).
 *
 * Scope (slice 4):
 *   - Only entity nodes (`type='tp'`). Collapsed-root cards stand in
 *     for an entire subtree's edges via post-emission `agg:` synthetic
 *     edges that aren't in `doc.edges`; walking those needs the
 *     emission output, not the doc — out of scope for this slice.
 *   - Only the four cardinal directions. Diagonals fall to the
 *     closest neighbour by the same scoring rule.
 *   - Plain arrow only — modifier-arrow combos pass through so global
 *     shortcuts (e.g. Shift+Arrow Range-select) still work.
 *
 * Implementation choices:
 *   - Capture-phase `keydown` on `window` so we beat React Flow's own
 *     viewport-pan handler. RF doesn't pan when a node owns focus, so
 *     in practice the listener and RF don't compete; the capture
 *     phase is belt-and-suspenders.
 *   - Selection driven via `flow.setNodes` (same path
 *     `__TP_TEST__.selectNodeViaRF` uses) so the production
 *     `onSelectionChange` → store-mirror flow runs end-to-end.
 *   - Focus moved by `el.focus()` on the target's `.react-flow__node`
 *     DOM element so the keyboard cursor follows the selection. RF's
 *     setNodes won't move focus by itself — selection ≠ focus.
 */

type Direction = 'up' | 'down' | 'left' | 'right';

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Pure neighbour-finder. Given a focused entity id + a direction +
 * the doc + the live React Flow instance (for the post-layout absolute
 * positions), return the connected entity whose center is most in that
 * direction. `null` when no connected neighbour qualifies.
 *
 * Scoring rules:
 *   - Filter to neighbours connected by an incoming OR outgoing edge —
 *     "what's causally adjacent" is the most useful default.
 *   - Drop neighbours not in the pressed direction.
 *   - Drop neighbours where the perpendicular delta exceeds the
 *     primary-axis delta — a node mostly to the right shouldn't win an
 *     UpArrow even if it's a little above.
 *   - Among the remaining, pick the one with the smallest weighted
 *     distance (primary + 0.5 × perpendicular). Closer is better.
 *
 * Exported (pure) so the scoring logic gets direct unit-test coverage —
 * the hook itself is React + RF + DOM and only exercised via e2e.
 */
/**
 * Narrow structural type for the React Flow accessor we read here.
 * Defined locally (instead of `Pick<ReactFlowInstance, 'getInternalNode'>`)
 * so the unit-test mock can satisfy it without a full `InternalNode`
 * literal. The real `useReactFlow()` return shape is a strict superset.
 */
export type FlowLookup = {
  getInternalNode: (id: string) =>
    | {
        internals: { positionAbsolute: { x: number; y: number } };
        measured?: { width?: number; height?: number };
      }
    | undefined;
};

export const findNeighborInDirection = (
  fromId: string,
  direction: Direction,
  doc: TPDocument,
  flow: FlowLookup
): string | null => {
  const fromNode = flow.getInternalNode(fromId);
  if (!fromNode) return null;
  const fromPos = fromNode.internals.positionAbsolute;
  const fromW = fromNode.measured?.width ?? 220;
  const fromH = fromNode.measured?.height ?? 72;
  const fromCx = fromPos.x + fromW / 2;
  const fromCy = fromPos.y + fromH / 2;

  const neighbours = new Set<string>();
  for (const e of outgoingEdges(doc, fromId)) {
    if (e.isBackEdge || e.isMutualExclusion) continue;
    neighbours.add(e.targetId);
  }
  for (const e of incomingEdges(doc, fromId)) {
    if (e.isBackEdge || e.isMutualExclusion) continue;
    neighbours.add(e.sourceId);
  }

  let best: { id: string; score: number } | null = null;
  for (const id of neighbours) {
    const n = flow.getInternalNode(id);
    if (!n) continue;
    const np = n.internals.positionAbsolute;
    const nw = n.measured?.width ?? 220;
    const nh = n.measured?.height ?? 72;
    const ncx = np.x + nw / 2;
    const ncy = np.y + nh / 2;
    const dx = ncx - fromCx;
    const dy = ncy - fromCy;

    let primary: number;
    let perp: number;
    if (direction === 'up') {
      if (dy >= 0) continue;
      primary = -dy;
      perp = Math.abs(dx);
    } else if (direction === 'down') {
      if (dy <= 0) continue;
      primary = dy;
      perp = Math.abs(dx);
    } else if (direction === 'left') {
      if (dx >= 0) continue;
      primary = -dx;
      perp = Math.abs(dy);
    } else {
      if (dx <= 0) continue;
      primary = dx;
      perp = Math.abs(dy);
    }
    if (perp > primary) continue; // primary-axis must dominate

    const score = primary + perp * 0.5;
    if (best === null || score < best.score) best = { id, score };
  }
  return best?.id ?? null;
};

/**
 * Mount inside the `<ReactFlowProvider>` subtree. Keyboard-only,
 * SSR-safe (`typeof window` guarded by useEffect).
 */
export const useArrowKeyNodeNav = (): void => {
  const flow = useReactFlow();

  useEffect(() => {
    // reg: move-to-effect / move-to-cause / move-to-sibling
    // Single owner of plain-arrow navigation between connected entities. The
    // registry's three entity-arrow entries all map here; the causal variant
    // that used to also live in `useSelectionShortcuts` was removed so the
    // behaviour no longer depends on the focus path (Tab vs click).
    const handler = (e: KeyboardEvent) => {
      const direction = KEY_TO_DIRECTION[e.key];
      if (!direction) return;
      // Pass modifier-arrow combos through — global shortcuts may want them.
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      // Resolve the entity to navigate FROM. Prefer the focused node wrapper
      // (Tab-driven keyboard nav); fall back to the store's single-entity
      // selection so a click-selected node — whose DOM focus may sit on the
      // body rather than the node — navigates identically. This is what makes
      // arrow nav behave the same whether the node was reached by Tab or click.
      const active = document.activeElement;
      let fromId: string | null = null;
      if (active instanceof HTMLElement && active.classList.contains('react-flow__node')) {
        fromId = active.getAttribute('data-id');
      } else {
        // Not on a node: only navigate when nothing editable / interactive owns
        // the keys (arrows must still move the caret in a field, or operate a
        // focused control), and exactly one entity is selected.
        if (isEditableTarget(active) || isInteractiveTarget(active)) return;
        const sel = useDocumentStore.getState().selection;
        if (sel.kind === 'entities' && sel.ids.length === 1) fromId = sel.ids[0] ?? null;
      }
      if (!fromId) return;

      const targetId = findNeighborInDirection(
        fromId,
        direction,
        currentDoc(useDocumentStore.getState()),
        flow
      );
      if (!targetId) return;

      e.preventDefault();
      e.stopPropagation();
      // Drive RF's own selection (its focus ring + the onSelectionChange
      // mirror)…
      flow.setNodes((nodes) => nodes.map((n) => ({ ...n, selected: n.id === targetId })));
      // …and mirror to the store directly, so the selection lands even if RF's
      // onSelectionChange round-trip is deferred (or absent under test).
      useDocumentStore.getState().selectEntity(targetId);
      // Move keyboard focus to the target node's wrapper.
      const targetEl = document.querySelector(`.react-flow__node[data-id="${targetId}"]`);
      if (targetEl instanceof HTMLElement) targetEl.focus();
    };

    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
    };
  }, [flow]);
};
