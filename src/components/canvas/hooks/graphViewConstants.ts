/**
 * Constants shared across the three `useGraphView` sub-hooks. They lived as
 * file-local consts in the original monolithic hook; lifting them here lets
 * `useGraphPositions` (which needs the collapsed-card geometry to size dagre
 * nodes) and `useGraphEmission` (which renders the cards and the group
 * rectangles around them) read the same numbers without re-declaring them.
 */

import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT } from '@/domain/constants';
import { isStNodeFormat } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';

/** Padding around a group's bounding box on every side. */
export const GROUP_PADDING = 24;
/** Extra top padding inside a group rect to reserve space for the title row. */
export const GROUP_TITLE_TOP = 14;
/** Collapsed-group card width — also the width dagre uses when laying out a
 *  collapsed group as a single virtual node. */
export const COLLAPSED_WIDTH = 220;
/** Collapsed-group card height — same dual role as `COLLAPSED_WIDTH`. */
export const COLLAPSED_HEIGHT = 90;

/**
 * Canonical render/layout size of a visible node, by id — the ONE place the
 * "how big is this node?" rule lives. Every pipeline stage that needs a node's
 * box (dagre layout inputs, A\* obstacle boxes, group-rect bbox, the MiniMap
 * measurement hint) calls this, so a node type's dimensions can't drift between
 * them and adding a new sized type is a one-line change here.
 *
 *   - entity            → `NODE_WIDTH`, and `ST_NODE_HEIGHT` for an S&T-format
 *                         entity, else `NODE_MIN_HEIGHT`;
 *   - collapsed-root    → `COLLAPSED_WIDTH × COLLAPSED_HEIGHT`;
 *   - neither (unknown) → `null`, so callers skip it (e.g. as a non-obstacle).
 */
export const nodeSizeFor = (
  doc: TPDocument,
  id: string
): { width: number; height: number } | null => {
  const entity = doc.entities[id];
  if (entity) {
    return { width: NODE_WIDTH, height: isStNodeFormat(entity) ? ST_NODE_HEIGHT : NODE_MIN_HEIGHT };
  }
  if (doc.groups[id]) return { width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT };
  return null;
};
