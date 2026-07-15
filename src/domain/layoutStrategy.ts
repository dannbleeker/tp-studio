import type { LayoutMode } from '@/store/uiSlice/types';
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
  // FL-DT5: free-form diagrams use dagre auto-layout (Goal #4 — auto-layout
  // is authoritative; stored positions are ignored). A future option could
  // make `freeform` default to `manual` so every node is hand-placed; for
  // now auto-layout is the cheapest path.
  freeform: 'auto',
  // Session 134 / spec major gap #5 — NBR is a forward-causal tree
  // like FRT; auto-layout via dagre gives the right visual default
  // (injection at the bottom, UDEs at the top).
  nbr: 'auto',
  // Session 77: Goal Tree — strict top-to-bottom hierarchy. Auto-layout
  // handles it cleanly via dagre with `direction: 'TB'`.
  goalTree: 'auto',
  // Interference Diagram — auto-layout (positions are computed, not stored),
  // but forced to the radial engine via FORCE_RADIAL below rather than dagre.
  id: 'auto',
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
  nbr: 'vertical',
  id: 'vertical',
};

/**
 * Diagram types that FORCE the radial layout regardless of the global
 * `layoutMode` toggle. The Interference Diagram is inherently a hub-and-spoke
 * radial map — the objective sits at the centre with interferences radiating
 * outward — so the flow/radial toggle is meaningless for it.
 *
 * Kept as a separate `Partial<Record>` rather than a third `LayoutStrategy`
 * value on purpose: `layoutMode` is a *global* persisted preference, so a
 * forced-radial diagram must compute radial positions WITHOUT mutating that
 * preference — otherwise opening an ID would flip a CRT in another tab into
 * radial too. Every layout-computation read of `layoutMode` routes through
 * `effectiveLayoutMode` below so the override is honoured in one place.
 */
export const FORCE_RADIAL: Partial<Record<DiagramType, boolean>> = {
  id: true,
};

/**
 * The layout mode a given diagram type actually renders in. Forced-radial
 * types (see `FORCE_RADIAL`) always compute radial; every other type honours
 * the global `layoutMode`. While `FORCE_RADIAL` is empty this is the identity
 * on `mode`, so wiring the layout reads through it is behaviour-preserving.
 */
export function effectiveLayoutMode(diagramType: DiagramType, mode: LayoutMode): LayoutMode {
  return FORCE_RADIAL[diagramType] ? 'radial' : mode;
}
