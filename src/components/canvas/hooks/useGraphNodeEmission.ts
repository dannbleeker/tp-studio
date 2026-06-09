import { useMemo } from 'react';
import { actionEligibility } from '@/domain/actionEligibility';
import { NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { rootCauseReachCounts, udeReachCounts } from '@/domain/coreDriver';
import { openCommentCountsByAnchor } from '@/domain/graph';
import { descendantEntityCount } from '@/domain/groups';
import { type DetailedRevisionDiff, entityStatusFromDiff } from '@/domain/revisions';
import { effectiveState } from '@/domain/statePropagation';
import type { Entity, EntityId, EntityState, TPDocument } from '@/domain/types';
import { Z } from '@/domain/zLayers';
import type { AnyTPNode, TPCollapsedGroupNode, TPGroupNode, TPNode } from '../edges/flow-types';
import {
  COLLAPSED_HEIGHT,
  COLLAPSED_WIDTH,
  GROUP_PADDING,
  GROUP_TITLE_TOP,
  nodeSizeFor,
} from './graphViewConstants';
import { collapsedGroupAriaLabel, entityAriaLabel, groupAriaLabel } from './nodeAriaLabels';
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
  compareDiff: DetailedRevisionDiff | null = null,
  derivedStates: Record<EntityId, EntityState> = {},
  speculationOverlay: Record<string, EntityState> | null = null,
  showActionEligibility = false
): AnyTPNode[] => {
  // Session 135 / Perf #19 — hoist the reach BFS out of the
  // position-sensitive memo below. The main emission memo re-runs on
  // every `positions` change (i.e. every drag frame), but the reach
  // counts depend only on the doc's topology — so computing them in a
  // topology-keyed memo keeps the O(V·(V+E)) walk off the drag path.
  // (The functions are also WeakMap-cached internally, Perf #20.)
  //
  // Keyed on `doc.entities` + `doc.edges` — the ONLY fields `udeReachCounts` /
  // `rootCauseReachCounts` read (both WeakMap-cached on exactly that pair). A
  // non-structural doc edit (a CLR-resolve toggle, a document title/description
  // change) leaves those refs intact, so the reach memos — and the emission
  // memo that depends on their result — skip the recompute entirely.
  // biome-ignore lint/correctness/useExhaustiveDependencies: passes the whole `doc` but reads only its entities + edges; narrowed deliberately.
  const reachCounts = useMemo(() => udeReachCounts(doc), [doc.entities, doc.edges]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: topology-only, same as reachCounts above.
  const reverseReachCounts = useMemo(() => rootCauseReachCounts(doc), [doc.entities, doc.edges]);
  // Open-comment counts per entity, keyed on `doc.comments` so the badge
  // tracks comment add/resolve/delete but stays off the drag path (the
  // big emission memo re-runs on every `positions` change).
  const commentCounts = useMemo(() => openCommentCountsByAnchor(doc.comments), [doc.comments]);

  // Keyed on the structural doc fields this memo actually reads —
  // `entities` + `assumptions` + `groups` (directly + via descendantEntityCount),
  // `edges` (via actionEligibility), `customEntityClasses` (ariaLabel) — NOT the
  // whole `doc`. So a non-structural mutation (CLR-resolve, document title /
  // description) doesn't rebuild every node object. Audited: these are the only
  // `doc.*` accesses in the memo body + its callees.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `doc` is read whole but only via its entities/assumptions/groups/edges/customEntityClasses; narrowed deliberately.
  return useMemo(() => {
    const {
      proj,
      visibleEntityIds,
      visibleCollapsedRoots,
      visibleCollapsedRootsSet,
      hoistVisibleGroups,
      hiddenCountByCollapser,
    } = projection;

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
        // Only visible members (an entity or a collapsed-root) contribute to
        // the group rect; members hidden inside a collapse are skipped. Size
        // via the shared `nodeSizeFor` rule so an S&T-format member contributes
        // its true (taller) height to the bbox.
        if (!visibleEntityIds.has(id) && !visibleCollapsedRootsSet.has(id)) continue;
        const size = nodeSizeFor(doc, id);
        if (!size) continue;
        const { width: w, height: h } = size;
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
        // Session 135 — accessible name for screen readers: title +
        // transitive entity count + collapsed/archived modifiers.
        ariaLabel: groupAriaLabel(group, descendantEntityCount(doc, group.id)),
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
      // Record-canonical: assumptions are emitted from doc.assumptions below, not
      // from the entity loop (they are transitioning out of doc.entities).
      if (entity.type === 'assumption') continue;
      const hidden = hiddenCountByCollapser.get(entity.id);
      const reach = reachCounts.get(entity.id);
      const reverseReach = reverseReachCounts.get(entity.id);
      const openComments = commentCounts.byEntity.get(entity.id);
      // H2: resolve diff status against the compare revision when active.
      // 'removed' entities live only in the snapshot, so we skip stamping
      // here — the dialog/overlay surfaces them separately.
      const diffStatus = compareDiff
        ? (() => {
            const s = entityStatusFromDiff(compareDiff, entity.id);
            return s === 'unchanged' ? undefined : s === 'removed' ? undefined : s;
          })()
        : undefined;
      // Session 135 / spec gap #4 — effective state for the canvas
      // badge. `effectiveState` folds in the speculation overlay (when
      // active) → manual `entity.state` → propagation-derived. We omit
      // the field entirely for `'unknown'` so untagged diagrams render
      // no badges. `speculated` flags a value sourced from an active
      // override so the badge can read as "hypothetical".
      const effState = effectiveState(entity, derivedStates, speculationOverlay ?? undefined);
      const speculated = speculationOverlay ? entity.id in speculationOverlay : false;
      // Session 135 — opt-in at-a-glance eligibility badge for TT Action
      // nodes. Only folded when the toggle is on; `'na'` (an action with
      // no precondition slot, or any non-action) is dropped so no badge
      // renders. Overlay-aware via the same `effectiveState` inputs.
      const eligibility =
        showActionEligibility && entity.type === 'action'
          ? actionEligibility(doc, derivedStates, entity.id, speculationOverlay ?? undefined).status
          : 'na';
      // Session 135 — accessible name for the React Flow node wrapper.
      // Composes the same data the visual badges encode: type + title +
      // ordering + locus + state (with speculative marker) + eligibility.
      const ariaLabel = entityAriaLabel(entity, {
        ...(doc.customEntityClasses ? { customClasses: doc.customEntityClasses } : {}),
        effectiveState: effState,
        speculated,
        ...(eligibility !== 'na' ? { eligibility } : {}),
      });
      const node: TPNode = {
        id: entity.id,
        type: 'tp',
        position: positions[entity.id] ?? { x: 0, y: 0 },
        ariaLabel,
        // Explicit width / height so React Flow's MiniMap can compute
        // node thumbnails before the live DOM has been measured (Session
        // 87 UX fix #1 follow-up: pre-fix the MiniMap rendered as an
        // empty grey rectangle because `nodesDraggable={false}` keeps
        // React Flow's internal measurement state at 0×0 for static
        // nodes). The actual rendered size still comes from the CSS
        // box in TPNode, so this is purely a measurement hint for the
        // MiniMap; downstream consumers that need real measurements
        // (e.g. the splice-target hit test) still read the live DOM.
        // S&T-format entities render taller — size via the shared `nodeSizeFor`
        // rule so this hint matches the layout/router box rather than being a
        // flat NODE_MIN_HEIGHT (which under-sized S&T cards in the MiniMap).
        ...(nodeSizeFor(doc, entity.id) ?? { width: NODE_WIDTH, height: NODE_MIN_HEIGHT }),
        data: {
          entity,
          ...(hidden && hidden > 0 ? { hiddenDescendantCount: hidden } : {}),
          ...(reach && reach > 0 ? { udeReachCount: reach } : {}),
          ...(reverseReach && reverseReach > 0 ? { rootCauseReachCount: reverseReach } : {}),
          ...(openComments && openComments > 0 ? { openCommentCount: openComments } : {}),
          ...(diffStatus ? { diffStatus } : {}),
          ...(effState !== 'unknown' ? { effectiveState: effState } : {}),
          ...(speculated ? { speculated: true } : {}),
          ...(eligibility !== 'na' ? { eligibility } : {}),
        },
      };
      nodes.push(node);
    }

    // Assumption nodes — record-canonical. Assumptions live in `doc.assumptions`
    // (not `doc.entities`); synthesize the minimal entity shape TPNode renders
    // from. Emit only when placement gave the card a position (an unplaced
    // assumption — e.g. its host edge sits in a collapsed group — isn't shown).
    for (const a of Object.values(doc.assumptions ?? {})) {
      const position = positions[a.id];
      if (!position) continue;
      const synthEntity: Entity = {
        id: a.id as EntityId,
        type: 'assumption',
        title: a.text,
        annotationNumber: a.annotationNumber ?? 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
      const openComments = commentCounts.byAssumption.get(a.id);
      const diffStatus = compareDiff
        ? (() => {
            const s = entityStatusFromDiff(compareDiff, a.id);
            return s === 'unchanged' || s === 'removed' ? undefined : s;
          })()
        : undefined;
      nodes.push({
        id: a.id,
        type: 'tp',
        position,
        ariaLabel: entityAriaLabel(
          synthEntity,
          doc.customEntityClasses ? { customClasses: doc.customEntityClasses } : {}
        ),
        width: NODE_WIDTH,
        height: NODE_MIN_HEIGHT,
        data: {
          entity: synthEntity,
          ...(openComments && openComments > 0 ? { openCommentCount: openComments } : {}),
          ...(diffStatus ? { diffStatus } : {}),
        },
      });
    }

    // Collapsed-root cards
    for (const groupId of visibleCollapsedRoots) {
      const group = doc.groups[groupId];
      if (!group) continue;
      const memberCount = descendantEntityCount(doc, groupId);
      const node: TPCollapsedGroupNode = {
        id: group.id,
        type: 'tpCollapsedGroup',
        position: positions[groupId] ?? { x: 0, y: 0 },
        // Same measurement-hint rationale as the TPNode branch above.
        width: COLLAPSED_WIDTH,
        height: COLLAPSED_HEIGHT,
        // Session 135 — "Collapsed group: title (N hidden)" so screen
        // readers announce what this single card stands in for.
        ariaLabel: collapsedGroupAriaLabel(group, memberCount),
        data: { group, memberCount, width: COLLAPSED_WIDTH, height: COLLAPSED_HEIGHT },
      };
      nodes.push(node);
    }

    return nodes;
  }, [
    doc.entities,
    doc.assumptions,
    doc.groups,
    doc.edges,
    doc.customEntityClasses,
    projection,
    positions,
    compareDiff,
    derivedStates,
    speculationOverlay,
    reachCounts,
    reverseReachCounts,
    commentCounts,
    showActionEligibility,
  ]);
};
