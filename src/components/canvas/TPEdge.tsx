import { JUNCTOR_EDGE_TERMINAL_OFFSET_Y, NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { EDGE_STROKE_AND, EDGE_STROKE_DEFAULT, EDGE_STROKE_SELECTED } from '@/domain/tokens';
import { useDocumentStore } from '@/store';
import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useStore as useRFStore,
} from '@xyflow/react';
import { memo, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import type { TPEdge as TPEdgeType } from './flow-types';
import { type Box, computeRadialEdgePath, nodeBoxOf } from './radialEdgeRouting';

/** E5: maximum characters shown inline on an edge label before truncating
 *  with an ellipsis. The full text remains available via the native HTML
 *  `title` attribute on hover. Earlier versions hid long labels entirely
 *  behind a tiny "i" icon, which made scanning a diagram for context
 *  impossible without hovering each edge. */
const LABEL_INLINE_MAX = 30;

/** E1: invisible halo around the stroke that captures clicks. React Flow's
 *  default is 20 px; we bump it so a slightly-imprecise click on a thin
 *  edge still selects it. The halo doesn't visibly render — it's just a
 *  transparent path beneath the visible stroke. */
const EDGE_INTERACTION_WIDTH = 32;

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
 */

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
  // Assumption count is computed inside the selector — it requires
  // iterating `doc.assumptions` to count records keyed to this edge.
  // The compute runs on every store update; we accept the per-call
  // cost in exchange for the simpler shallow-equal output.
  const edgeView = useDocumentStore(
    useShallow((s) => {
      const edge = s.doc.edges[props.id];
      const legacyAssumptionCount = edge?.assumptionIds?.length ?? 0;
      let mapAssumptionCount = 0;
      if (s.doc.assumptions) {
        for (const a of Object.values(s.doc.assumptions)) {
          if (a.edgeId === props.id) mapAssumptionCount += 1;
        }
      }
      const desc = edge?.description;
      return {
        edgeLabel: edge?.label,
        assumptionCount: Math.max(legacyAssumptionCount, mapAssumptionCount),
        isBackEdge: edge?.isBackEdge === true,
        isMutex: edge?.isMutualExclusion === true,
        weight: edge?.weight,
        hasDescription: typeof desc === 'string' && desc.trim().length > 0,
        isSpliceTarget: s.spliceTargetEdgeId === props.id,
        causalityLabel: s.causalityLabel,
        diagramType: s.doc.diagramType,
      };
    })
  );
  const {
    edgeLabel,
    assumptionCount,
    isBackEdge,
    isMutex,
    weight,
    hasDescription,
    isSpliceTarget,
    causalityLabel,
    diagramType,
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
    useShallow((s): { srcX?: number; srcY?: number; tgtX?: number; tgtY?: number } => {
      if (!isMutex) return {};
      const edge = s.doc.edges[props.id];
      if (!edge) return {};
      const src = s.doc.entities[edge.sourceId]?.position;
      const tgt = s.doc.entities[edge.targetId]?.position;
      return { srcX: src?.x, srcY: src?.y, tgtX: tgt?.x, tgtY: tgt?.y };
    })
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
    if (verticalGap <= NODE_MIN_HEIGHT) return null;
    if (horizontalGap > NODE_WIDTH * 1.5) return null;
    const upper = srcPos.y <= tgtPos.y ? srcPos : tgtPos;
    const lower = srcPos.y <= tgtPos.y ? tgtPos : srcPos;
    const x1 = upper.x + NODE_WIDTH / 2;
    const y1 = upper.y + NODE_MIN_HEIGHT;
    const x2 = lower.x + NODE_WIDTH / 2;
    const y2 = lower.y;
    return {
      path: `M ${x1},${y1} L ${x2},${y2}`,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2,
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
  const radialNodes = useRFStore((s) => (isRadialMode ? s.nodes : null));
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

  const path = mutexPath?.path ?? radialRoute?.path ?? bezierPath;
  const labelX = mutexPath?.labelX ?? radialRoute?.labelX ?? bezierLabelX;
  const labelY = mutexPath?.labelY ?? radialRoute?.labelY ?? bezierLabelY;

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
  const stroke = isSpliceTarget
    ? SPLICE_TARGET_STROKE
    : isMutex
      ? MUTEX_STROKE
      : props.selected
        ? EDGE_STROKE_SELECTED
        : isJunctorGroup
          ? EDGE_STROKE_AND
          : EDGE_STROKE_DEFAULT;
  // E4: selection feedback. Bumping the stroke width is the readable
  // signal — combined with the color change it's hard to miss which edge
  // is selected. A drop-shadow filter adds a faint glow that works on
  // both light and dark backgrounds without needing theme-specific tokens.
  // Back-edges (TOC-reading) get an extra +1.5 px on top of the base so a
  // tagged loop-closer reads as deliberate even in dense diagrams.
  // Splice-target gets the same +1.5 bump so the gesture preview reads
  // as deliberate without competing with the selected-edge stroke (which
  // already gets +1.5).
  const baseWidth = props.selected ? 3 : isJunctorGroup ? 1.75 : 1.5;
  const strokeWidth = isBackEdge || isSpliceTarget ? baseWidth + 1.5 : baseWidth;
  // Back-edges render with a subtle dash pattern in addition to the
  // thicker stroke — combination of two cues so the visual reads as
  // "this is *the* tagged loop-closer" rather than "this edge is just
  // selected" in a quick scan.
  const strokeDasharray = isBackEdge ? '6 4' : undefined;
  // Selected and splice-target both want a glow; splice-target wins
  // when both happen (the drag gesture is the more time-sensitive
  // signal and the user already knows what's selected).
  const selectedFilter = isSpliceTarget
    ? `drop-shadow(0 0 6px ${SPLICE_TARGET_STROKE}88)`
    : props.selected
      ? `drop-shadow(0 0 4px ${EDGE_STROKE_SELECTED}66)`
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

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        // Mutex edges are bidirectional conflicts, not directional
        // causes — suppress React Flow's arrowhead marker so the line
        // reads as a symmetric connector. The ⚡ label-glyph stays as
        // the carrier of intent.
        markerEnd={isMutex ? undefined : props.markerEnd}
        interactionWidth={EDGE_INTERACTION_WIDTH}
        style={{
          stroke,
          strokeWidth,
          strokeDasharray,
          filter: selectedFilter,
          ...props.style,
        }}
      />
      {isBackEdge && (
        // A small ↻ loop glyph mid-edge labels the tagged back-edge as a
        // designed feature rather than a CLR concern. Placed alongside the
        // existing label/aggregate stack — pointer-events stay off so the
        // edge body itself remains the click target.
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute select-none rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-[10px] text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 16}px, ${labelY - 14}px)`,
            }}
            title="Back-edge — this loop is intentional"
            aria-label="Back-edge — intentional loop"
          >
            ↻
          </div>
        </EdgeLabelRenderer>
      )}
      {isMutex && (
        // Session 77 / brief §6: lightning-bolt visual for the EC
        // conflict between D and D′. The previous ⊥ glyph reads as
        // "orthogonal" rather than "conflict"; ⚡ matches the book's
        // diagrammatic convention and the brief's spec literally.
        // Background is red for keyboard-/screen-reader accessibility;
        // the canvas-edge red stroke is the primary visual.
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute flex select-none items-center justify-center rounded-full border border-red-400 bg-red-50 px-1.5 font-bold text-[12px] text-red-700 leading-none shadow-sm dark:border-red-700 dark:bg-red-950 dark:text-red-200"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)`,
              minWidth: 18,
              minHeight: 18,
            }}
            title="Mutually exclusive — these two Wants conflict"
            aria-label="Mutually exclusive Wants — lightning-bolt conflict"
          >
            <span aria-hidden>⚡</span>
          </div>
        </EdgeLabelRenderer>
      )}
      {weight && weight !== 'positive' && (
        // Bundle 8 / FL-ED1: polarity badge for non-default weights.
        // Positive is the implicit default (TOC sufficiency) — only
        // render a badge when the user has explicitly tagged the edge
        // as negative or zero. Rose for negative, neutral for zero.
        <EdgeLabelRenderer>
          <div
            className={
              weight === 'negative'
                ? 'nodrag nopan pointer-events-none absolute select-none rounded-full border border-rose-400 bg-rose-50 px-1.5 font-semibold text-[10px] text-rose-700 shadow-sm dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
                : 'nodrag nopan pointer-events-none absolute select-none rounded-full border border-neutral-300 bg-neutral-50 px-1.5 font-semibold text-[10px] text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
            }
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 32}px, ${labelY - 14}px)`,
            }}
            title={
              weight === 'negative'
                ? 'Negative correlation — this cause REDUCES this effect'
                : 'Zero / neutral — flagged as non-influential'
            }
            aria-label={`Edge polarity: ${weight}`}
          >
            {weight === 'negative' ? '−' : '∅'}
          </div>
        </EdgeLabelRenderer>
      )}
      {aggregateCount > 1 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute select-none rounded-full bg-neutral-700 px-1.5 font-semibold text-[10px] text-white shadow-sm dark:bg-neutral-200 dark:text-neutral-800"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            title={`${aggregateCount} edges aggregated across the collapsed boundary`}
          >
            ×{aggregateCount}
          </div>
        </EdgeLabelRenderer>
      )}
      {/*
        E3: assumption indicator. An "A" pill sitting next to the label
        position when the edge carries at least one assumption. Hover
        reveals the exact count — useful for edges where the inspector
        isn't open. Violet matches the assumption entity stripe so the
        visual language is consistent across the canvas.

        Session 87 / EC PPT comparison item #6: the pill is now a real
        button. Clicking it selects the edge AND forces the EC
        inspector to its Inspector tab, so the AssumptionWell is
        visible without a second click. The hit target sits above
        nodrag/nopan so React Flow's pan/zoom doesn't swallow the
        click.
      */}
      {assumptionCount > 0 && (
        <EdgeLabelRenderer>
          <button
            type="button"
            data-component="edge-assumption-badge"
            data-edge-id={props.id}
            onClick={(e) => {
              e.stopPropagation();
              selectEdge(props.id);
              setECInspectorTab('inspector');
            }}
            className="nodrag nopan pointer-events-auto absolute cursor-pointer select-none rounded-full bg-violet-500 px-1.5 font-semibold text-[10px] text-white uppercase tracking-wider shadow-sm transition hover:bg-violet-600 focus:outline-none focus:ring-2 focus:ring-violet-300"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX - 16}px, ${labelY - 14}px)`,
            }}
            title={`${assumptionCount} assumption${assumptionCount === 1 ? '' : 's'} on this edge — click to open`}
            aria-label={`${assumptionCount} assumption${assumptionCount === 1 ? '' : 's'} on this edge. Open the Assumption Well.`}
          >
            A{assumptionCount > 1 ? assumptionCount : ''}
          </button>
        </EdgeLabelRenderer>
      )}
      {/*
        Bundle 6 FL-ED7 (Session 60): "📝" indicator when the edge carries
        a longer-form description. Distinct from the inline `label` (short
        mid-edge text) and the assumption "A" pill (linked Assumption
        entities). Placement mirrors the assumption pill but offset to the
        opposite side so they can coexist on a heavily-annotated edge.
      */}
      {hasDescription && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute select-none rounded-full border border-neutral-300 bg-white px-1.5 text-[10px] shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + 16}px, ${labelY + 14}px)`,
            }}
            title="This edge has a longer description — open inspector to read."
            aria-label="Edge has a description"
          >
            📝
          </div>
        </EdgeLabelRenderer>
      )}
      {/*
        E5 (was FL-AN3): edge label rendered inline mid-edge. Short labels
        show verbatim; long labels truncate with an ellipsis and put the
        full text on the `title` attribute for hover. Earlier we hid long
        labels behind a tiny "i" icon — scanning a diagram for context
        was impossible without hovering each edge. The truncated-inline
        approach mirrors how entity titles already work.
      */}
      {edgeLabel && truncatedLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute max-w-[220px] cursor-help select-none truncate rounded-md border border-neutral-200 bg-white/95 px-1.5 py-0.5 text-[11px] text-neutral-700 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-200"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            title={edgeLabel}
          >
            {truncatedLabel}
          </div>
        </EdgeLabelRenderer>
      )}
      {/*
        Causality fallback label. Renders only when the user has opted into
        a global `'because'` / `'therefore'` default in Settings AND this
        edge has no explicit per-edge label. Visually muted (italic, no
        border, semi-transparent) so an explicit label still stands out
        as the more authored thing in the same diagram.
      */}
      {fallbackLabel && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute select-none rounded px-1 py-px text-[10px] text-neutral-400 italic dark:text-neutral-500"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            aria-hidden="true"
          >
            {fallbackLabel}
          </div>
        </EdgeLabelRenderer>
      )}
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
/**
 * Shallow-equality check on two objects' enumerable own keys.
 * Exported for direct test coverage of the comparator below.
 */
export const shallowEqualObject = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const ak = Object.keys(a as Record<string, unknown>);
  const bk = Object.keys(b as Record<string, unknown>);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if ((a as Record<string, unknown>)[k] !== (b as Record<string, unknown>)[k]) return false;
  }
  return true;
};

/**
 * The custom comparator for `React.memo(TPEdge)`. Returns `true`
 * when the memo should bail (skip re-render); `false` when the
 * component must re-render.
 *
 * Exported separately so unit tests can pin the comparator's
 * logic directly without the Profiler / reconciler complications
 * that come with measuring rendered components.
 */
export const tpEdgePropsEqual = (
  prev: EdgeProps<TPEdgeType>,
  next: EdgeProps<TPEdgeType>
): boolean => {
  if (prev.id !== next.id) return false;
  if (prev.source !== next.source || prev.target !== next.target) return false;
  if (prev.sourceX !== next.sourceX || prev.sourceY !== next.sourceY) return false;
  if (prev.targetX !== next.targetX || prev.targetY !== next.targetY) return false;
  if (prev.sourcePosition !== next.sourcePosition) return false;
  if (prev.targetPosition !== next.targetPosition) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.markerEnd !== next.markerEnd) return false;
  if (prev.markerStart !== next.markerStart) return false;
  return shallowEqualObject(prev.data, next.data);
};

export const TPEdge = memo(TPEdgeImpl, tpEdgePropsEqual);
TPEdge.displayName = 'TPEdge';
