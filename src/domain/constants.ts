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
export const LAYOUT_RANK_SEPARATION = 80;
export const LAYOUT_NODE_SEPARATION = 40;

// --- Sibling-arrow nav tolerance ---
export const SIBLING_Y_TOLERANCE_PX = 60;

// --- Export ---
export const PNG_PIXEL_RATIO = 2;
export const PNG_PADDING = 32;

// --- Toast ---
export const TOAST_AUTO_DISMISS_MS = 2200;
