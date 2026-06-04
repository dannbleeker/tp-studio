// Session 119 — note on React Compiler interaction (see TPNode.tsx
// for the same note in fuller form). `TPEdgeImpl` is wrapped in
// `memo(impl, tpEdgePropsEqual)`. The Compiler recognises explicit
// `memo()` and skips auto-memoization for the wrapped component, so
// the Session 105 comparator's behavior stays intact.

import { BaseEdge, type EdgeProps, getBezierPath, Position } from '@xyflow/react';
import { memo } from 'react';
import { useShallow } from 'zustand/shallow';
import { EDGE_RECONNECT_HANDLE_RADIUS, JUNCTOR_EDGE_TERMINAL_OFFSET_Y } from '@/domain/constants';
import { EDGE_PALETTES } from '@/domain/tokens';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { ARROW_TRIANGLE_D, arrowheadOnPath, arrowheadTransform } from './edgeArrowhead';
import { resolveEdgeVisuals } from './edgeVisuals';
import type { TPEdge as TPEdgeType } from './flow-types';
import { computeMutexPath, resolveEdgePath } from './resolveEdgePath';
import {
  AggregateBadge,
  AssumptionBadge,
  BackEdgeBadge,
  CommentBadge,
  DescriptionBadge,
  EdgeInlineLabel,
  FallbackLabel,
  MutexBadge,
  WeightBadge,
} from './TPEdgeBadges';
import { useJunctorCenterX, useJunctorSourceAnchor } from './useJunctorCenterX';
import { useRadialRoute } from './useRadialRoute';

/** E5: maximum characters shown inline on an edge label before truncating
 *  with an ellipsis. The full text remains available via the native HTML
 *  `title` attribute on hover. Earlier versions hid long labels entirely
 *  behind a tiny "i" icon, which made scanning a diagram for context
 *  impossible without hovering each edge. */
const LABEL_INLINE_MAX = 30;

/** E1: invisible halo around the stroke that captures clicks. React Flow's
 *  default is 20 px; we bump it so a slightly-imprecise click on a thin
 *  edge still selects it. The halo doesn't visibly render — it's just a
 *  transparent path beneath the visible stroke.
 *  Session 133 — bumped 32 → 48 in response to user feedback that edges
 *  are still hard to grab when nodes are close together.
 *  Goal #2 — 48 → 56 so dragging a connection onto an edge (the "drop to
 *  AND" gesture) lands more easily; still narrow enough that adjacent
 *  parallel edges don't fight each other on the hover. */
const EDGE_INTERACTION_WIDTH = 56;

/**
 * E6: for AND-grouped non-aggregated edges, the visible edge segment stops
 * at a "junctor" point sitting just below the target node, rather than at
 * the target's handle itself. JunctorOverlay renders the junctor circle
 * (with the "AND" / "OR" / "XOR" label) and a single short outgoing arrow
 * from junctor up into the target's bottom handle. This matches Flying
 * Logic's visual convention: multiple causes converge into a labelled
 * circle, one line continues to the effect above.
 *
 * Source-side bezier curves terminate at the BOTTOM of the junctor circle
 * (`targetY + JUNCTOR_EDGE_TERMINAL_OFFSET_Y`) rather than the center — that
 * keeps bezier strokes outside the circle interior so the white-filled
 * circle reads as an opaque junction rather than a transparent disc with
 * lines visible through it.
 *
 * Session 101 — pulled `JUNCTOR_CENTER_OFFSET_Y` / `JUNCTOR_RADIUS` /
 * `JUNCTOR_EDGE_TERMINAL_OFFSET_Y` into `@/domain/constants`; they were
 * previously declared in both this file AND `JunctorOverlay.tsx` with
 * identical values, which would have silently drifted under any future
 * tweak.
 *
 * Session 113 — memo comparator + `shallowEqualObject` helper extracted
 * into `./tpEdgeComparator.ts`. Both are pure functions and the unit
 * tests against them are easier to read when they sit next to the
 * comparator's source rather than importing through a render-laden
 * component. No behavior change.
 */
import { reconnectHandlesVisible } from './reconnectHandles';
import { shallowEqualObject, tpEdgePropsEqual } from './tpEdgeComparator';

export { shallowEqualObject, tpEdgePropsEqual };

