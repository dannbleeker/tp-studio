import type { DiagramType } from './types';

/**
 * How a diagram type lays out its nodes on the canvas.
 *
 * - `'auto'` — useGraphView runs dagre over the visible entity / collapsed-root
 *   set every time the layout fingerprint changes, and ignores `Entity.position`
 *   even if present. This is the only strategy for CRT, FRT, PRT, and TT
 *   today.
 * - `'manual'` — useGraphView skips dagre entirely and reads `Entity.position`
 *   for each entity, falling back to `{ x: 0, y: 0 }` for entities without
 *   one (e.g. a freshly added node before the user drags it). Evaporating
 *   Cloud (A1) will be the first diagram to use this; the box geometry IS
 *   the diagnostic, so auto-layout would erase the meaning.
 */
export type LayoutStrategy = 'auto' | 'manual';

/**
 * Per-diagram-type layout strategy. The `Record<DiagramType, _>` shape forces
 * TypeScript to flag a missing entry when a new diagram type is added — the
 * implicit "everything auto" default would otherwise hide a bug for hand-
 * positioned diagrams.
 */
export const LAYOUT_STRATEGY: Record<DiagramType, LayoutStrategy> = {
  crt: 'auto',
  frt: 'auto',
  prt: 'auto',
  tt: 'auto',
  // Evaporating Cloud is the first manual-layout diagram. The 5-box A/B/C/D/D′
  // arrangement carries the diagnostic meaning of the conflict, so dagre
  // would erase it. The seed positions (see INITIAL_DOC_BY_DIAGRAM.ec) put
  // the canonical layout on the canvas; drag-to-reposition persists via
  // setEntityPosition.
  ec: 'manual',
  // FL-DT4: S&T trees are inherently hierarchical — strategies decompose
  // into tactics that decompose into sub-strategies. Auto-layout via
  // dagre gives the right visual default; per-doc layoutConfig can flip
  // the direction (TB tends to read better for S&T than BT).
  st: 'auto',
  // FL-DT5: free-form diagrams are autosizing today (dagre); users can
  // drag-pin individual nodes per-entity (LA5). A future option might
  // make `freeform` default to manual layout so every node is hand-
  // placed by default — for now, auto + drag-pin is the cheapest path.
  freeform: 'auto',
  // Session 77: Goal Tree — strict top-to-bottom hierarchy. Auto-layout
  // handles it cleanly via dagre with `direction: 'TB'`.
  goalTree: 'auto',
};

/**
 * Which sides of a node carry the source / target handles for this diagram
 * type. Drives the natural edge-flow direction:
 *
 * - `'vertical'` — `target=Position.Bottom`, `source=Position.Top`. Edges
 *   flow upward (sources below, targets above). Matches our dagre `BT`
 *   layout for CRT / FRT / PRT / TT.
 * - `'horizontal'` — `target=Position.Right`, `source=Position.Left`. Edges
 *   flow right-to-left (sources to the right, targets to the left). Matches
 *   Evaporating Cloud's hand-positioned A | B / C | D / D′ geometry, where
 *   the wants (right) satisfy the needs (middle) which support the goal
 *   (left).
 *
 * The handles' positions only affect React Flow's bezier routing — the
 * underlying data model is identical regardless of orientation. Each
 * TPNode / TPCollapsedGroupNode reads the current diagram's orientation
 * from this map and picks handle positions accordingly.
 */
export type HandleOrientation = 'vertical' | 'horizontal';

export const HANDLE_ORIENTATION: Record<DiagramType, HandleOrientation> = {
  crt: 'vertical',
  frt: 'vertical',
  prt: 'vertical',
  tt: 'vertical',
  ec: 'horizontal',
  st: 'vertical',
  freeform: 'vertical',
  goalTree: 'vertical',
};
