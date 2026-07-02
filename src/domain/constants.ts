// Single home for tunable thresholds, layout sizes, and other "magic numbers".
// Keep these named — a future maintainer should be able to grep here first.

// --- History ---
export const HISTORY_LIMIT = 100;
export const COALESCE_WINDOW_MS = 1000;

// --- CLR validator thresholds ---
export const CLARITY_WORD_LIMIT = 25;
export const DISCONNECTED_GRAPH_FLOOR = 3;
export const SIMILARITY_THRESHOLD = 0.85;

// --- Canvas / layout ---
export const NODE_WIDTH = 220;
export const NODE_MIN_HEIGHT = 72;
// Session 76 — first-class S&T 5-facet rendering. When an injection
// entity in an `'st'` diagram carries the reserved facet attributes
// (stStrategy / stNecessaryAssumption / stParallelAssumption /
// stSufficiencyAssumption), TPNode renders a taller 5-row card. The
// height accommodates 4 facet rows plus the tactic title; long text
// in any row truncates with ellipsis rather than wrapping freely so
// dagre's layout math stays predictable.
export const ST_NODE_HEIGHT = 220;
// Derived halves — keep the divisions here so any future tweak to the base
// dimensions doesn't leave stale `220 / 2` literals scattered around the
// renderers. Used by side-by-side compare (SVG edge endpoints) and anywhere
// else that needs the visual center of a card.
export const NODE_HALF_WIDTH = NODE_WIDTH / 2;
export const NODE_HALF_HEIGHT = NODE_MIN_HEIGHT / 2;
// Session 136 — tightened from 80/40 to 60/32 per Dann's "entities
// should pull closer when there's slack" usage feedback. The previous
// values left visible gaps between ranks on small graphs; 60 px is
// enough headroom for an edge label without making the diagram feel
// stretched. nodeSep dropped to 32 (down from 40) to match — the
// horizontal gap between siblings was the most visible "this could
// be tighter" axis. If a future use-case wants the looser layout
// (high-density EC walls, projector mode), the doc-level
// `layoutConfig.rankSep` / `.nodeSep` override these per document.
// Raised 60 → 80 (Dann's "the vertical space between entities should be higher
// to make it look nice"). Junctor diagrams floor higher still — see
// LAYOUT_RANK_SEPARATION_JUNCTOR_MIN; density presets scale this ×0.75 / ×1.5.
export const LAYOUT_RANK_SEPARATION = 80;
export const LAYOUT_NODE_SEPARATION = 32;

// --- Adaptive rank spacing (Session 146) ---
// When a node fans wide (many causes converging on one effect, or one cause
// branching to many effects), vertical-entry connectors get steep. Widening
// the gap between ranks gives those diagonals a gentler angle so the map
// "flows better". The bonus scales with the widest fan in the graph and is
// hard-capped so a huge fan can't blow the diagram up. Binary / linear trees
// (fan ≤ the threshold) get NO bonus — they already read cleanly, and this
// keeps the common case (and its layout tests) unchanged.
//   effectiveRankSep = LAYOUT_RANK_SEPARATION
//     + min((maxFan − THRESHOLD) × FAN_STEP, MAX_BONUS),  clamped at 0 below.
/** Fan-out (max in/out-degree) at or below which no extra spacing is added. */
export const LAYOUT_FANOUT_BONUS_THRESHOLD = 2;
/** Extra px of rank gap per branch beyond the threshold. */
export const LAYOUT_RANK_SEPARATION_FAN_STEP = 14;
/** Hard cap on the adaptive addition (so ranksep tops out at 80 + 90 = 170). */
export const LAYOUT_RANK_SEPARATION_MAX_BONUS = 90;
// Minimum rank separation when the diagram contains AND/OR/XOR junctors. The
// junctor circle sits ~49 px below its target's bottom handle (the cause-edges
// terminate at the circle's bottom). At 90 px the cause rank cleared the circle
// but sat barely below it, so a cause that's horizontally offset from the circle
// entered almost flat — "it enters from the side" / "more space below the AND".
// Now the circle sits over its causes (Session 171), so the remaining fix is
// vertical: open enough gap below the circle that each cause rises into it at a
// readable angle. 160 leaves ~110 px of rise below the circle — the causes
// "converge from below" instead of sweeping in horizontally. Applied as a FLOOR
// on the (possibly fanout-boosted) rank separation; only junctor diagrams pay it.
export const LAYOUT_RANK_SEPARATION_JUNCTOR_MIN = 160;

