/**
 * Constants shared across the three `useGraphView` sub-hooks. They lived as
 * file-local consts in the original monolithic hook; lifting them here lets
 * `useGraphPositions` (which needs the collapsed-card geometry to size dagre
 * nodes) and `useGraphEmission` (which renders the cards and the group
 * rectangles around them) read the same numbers without re-declaring them.
 */

/** Padding around a group's bounding box on every side. */
export const GROUP_PADDING = 24;
/** Extra top padding inside a group rect to reserve space for the title row. */
export const GROUP_TITLE_TOP = 14;
/** Collapsed-group card width — also the width dagre uses when laying out a
 *  collapsed group as a single virtual node. */
export const COLLAPSED_WIDTH = 220;
/** Collapsed-group card height — same dual role as `COLLAPSED_WIDTH`. */
export const COLLAPSED_HEIGHT = 90;