function TPEdgeImpl(props: EdgeProps<TPEdgeType>) {
  const isAnd = Boolean(props.data?.andGroupId);
  // Bundle 8: OR and XOR junctors render via the same JunctorOverlay
  // pipeline, so TPEdge redirects the bezier endpoint identically for
  // all three kinds. The visual differentiation lives in the overlay
  // (circle color + label), not in the edge body.
  const isOr = Boolean(props.data?.orGroupId);
  const isXor = Boolean(props.data?.xorGroupId);
  const isJunctorGroup = isAnd || isOr || isXor;
  const aggregateCount = props.data?.aggregateCount ?? 0;
  const isJunctorEdge = isJunctorGroup && aggregateCount <= 1;

  // Redirect the bezier endpoint to the junctor's BOTTOM perimeter (not its
  // center) so source-side curves stop before entering the white-filled
  // circle. `props.targetY` is the bottom edge of the target node (where
  // its Position.Bottom handle sits).
  const effectiveTargetY = isJunctorEdge
    ? props.targetY + JUNCTOR_EDGE_TERMINAL_OFFSET_Y
    : props.targetY;
  // Session 171 — and redirect the endpoint's X to the junctor's CENTER, which
  // now sits over the group's causes (not pinned under the target). That's what
  // makes each cause rise into the circle from below instead of sweeping in from
  // the side. `useJunctorCenterX` mirrors `JunctorOverlay`'s placement off the
  // same live node positions, so the edge terminus and the circle always agree;
  // it returns null for non-junctor edges, leaving React Flow's target-handle X.
  const junctorCenter = useJunctorCenterX({
    isJunctorEdge,
    groupField: isAnd ? 'andGroupId' : isOr ? 'orGroupId' : isXor ? 'xorGroupId' : null,
    groupId: props.data?.andGroupId ?? props.data?.orGroupId ?? props.data?.xorGroupId,
    targetX: props.targetX,
  });
  const effectiveTargetX = junctorCenter ?? props.targetX;

  // Junctor cause-edges skip the smart router, so their SOURCE would otherwise sit
  // at React Flow's raw handle point — the outer edge of the 20px handle, ~10px
  // off the card, leaving a visible gap at the cause. Re-anchor it on the source
  // node's real edge (routed edges already do this via the router), so the AND/OR/
  // XOR cause-edges meet their sender cards flush. A no-op for non-junctor edges
  // (returns the handle point unchanged), so the default bezier is unaffected.
  const sourceAxis: 'vertical' | 'horizontal' =
    props.sourcePosition === Position.Left || props.sourcePosition === Position.Right
      ? 'horizontal'
      : 'vertical';
  const sourceAnchor = useJunctorSourceAnchor({
    isJunctorEdge,
    sourceId: props.source,
    axis: sourceAxis,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
  });

  // Default bezier — what React Flow's source/target handle positions
  // produce. The mutex special-case below overrides this when both
  // endpoints resolve to vertically-stacked entity positions.
  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX: sourceAnchor.x,
    sourceY: sourceAnchor.y,
    targetX: effectiveTargetX,
    targetY: effectiveTargetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  // Session 105 / Tier 1 #1 — one shallow-equal selector returning a
  // flat record of all the per-edge primitives. Previously this file
  // had 8 separate `useDocumentStore` calls (label, assumptionCount,
  // isBackEdge, isMutex, weight, hasDescription, isSpliceTarget,
  // causalityLabel, diagramType), each registering its own
  // subscription with the store. On a 50-edge diagram that's 400
  // subscribers; every store change walked all 400 to check if the
  // selected primitive had changed. The shallow bundle collapses
  // to one subscriber per edge — the store still walks each subscriber
  // on each change, but only one per edge instead of eight.
  //
  // Session 135 / Perf #17 — the assumption count is no longer computed
  // here (it required iterating `doc.assumptions` per edge on every store
  // change, O(E·M)). `useGraphEdgeEmission` precomputes it once and stamps
  // it into `data.assumptionCount`, read below as an O(1) prop.
  const assumptionCount = props.data?.assumptionCount ?? 0;
  const openCommentCount = props.data?.openCommentCount ?? 0;
  const edgeView = useDocumentStore(
    useShallow((s) => {
      const doc = currentDoc(s);
      const edge = doc.edges[props.id];
      const desc = edge?.description;
      // Session 136 — note-touching edges render dotted (and a thinner
      // stroke) so they read as "annotation" rather than "causal".
      // Source-or-target is enough because notes never participate in
      // causal junctors, so we don't need to walk junctor membership.
      const sourceIsNote = edge ? doc.entities[edge.sourceId]?.type === 'note' : false;
      const targetIsNote = edge ? doc.entities[edge.targetId]?.type === 'note' : false;
      return {
        edgeLabel: edge?.label,
        isBackEdge: edge?.isBackEdge === true,
        isMutex: edge?.isMutualExclusion === true,
        weight: edge?.weight,
        hasDescription: typeof desc === 'string' && desc.trim().length > 0,
        isSpliceTarget: s.spliceTargetEdgeId === props.id,
        isConnectionDropTarget: s.connectionDropEdgeId === props.id,
        causalityLabel: s.causalityLabel,
        diagramType: doc.diagramType,
        isNoteEdge: sourceIsNote || targetIsNote,
        // Goal #3 — select-hover cue. `isHovered` is this edge under the
        // pointer; `isConnecting` is "a connection drag is in flight" (any
        // source), used to suppress the hover cue mid-drag so the
        // drop-target glow owns the visual.
        isHovered: s.hoveredEdgeId === props.id,
        isConnecting: s.connectingFromId != null,
        // Browse Lock disables the reconnect gesture (Canvas omits onReconnect),
        // so the visible re-target knobs hide too — no dangling affordance.
        browseLocked: s.browseLocked,
      };
    })
  );
  const {
    edgeLabel,
    isBackEdge,
    isMutex,
    weight,
    hasDescription,
    isSpliceTarget,
    isConnectionDropTarget,
    causalityLabel,
    diagramType,
    isNoteEdge,
    isHovered,
    isConnecting,
    browseLocked,
  } = edgeView;
  // Actions in their own shallow bundle. They're stable refs across
  // store snapshots, so this subscription effectively never fires —
  // it's bundled for symmetry with the primitives bundle above.
  const { selectEdge, setECInspectorTab } = useDocumentStore(
    useShallow((s) => ({
      selectEdge: s.selectEdge,
      setECInspectorTab: s.setECInspectorTab,
    }))
  );
  // Session 87 UX fix #5 — for the EC D↔D′ mutex edge, the default
  // Left/Right handle layout on EC entities sends the bezier looping
  // around the diagram (D's left side → D′'s right side, with both
  // wants stacked vertically). Pull the two entities' raw positions
  // from the store and draw a straight line from bottom-of-upper to
  // top-of-lower instead. Robust to user-dragged repositioning: the
  // "upper" / "lower" call is made by current y rather than by ecSlot
  // assignment, so the cleaner routing follows the visual layout even
  // when the user has dragged D and D′ around.
  //
  // Session 94 (Top-30 #2) — collapsed 4 separate primitive selectors
  // into one `useShallow` returning a flat record. Nested objects
  // would break shallow equality (each render emits fresh inner
  // `srcPos` / `tgtPos` references), so the selector returns 4
  // primitives at the top level and the component composes them.
  const mutexCoords = useDocumentStore(
    useShallow(
      (
        s
      ): {
        srcX?: number | undefined;
        srcY?: number | undefined;
        tgtX?: number | undefined;
        tgtY?: number | undefined;
      } => {
        if (!isMutex) return {};
        const doc = currentDoc(s);
        const edge = doc.edges[props.id];
        if (!edge) return {};
        const src = doc.entities[edge.sourceId]?.position;
        const tgt = doc.entities[edge.targetId]?.position;
        return { srcX: src?.x, srcY: src?.y, tgtX: tgt?.x, tgtY: tgt?.y };
      }
    )
  );
  const mutexEndpoints =
    isMutex &&
    typeof mutexCoords.srcX === 'number' &&
    typeof mutexCoords.srcY === 'number' &&
    typeof mutexCoords.tgtX === 'number' &&
    typeof mutexCoords.tgtY === 'number'
      ? {
          srcPos: { x: mutexCoords.srcX, y: mutexCoords.srcY },
          tgtPos: { x: mutexCoords.tgtX, y: mutexCoords.tgtY },
        }
      : null;

  // Mutex override (Session 87 UX #5) — a dead-straight line between the two
  // Wants' facing sides, from their raw entity positions. `mutexEndpoints` is
  // already null unless this is a mutex edge with both positions resolved, so
  // the call only fires when relevant. See `computeMutexPath`.
  const mutexPath = mutexEndpoints
    ? computeMutexPath(mutexEndpoints.srcPos, mutexEndpoints.tgtPos)
    : null;
  // Edge-color palette (Settings → Appearance → Edge palette). Reading the live
  // selection here is what makes the colorblind-safe / mono palettes actually
  // recolor edges; a stable primitive selector that changes only when the user
  // switches palette.
  const edgePalette = useDocumentStore((s) => s.edgePalette);
  const palette = EDGE_PALETTES[edgePalette];
  const hasMutexOverride = mutexPath !== null;
  // Session 99 — obstacle-aware routing for the radial layout. `useRadialRoute`
  // owns the two subscriptions (layout mode + React Flow's `nodes`) and the
  // position-keyed memo; it returns `null` in every non-radial / junctor / mutex
  // case so the resolver below falls through to the routed path or the default
  // bezier. (See the hook for the full rationale on why the flag gates the
  // React Flow `nodes` subscription independently.)
  const radialRoute = useRadialRoute({
    source: props.source,
    target: props.target,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    effectiveTargetY,
    isJunctorEdge,
    hasMutexOverride,
  });

  // Obstacle-aware edge routing — `data.route.d` is the precomputed SVG path
  // string from the dagre-mode smart router (see
  // `docs/EDGE_ROUTING_PROPOSAL.md` and `useEdgeRoutes`). The smart router is
  // the live default for flow layouts (Settings → Display → Edge routing), so
  // this is the primary path for most edges; the field is empty only when
  // routing is disabled or produced no detour. Order of precedence:
  //   1. Mutex override — bidirectional conflict, always wins.
  //   2. Radial mode's perpendicular-deflection router — only fires
  //      when `layoutMode === 'radial'`.
  //   3. Smart router's precomputed path — fires in flow layouts when present.
  //   4. Default bezier — fallback when no routed path applies.
  // The mid-label on a routed path is anchored at the midpoint *along the
  // route's waypoints* (see `resolveEdgePath`), so it rides a bent detour
  // instead of sitting at the straight bezier midpoint (which can land inside
  // an obstacle the route bends around).
  const routedPath = props.data?.route?.d;
  const { path, labelX, labelY } = resolveEdgePath({
    mutex: mutexPath,
    radial: radialRoute,
    routedPath,
    routeWaypoints: props.data?.route?.waypoints,
    bezier: { path: bezierPath, labelX: bezierLabelX, labelY: bezierLabelY },
  });

  // `weight`, `hasDescription`, `isSpliceTarget`, `causalityLabel`,
  // `diagramType` were previously individual `useDocumentStore` calls;
  // Session 105 consolidated them into `edgeView` above. The
  // resolution logic below is unchanged.
  const isAggregated = aggregateCount > 1;
  const resolvedCausalityLabel: string | undefined = (() => {
    if (causalityLabel === 'none') return undefined;
    if (causalityLabel !== 'auto') return causalityLabel;
    return diagramType === 'prt' || diagramType === 'ec' ? 'in order to' : 'because';
  })();
  // Render `in-order-to` as the human-readable "in order to" — the dash
  // form is only the storage / enum value.
  const displayCausality =
    resolvedCausalityLabel === 'in-order-to' ? 'in order to' : resolvedCausalityLabel;
  const fallbackLabel = !edgeLabel && !isAggregated ? displayCausality : undefined;

  // Goal #2 — the connection-drag "drop here to AND" target shares the
  // splice-target's indigo glow (both mean "release lands on this edge").
  const isDropTarget = isSpliceTarget || isConnectionDropTarget;
  // Goal #3 — the select-hover cue is active only when this edge is hovered and
  // no stronger state owns the visual: not selected (casing band), not a
  // drop-target / mutex (their own colors), and not mid-connection-drag.
  const isHoverActive = isHovered && !props.selected && !isDropTarget && !isMutex && !isConnecting;
  // Stroke colour / width / dash / glow resolve from the edge's state + the live
  // palette in one declarative place (`resolveEdgeVisuals`), so a new edge style
  // is a single case there rather than five entangled conditional chains here.
  const {
    stroke,
    strokeWidth,
    strokeDasharray,
    filter: selectedFilter,
  } = resolveEdgeVisuals(
    {
      isDropTarget,
      isMutex,
      selected: props.selected ?? false,
      isJunctorGroup,
      isBackEdge,
      isNoteEdge,
      isHoverActive,
    },
    palette
  );

  /**
   * Truncate the label for the inline render, leaving the full text on
   * the `title` attribute for hover (E5). The truncation happens here
   * rather than in CSS so the suffix ellipsis is exact and the badge
   * width stays consistent.
   */
  const truncatedLabel =
    edgeLabel && edgeLabel.length > LABEL_INLINE_MAX
      ? `${edgeLabel.slice(0, LABEL_INLINE_MAX - 1).trimEnd()}…`
      : edgeLabel;

  // Backlog — paint the two visible "re-target" knobs only on a SELECTED,
  // genuinely reconnectable edge that isn't a junctor / mutex special-case,
  // isn't mid connection-drag, and isn't under Browse Lock.
  const showReconnectHandles = reconnectHandlesVisible({
    selected: props.selected === true,
    reconnectable: props.data?.reconnectable === true,
    isJunctorEdge,
    isMutex,
    isConnecting,
    locked: browseLocked,
  });

  // Cause→effect arrowhead placement — a custom oriented `<path>` (not React
  // Flow's `markerEnd`, which can't follow a curved approach); `edgeArrowhead.ts`
  // holds the full rationale + the tuning constants. It orients to the rendered
  // `path`'s terminal tangent so the tip stays ON the curve where the edge meets
  // the card (a bent / converging edge diverges from the straight chord). `show`
  // folds in the gate: mutex edges (symmetric conflict) and note edges (dotted
  // annotations) are arrow-less, as are edges with no `markerEnd` tag.
  // `effectiveTargetX/Y` are the real endpoint (junctor edges carry no arrow, so
  // the junctor offset never applies here).
  const arrowHead = arrowheadOnPath({
    show: Boolean(props.markerEnd) && !isMutex && !isNoteEdge,
    path,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: effectiveTargetX,
    targetY: effectiveTargetY,
  });

  return (
    <>
      {/* Goal #3 — selected "casing band": a crisp, solid indigo halo UNDER
          the core stroke. Distinct from the drop-target's fuzzy blur (shape,
          not just hue, is the discriminator) and from the grey hover glow.
          `pointer-events-none` so it never touches the 56px hit path;
          suppressed mid-drag (`!isDropTarget`) so the two indigo cues don't
          stack. A bare <path> has no implicit ARIA role and carries no
          accessible name, so it's already ignored by assistive tech — no
          `aria-hidden` needed (and Biome flags it as focusable-ish). One
          extra path per *selected* edge (~1 on screen) — not per-frame. */}
      {props.selected && !isDropTarget && (
        <path
          d={path}
          fill="none"
          stroke={palette.strokeSelected}
          strokeWidth={8}
          strokeOpacity={0.22}
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
      )}
      <BaseEdge
        id={props.id}
        path={path}
        // Mutex edges are bidirectional conflicts, not directional
        // causes — suppress React Flow's arrowhead marker so the line
        // reads as a symmetric connector. The ⚡ label-glyph stays as
        // the carrier of intent.
        //
        // Session 117 — conditional spread to OMIT `markerEnd` rather
        // than pass `undefined` to React Flow's `BaseEdge` (whose
        // optional prop rejects explicit undefined under
        // exactOptionalPropertyTypes).
        // The cause→effect arrowhead is a custom oriented <path> rendered below
        // — NOT React Flow's `markerEnd`. A marker orients to the path's
        // ENDPOINT tangent (the target handle's fixed normal, e.g. vertical for
        // a Position.Bottom handle), but the routed/bezier curve approaches the
        // box diagonally, so an offset marker pointed the wrong way ("not on the
        // line"). Rendering it ourselves lets it follow the rendered path's
        // terminal tangent. Mutex edges stay arrow-less (symmetric conflict).
        interactionWidth={EDGE_INTERACTION_WIDTH}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray,
          filter: selectedFilter,
          cursor: isHoverActive ? 'pointer' : undefined,
          ...props.style,
        }}
      />
      {arrowHead && (
        // `ARROW_TRIANGLE_D` + `arrowheadTransform` (edgeArrowhead.ts) place +
        // orient the triangle along the edge; `pointerEvents:none` keeps it off
        // the 56px hit path and the fill tracks the edge stroke.
        <path
          d={ARROW_TRIANGLE_D}
          transform={arrowheadTransform(arrowHead)}
          fill={stroke}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/* Backlog — visible "re-target" knobs on a SELECTED reconnectable edge's
          two endpoints, so it's discoverable that an end can be grabbed and
          dropped on another entity. Purely decorative (`pointerEvents: none`):
          React Flow's own reconnect updaters (radius = the `reconnectRadius`
          prop, bumped to 24) sit at the same spots and capture the drag. The
          source handle is `Position.Top` and the target `Position.Bottom` — the
          same flow-axis anchors `selectEdgeSides` prefers — so for the common
          tree edge each knob lands on the visible path end. */}
      {showReconnectHandles && (
        // Bare <g>/<circle> with no role or accessible name is already ignored by
        // assistive tech (and `pointerEvents: none` keeps them off the hit path),
        // so no `aria-hidden` — which Biome flags as focusable-ish anyway.
        <g style={{ pointerEvents: 'none' }}>
          <circle
            cx={props.sourceX}
            cy={props.sourceY}
            r={EDGE_RECONNECT_HANDLE_RADIUS}
            fill="#ffffff"
            stroke={palette.strokeSelected}
            strokeWidth={2}
          />
          <circle
            cx={props.targetX}
            cy={props.targetY}
            r={EDGE_RECONNECT_HANDLE_RADIUS}
            fill="#ffffff"
            stroke={palette.strokeSelected}
            strokeWidth={2}
          />
        </g>
      )}
      {/* Session 135 — mid-edge badges extracted to `TPEdgeBadges.tsx`.
          Each renders its own `<EdgeLabelRenderer>`; the conditions +
          placement deltas are unchanged. */}
      {isBackEdge && <BackEdgeBadge labelX={labelX} labelY={labelY} />}
      {isMutex && <MutexBadge labelX={labelX} labelY={labelY} />}
      {weight && weight !== 'positive' && (
        <WeightBadge labelX={labelX} labelY={labelY} weight={weight} />
      )}
      {aggregateCount > 1 && (
        <AggregateBadge labelX={labelX} labelY={labelY} count={aggregateCount} />
      )}
      {assumptionCount > 0 && (
        <AssumptionBadge
          labelX={labelX}
          labelY={labelY}
          edgeId={props.id}
          count={assumptionCount}
          onOpen={() => {
            selectEdge(props.id);
            setECInspectorTab('inspector');
          }}
        />
      )}
      {openCommentCount > 0 && (
        <CommentBadge
          labelX={labelX}
          labelY={labelY}
          edgeId={props.id}
          count={openCommentCount}
          onOpen={() => {
            selectEdge(props.id);
            useDocumentStore.getState().openCommentsPanel();
          }}
        />
      )}
      {hasDescription && <DescriptionBadge labelX={labelX} labelY={labelY} />}
      {edgeLabel && truncatedLabel && (
        <EdgeInlineLabel
          labelX={labelX}
          labelY={labelY}
          fullLabel={edgeLabel}
          truncated={truncatedLabel}
          // Goal #3 — clicking the label selects the edge (select only; unlike
          // the assumption badge it doesn't also force the EC inspector tab).
          onSelect={() => selectEdge(props.id)}
        />
      )}
      {fallbackLabel && <FallbackLabel labelX={labelX} labelY={labelY} text={fallbackLabel} />}
    </>
  );
}

