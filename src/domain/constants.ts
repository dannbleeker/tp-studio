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
export const LAYOUT_RANK_SEPARATION = 80;
export const LAYOUT_NODE_SEPARATION = 40;
// TPNode "zoom-up" pop-out: when the viewport zoom drops below this and the
// node is selected/hovered, render the magnified title overlay so titles
// stay legible at low zoom. Lives here next to other canvas tunables so
// UI/UX can adjust from one place.
export const ZOOM_UP_THRESHOLD = 0.7;

// --- Sibling-arrow nav tolerance ---
export const SIBLING_Y_TOLERANCE_PX = 60;

// --- Export ---
export const PNG_PIXEL_RATIO = 2;
export const PNG_PADDING = 32;

// --- Toast ---
export const TOAST_AUTO_DISMISS_MS = 2200;

// --- Stacking order (z-index scale) ---
// Canonical layering table lives in `@/domain/zLayers` (named `Z`, with a
// richer tier breakdown including React Flow's internal layers). The
// session-68 "centralize z-index" item was a duplicate — `zLayers.ts`
// predated it and is the source of truth. Kept this comment so a future
// grep for `Z_LEVELS` (the duplicate's old name) lands somewhere helpful.
