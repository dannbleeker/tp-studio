import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { rootCauseReachCounts, udeReachCounts } from '@/domain/coreDriver';
import { descendantIds } from '@/domain/groups';
import { type DetailedRevisionDiff, entityStatusFromDiff } from '@/domain/revisions';
import type { TPDocument } from '@/domain/types';
import { Z } from '@/domain/zLayers';
import { useMemo } from 'react';
import type { AnyTPNode, TPCollapsedGroupNode, TPGroupNode, TPNode } from './flow-types';
import {
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
  GROUP_PADDING,
  GROUP_TITLE_TOP,
} from './graphViewConstants';
import type { GraphPositions } from './useGraphPositions';
import type { GraphProjection } from './useGraphProjection';

/**
 * Stage 3a of the graph-view pipeline: emit the React Flow `nodes` array
 * (three kinds — group rectangles, entity nodes, collapsed-root cards).
 *
 * Splitting node and edge emission (Session 39, #9 from the next-batch
 * top-10) tightens each useMemo's dependency surface. Nodes depend on
 * `(doc, projection, positions)` because their coordinates and group-rect
 * bounds both come from `positions`. Edges have NO positional dependency
 * (their geometry is computed at render time by React Flow's bezier
 * routing), so they can stay memoized across drag-to-reposition events
 * on manual-layout diagrams. Previously the combined emission re-ran the
 * edge bucket-aggregation pass every time a position changed.
 */
export const useGraphNodeEmission = (
  doc: TPDocument,
  projection: GraphProjection,
  positions: GraphPositions,
  compareDiff: DetailedRevisionDiff | null = null
): AnyTPNode[] => {
  return useMemo(() => {
    const {
      proj,
      visibleEntityIds,
      visibleCollapsedRoots,
      hoistVisibleGroups,
      hiddenCountByCollapser,
    } = projection;

    // Pre-compute UDE reach counts once per doc change — used for the
    // optional reach badge. Empty for diagrams without UDEs.
    const reachCounts = udeReachCounts(doc);
    // E2: reverse reach (root-cause count). Empty for diagrams without
    // `rootCause` entities (PRT / TT / EC).
    const reverseReachCounts = rootCauseReachCounts(doc);

    const nodes: AnyTPNode[] = [];

    // Group rectangles: only for groups that are NOT collapsed, NOT inside
    // a collapsed parent, AND inside the hoisted scope.
    for (const group of Object.values(doc.groups)) {
      if (group.collapsed) continue;
      if (!hoistVisibleGroups.has(group.id)) continue;
      if (proj.groupToCollapsedRoot.has(group.id)) continue;
      // Session 107 — single-pass bbox.
      //
      // The previous implementation built a `memberPositions` array, then
      // ran `Math.min(...arr.map(...))` four times (left / top / right /
      // bottom) plus the spread operator. That's 4 fresh arrays + 4
      // spread calls allocated per group per emission run.
      // `useGraphNodeEmission` re-runs on every doc / projection /
      // positions change (positions change on every drag tick), so for
      // a doc with 5 groups × 4 transient allocations × 60 frames /
      // second during drag, that's ~1200 ephemeral arrays per second
      // — pure GC pressure. Replaced with one pass that tracks the
      // running min/max directly. Same output; no allocations beyond
      // the four numbers.
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      let hasMembers = false;
      for (const id of group.memberIds) {
        const p = positions[id];
        if (!p) continue;
        let w: number;
        let h: number;
        if (visibleEntityIds.has(id)) {
          w = NODE_WIDTH;
          h = NODE_MIN_HEIGHT;
        } else if (visibleCollapsedRoots.includes(id)) {
          w = COLLAPSED_WIDTH;
          h = COLLAPSED_HEIGHT;
        } else {
          continue;
        }
        hasMembers = true;
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        const right = p.x + w;
        const bottom = p.y + h;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
      if (!hasMembers) continue;
      minX -= GROUP_PADDING;
      minY -= GROUP_PADDING + GROUP_TITLE_TOP;
      maxX += GROUP_PADDING;
      maxY += GROUP_PADDING;
      const groupW = maxX - minX;
      const groupH = maxY - minY;
      const node: TPGroupNode = {
        id: group.id,
        type: 'tpGroup',
        position: { x: minX, y: minY },
        // Top-level width/height for MiniMap thumbnail computation; the
        // group's actual visible bounds are still driven by data.{width,
        // height} via the TPGroupNode renderer.
        width: groupW,
        height: groupH,
        data: { group, width: groupW, height: groupH },
        selectable: true,
        draggable: false,
        zIndex: Z.below,
      };
      nodes.push(node);
    }

    // Entity nodes
    for (const id of visibleEntityIds) {
      const entity = doc.entities[id];
      if (!entity) continue;
      const hidden = hiddenCountByCollapser.get(entity.id);
      const reach = reachCounts.get(entity.id);
      const reverseReach = reverseReachCounts.get(entity.id);
      // H2: resolve diff status against the compare revision when active.
      // 'removed' entities live only in the snapshot, so we skip stamping
      // here — the dialog/overlay surfaces them separately.
      const diffStatus = compareDiff
        ? (() => {
            const s = entityStatusFromDiff(compareDiff, entity.id);
            return s === 'unchanged' ? undefined : s === 'removed' ? undefined : s;
          })()
        : undefined;
      const node: TPNode = {
        id: entity.id,
        type: 'tp',
        position: positions[entity.id] ?? { x: 0, y: 0 },
        // Explicit width / height so React Flow's MiniMap can compute
        // node thumbnails before the live DOM has been measured (Session
        // 87 UX fix #1 follow-up: pre-fix the MiniMap rendered as an
        // empty grey rectangle because `nodesDraggable={false}` keeps
        // React Flow's internal measurement state at 0×0 for static
        // nodes). The actual rendered size still comes from the CSS
        // box in TPNode, so this is purely a measurement hint for the
        // MiniMap; downstream consumers that need real measurements
        // (e.g. the splice-target hit test) still read the live DOM.
        width: NODE_WIDTH,
        height: NODE_MIN_HEIGHT,
        data: {
          entity,
          ...(hidden && hidden > 0 ? { hiddenDescendantCount: hidden } : {}),
          ...(reach && reach > 0 ? { udeReachCount: reach } : {}),
          ...(reverseReach && reverseReach > 0 ? { rootCauseReachCount: reverseReach } : {}),
          ...(diffStatus ? { diffStatus } : {}),
        },
      };
      nodes.push(node);
    }

    // Collapsed-root cards
    for (const groupId of visibleCollapsedRoots) {
      const group = doc.groups[groupId];
      if (!group) continue;
      const memberCount = [...descendantIds(doc, groupId)].filter((m) => doc.entities[m]).length;
      const node: TPCollapsedGroupNode = {
        id: group.id,
        type: 'tpCollapsedGroup',
        position: positions[groupId] ?? { x: 0, y: 0 },
        // Same measurement-hint rationale as the TPNode branch above.
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
        data: { group, memberCount, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT },
      };
      nodes.push(node);
    }

    return nodes;
  }, [doc, projection, positions, compareDiff]);
};