/**
 * Session 105 / Tier 1 #6 — custom comparator for `React.memo`.
 *
 * The default `React.memo` shallow-compares all props, which seemed
 * sufficient when this file was first wrapped: a store mutation
 * unrelated to this edge produces a new `edges` array but each
 * unchanged edge's `data` reference would be stable.
 *
 * In practice, `useGraphEdgeEmission` rebuilds every edge's `data`
 * object literal on every emission run (see lines 79-90 of
 * `useGraphEdgeEmission.ts` — `data: { ...andGroupId, ...orGroupId,
 * ...xorGroupId, ...aggregateCount }` is a fresh spread each time).
 * That means `data` always fails the default referential compare,
 * and the memo bails for every edge on every emission — defeating
 * the purpose.
 *
 * The custom comparator below does a shallow comparison ON `data`
 * (rather than equality OF data). When the entries inside `data`
 * are unchanged primitives, the comparator returns true and React
 * skips the re-render. Other EdgeProps fields (sourceX, sourceY,
 * selected, markerEnd, etc.) get the standard equality check.
 *
 * Result: edges only re-render when their own positions, selection
 * state, or data-fields actually change. Unrelated store mutations
 * no longer reach the edge body via emission churn.
 */
export const TPEdge = memo(TPEdgeImpl, tpEdgePropsEqual);
TPEdge.displayName = 'TPEdge';
