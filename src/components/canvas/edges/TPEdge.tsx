// Session 119 — note on React Compiler interaction (see TPNode.tsx
// for the same note in fuller form). `TPEdgeImpl` is wrapped in
// `memo(impl, tpEdgePropsEqual)`. The Compiler recognises explicit
// `memo()` and skips auto-memoization for the wrapped component, so
// the Session 105 comparator's behavior stays intact.

import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
  type Node as RFNode,
  useStore as useRFStore,
} from '@xyflow/react';
import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  EDGE_RECONNECT_HANDLE_RADIUS,
  JUNCTOR_EDGE_TERMINAL_OFFSET_Y,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
} from '@/domain/constants';
import { selectEdgeSides } from '@/domain/edgeSides';
import { EDGE_PALETTES } from '@/domain/tokens';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import type { TPEdge as TPEdgeType } from './flow-types';
import { type Box, computeRadialEdgePath, nodeBoxOf } from './radialEdgeRouting';
import { resolveEdgePath } from './resolveEdgePath';
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

/** E5: maximum characters shown inline on an edge label before truncating
 *  with an ellipsis. The full text remains available via the native HTML
 *  `title` attribute on hover. Earlier versions hid long labels entirely
 *  behind a tiny "i" icon, which made scanning a diagram for context
 *  impossible without hovering each edge. */
const LABEL_INLINE_MAX = 30;

/**
 * Equality for the radial-mode obstacle subscription. React Flow's `s.nodes`
 * is a FRESH array reference on every store write (selection, hover, dimension
 * churn — not just position), so subscribing to it bare re-rendered every
 * TPEdge on every frame during any drag in radial mode. Gating on node
 * geometry (id + position + size) means the radial router only re-runs when an
 * obstacle actually moves. Returns the previous reference otherwise, keeping
 * the `radialRoute` useMemo stable.
 */