// --- Junctor geometry ---
// Session 101 — these were declared TWICE: once in `JunctorOverlay.tsx`
// and once in `TPEdge.tsx`, with identical values. A future tweak in
// one file without the other would have made the bezier terminus stop
// landing on the junctor circle's perimeter (TPEdge ends its source-
// side bezier at `targetY + JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS`,
// which is the BOTTOM of the circle JunctorOverlay paints). Pulled
// here so the two files always agree.
//
// `JUNCTOR_CENTER_OFFSET_Y` is the distance from a target node's
// bottom edge to the center of the junctor circle. `JUNCTOR_RADIUS`
// is the circle's radius. The sum is the bezier terminus offset.
export const JUNCTOR_CENTER_OFFSET_Y = 35;
export const JUNCTOR_RADIUS = 14;
// The junctor marker renders as a horizontal ELLIPSE (the classic TP /
// Flying-Logic AND-connector shape), so its visible half-width is
// `JUNCTOR_RADIUS_X` while the vertical radius stays `JUNCTOR_RADIUS`. Keeping
// the vertical radius unchanged means the bezier terminus (center + RADIUS)
// and the short arrow line are untouched — only the marker looks oval.
export const JUNCTOR_RADIUS_X = 19;
export const JUNCTOR_EDGE_TERMINAL_OFFSET_Y = JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS;
// Goal #2 — invisible drag-drop catch radius for the junctor circle. A
// larger transparent circle behind the visible one makes "drop a connection
// onto the junctor to join it" forgiving WITHOUT enlarging the visible
// circle, so the bezier terminus above stays put (it depends only on the
// visible `JUNCTOR_RADIUS`).
export const JUNCTOR_HIT_RADIUS = 22;

// --- Edge re-target handles ---
// Radius of the two small white knobs painted on a SELECTED edge's endpoints to
// advertise "grab an end and drop it on another entity". Purely visual — React
// Flow's own reconnect catch zone (the `reconnectRadius` prop on <ReactFlow>, 24)
// is what actually captures the drag, so this stays small and sits inside it.
export const EDGE_RECONNECT_HANDLE_RADIUS = 5;

// TPNode "zoom-up" pop-out: when the viewport zoom drops below this and the
// node is selected/hovered, render the magnified title overlay so titles
// stay legible at low zoom. Lives here next to other canvas tunables so
// UI/UX can adjust from one place.
export const ZOOM_UP_THRESHOLD = 0.7;

// --- Export ---
export const PNG_PIXEL_RATIO = 2;
export const PNG_PADDING = 32;

// --- Toast ---
/**
 * Session 91 — per-kind auto-dismiss defaults.
 *
 * The previous single 2200 ms value treated all toasts equally and was
 * the source of two ongoing UX complaints:
 *   - **info** toasts (especially the PWA "New version available")
 *     were dismissed before users finished reading them.
 *   - **error** toasts vanished too quickly to act on; a user who
 *     glanced away during an import would miss the line number.
 *
 * The new defaults grade by urgency: success (acknowledgement) stays
 * short, info (announcement) gets longer, error (actionable) is longest.
 *
 * Individual call-sites can override via `showToast(kind, message, {
 * durationMs })` — used by the PWA update toast which wants more dwell
 * time than even the new info default.
 */
export const TOAST_AUTO_DISMISS_MS_BY_KIND = {
  info: 6000,
  success: 4000,
  error: 10000,
} as const;

// --- Stacking order (z-index scale) ---
// Canonical layering table lives in `@/domain/zLayers` (named `Z`, with a
// richer tier breakdown including React Flow's internal layers). The
// session-68 "centralize z-index" item was a duplicate — `zLayers.ts`
// predated it and is the source of truth. Kept this comment so a future
// grep for `Z_LEVELS` (the duplicate's old name) lands somewhere helpful.