const radialNodesEqual = (a: RFNode[] | null, b: RFNode[] | null): boolean => {
  if (a === b) return true;
  if (a === null || b === null || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const na = a[i];
    const nb = b[i];
    if (
      !na ||
      !nb ||
      na.id !== nb.id ||
      na.position.x !== nb.position.x ||
      na.position.y !== nb.position.y ||
      na.width !== nb.width ||
      na.height !== nb.height
    ) {
      return false;
    }
  }
  return true;
};

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

  // Default bezier — what React Flow's source/target handle positions
  // produce. The mutex special-case below overrides this when both
  // endpoints resolve to vertically-stacked entity positions.
  const [bezierPath, bezierLabelX, bezierLabelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
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

  // Mutex override (Session 87 UX fix #5). Uses raw entity positions
  // to draw a clean vertical line between the bottom of the topmost
  // want and the top of the bottommost want. Skipped if endpoints
  // aren't resolvable or if the two entities aren't actually stacked
  // (horizontal layout would look worse with a forced straight line).
  const mutexPath = (() => {
    if (!isMutex || !mutexEndpoints) return null;
    const { srcPos, tgtPos } = mutexEndpoints;
    const verticalGap = Math.abs(srcPos.y - tgtPos.y);
    const horizontalGap = Math.abs(srcPos.x - tgtPos.x);
    // Bail only when the two Wants basically overlap — there's no clean
    // facing pair then, so the default bezier reads better. Feature #5
    // dropped the old "too far horizontally" cap so side-by-side Wants
    // now connect on their facing left/right sides instead of looping.
    if (verticalGap <= NODE_MIN_HEIGHT && horizontalGap <= NODE_WIDTH) return null;
    // Axis by the dominant gap: stacked Wants connect top↔bottom, side-by-
    // side Wants connect left↔right. `selectEdgeSides` picks the facing
    // anchors; the mutex line stays dead-straight between them.
    const axis = horizontalGap >= verticalGap ? 'horizontal' : 'vertical';
    const { sourceAnchor: a, targetAnchor: t } = selectEdgeSides({
      sourceBox: { x: srcPos.x, y: srcPos.y, width: NODE_WIDTH, height: NODE_MIN_HEIGHT },
      targetBox: { x: tgtPos.x, y: tgtPos.y, width: NODE_WIDTH, height: NODE_MIN_HEIGHT },
      axis,
      obstacles: [],
    });
    return {
      path: `M ${a.x},${a.y} L ${t.x},${t.y}`,
      labelX: (a.x + t.x) / 2,
      labelY: (a.y + t.y) / 2,
    };
  })();
  // Session 99 — obstacle-aware routing for the radial layout.
  // The radial / sunburst layout places nodes on concentric rings;
  // the default React Flow bezier between source / target handles
  // often passes through cousin or sibling node boxes, especially
  // on trees deeper than two rings. When `layoutMode === 'radial'`
  // we read all OTHER node positions via React Flow's store and let
  // `computeRadialEdgePath` deflect the bezier perpendicular to its
  // axis enough to clear the obstacles.
  //
  // The subscription is gated on `isRadialMode` — the selector
  // returns a stable `null` in flow / manual modes so unrelated
  // node drags don't fan re-renders into every edge.
  //
  // Junctor and mutex edges keep their existing special-case paths
  // (the junctor terminus already redirects to the circle perimeter;
  // the mutex straight-line override is more useful than routing
  // around boxes for vertically-stacked Wants).
  // `isRadialMode` could have lived in the `edgeView` bundle above,
  // but routing it through that bundle would mean every edge re-renders
  // when ANY edge view-field changes — and we want the radial-mode
  // flag to gate the React Flow store subscription (`radialNodes`)
  // independently. Keeping the primitive selector here lets Zustand's
  // fast-path Object.is comparison short-circuit unrelated updates.
  const isRadialMode = useDocumentStore((s) => s.layoutMode === 'radial');
  const radialNodes = useRFStore((s) => (isRadialMode ? s.nodes : null), radialNodesEqual);
  // Edge-color palette (Settings → Appearance → Edge palette). Reading the live
  // selection here is what makes the colorblind-safe / mono palettes actually
  // recolor edges; a stable primitive selector that changes only when the user
  // switches palette.
  const edgePalette = useDocumentStore((s) => s.edgePalette);
  const palette = EDGE_PALETTES[edgePalette];
  const hasMutexOverride = mutexPath !== null;
  const radialRoute = useMemo(() => {
    if (!isRadialMode || !radialNodes) return null;
    if (isJunctorEdge) return null;
    if (hasMutexOverride) return null;
    const obstacles: Box[] = [];
    for (const node of radialNodes) {
      if (node.id === props.source || node.id === props.target) continue;
      // The width / height in the emitted node objects (set in
      // `useGraphNodeEmission`) are the canonical box sizes; fall
      // back to the constants if a future emission path forgets to
      // set them.
      const w = node.width ?? NODE_WIDTH;
      const h = node.height ?? NODE_MIN_HEIGHT;
      obstacles.push(nodeBoxOf(node.position, w, h));
    }
    return computeRadialEdgePath(
      { x: props.sourceX, y: props.sourceY },
      { x: props.targetX, y: effectiveTargetY },
      obstacles
    );
  }, [
    isRadialMode,
    radialNodes,
    isJunctorEdge,
    hasMutexOverride,
    props.source,
    props.target,
    props.sourceX,
    props.sourceY,
    props.targetX,
    effectiveTargetY,
  ]);

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

  // Mutex edges paint red regardless of AND/selection — the red is the
  // *semantic* signal ("these two Wants conflict") and dominates the
  // diagram's color vocabulary on the rare edges that carry it.
  const MUTEX_STROKE = '#dc2626';
  // Session 101 — splice-target indigo. Bright enough to read as
  // "drop here happens" against both light + dark themes; the same
  // hue family as the project's accent so it doesn't introduce a
  // new color into the vocabulary.
  const SPLICE_TARGET_STROKE = '#6366f1';
  // Goal #2 — the connection-drag "drop here to AND" target shares the
  // splice-target's indigo glow (both mean "release lands on this edge").
  const isDropTarget = isSpliceTarget || isConnectionDropTarget;
  // Goal #3 — the select-hover cue is active only when this edge is hovered
  // and no stronger state owns the visual: not selected (casing band), not a
  // drop-target / mutex (their own colors), and not mid-connection-drag (the
  // drop-target glow takes over then). Keeping the exclusions here means the
  // width / glow / cursor branches below all key off one boolean.
  const isHoverActive = isHovered && !props.selected && !isDropTarget && !isMutex && !isConnecting;
  const stroke = isDropTarget
    ? SPLICE_TARGET_STROKE
    : isMutex
      ? MUTEX_STROKE
      : props.selected
        ? palette.strokeSelected
        : isJunctorGroup
          ? palette.strokeAnd
          : palette.stroke;
  // E4: selection feedback. Bumping the stroke width is the readable
  // signal — combined with the color change it's hard to miss which edge
  // is selected. A drop-shadow filter adds a faint glow that works on
  // both light and dark backgrounds without needing theme-specific tokens.
  // Back-edges (TOC-reading) get an extra +1.5 px on top of the base so a
  // tagged loop-closer reads as deliberate even in dense diagrams.
  // Splice-target gets the same +1.5 bump so the gesture preview reads
  // as deliberate without competing with the selected-edge stroke (which
  // already gets +1.5).
  // Session 136 — note-touching edges paint thinner so they read as
  // ancillary annotation rather than competing with the causal
  // backbone. Stroke width drops a hair below the default 1.5 instead
  // of stacking with `selected` / `back-edge` bumps (which keep their
  // existing widths even on a note edge — selection feedback still
  // wins).
  const baseWidth = props.selected ? 3 : isJunctorGroup ? 1.75 : isNoteEdge ? 1.25 : 1.5;
  const strokeWidth =
    isBackEdge || isDropTarget ? baseWidth + 1.5 : isHoverActive ? baseWidth + 1 : baseWidth;
  // Back-edges render with a subtle dash pattern in addition to the
  // thicker stroke — combination of two cues so the visual reads as
  // "this is *the* tagged loop-closer" rather than "this edge is just
  // selected" in a quick scan.
  //
  // Session 136 — note-touching edges also render dotted ("2 3", a
  // tighter pattern than back-edge's "6 4") so the visual differs
  // from both default-solid and back-edge-dashed. Selection still
  // bumps the stroke width so a selected note-edge stays
  // distinguishable from an unselected one. Back-edge takes
  // precedence over note-edge if both flags happen — back-edges are
  // the more semantically loaded signal.
  const strokeDasharray = isBackEdge ? '6 4' : isNoteEdge ? '2 3' : undefined;
  // Selected and splice-target both want a glow; splice-target wins
  // when both happen (the drag gesture is the more time-sensitive
  // signal and the user already knows what's selected).
  const selectedFilter = isDropTarget
    ? `drop-shadow(0 0 6px ${SPLICE_TARGET_STROKE}88)`
    : props.selected
      ? `drop-shadow(0 0 5px ${palette.strokeSelected}aa)`
      : isHoverActive
        ? 'drop-shadow(0 0 3px #73737366)'
        : undefined;

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
        {...(isMutex ? {} : { markerEnd: props.markerEnd })}
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
