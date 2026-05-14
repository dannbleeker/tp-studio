import { EDGE_STROKE_AND, EDGE_STROKE_DEFAULT, EDGE_STROKE_SELECTED } from '@/domain/tokens';
import { useDocumentStore } from '@/store';
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo } from 'react';
import type { TPEdge as TPEdgeType } from './flow-types';

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
 * the target's handle itself. ANDOverlay renders the junctor circle (with
 * the "AND" label) and a single short outgoing arrow from junctor up into
 * the target's bottom handle. This matches Flying Logic's visual
 * convention: multiple causes converge into a labelled circle, one line
 * continues to the effect above.
 *
 * `JUNCTOR_CENTER_OFFSET_Y` is the distance from the target's bottom edge
 * to the junctor circle's CENTER (where ANDOverlay positions the circle).
 * `JUNCTOR_RADIUS` is the circle's radius — must match the value in
 * ANDOverlay.tsx. Source-side bezier curves terminate at
 * `targetY + JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS`, which is the
 * BOTTOM of the circle. Ending at the bottom of the circle rather than
 * the center keeps the bezier strokes outside the circle interior so the
 * white-filled circle reads as an opaque junction rather than a
 * transparent disc with lines visible through it.
 */
const JUNCTOR_CENTER_OFFSET_Y = 35;
const JUNCTOR_RADIUS = 14;
const JUNCTOR_EDGE_TERMINAL_OFFSET_Y = JUNCTOR_CENTER_OFFSET_Y + JUNCTOR_RADIUS;

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

  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: effectiveTargetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  });

  // Narrow subscription: only the label + assumption-count + back-edge flag
  // for THIS edge. All three selectors return primitives, so they only fire
  // a render when the actual value changes — not on every doc edit.
  const edgeLabel = useDocumentStore((s) => s.doc.edges[props.id]?.label);
  const assumptionCount = useDocumentStore(
    (s) => s.doc.edges[props.id]?.assumptionIds?.length ?? 0
  );
  const isBackEdge = useDocumentStore((s) => s.doc.edges[props.id]?.isBackEdge === true);
  const isMutex = useDocumentStore((s) => s.doc.edges[props.id]?.isMutualExclusion === true);
  const weight = useDocumentStore((s) => s.doc.edges[props.id]?.weight);
  const hasDescription = useDocumentStore((s) => {
    const desc = s.doc.edges[props.id]?.description;
    return typeof desc === 'string' && desc.trim().length > 0;
  });
  // Global fallback causality label. Only consulted when this edge has no
  // explicit `label` of its own — per-edge labels always win. Aggregated
  // edges (count > 1) skip the fallback too: the `×N` badge is the more
  // informative thing to show in that slot.
  //
  // `'auto'` mode picks the diagram-type-appropriate reading: PRT and EC
  // edges are necessary-condition relations ("in order to obtain X..."),
  // CRT/FRT/TT are sufficient-cause ("...because Y exists").
  const causalityLabel = useDocumentStore((s) => s.causalityLabel);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
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
  const stroke = isMutex
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
  const baseWidth = props.selected ? 3 : isJunctorGroup ? 1.75 : 1.5;
  const strokeWidth = isBackEdge ? baseWidth + 1.5 : baseWidth;
  // Back-edges render with a subtle dash pattern in addition to the
  // thicker stroke — combination of two cues so the visual reads as
  // "this is *the* tagged loop-closer" rather than "this edge is just
  // selected" in a quick scan.
  const strokeDasharray = isBackEdge ? '6 4' : undefined;
  const selectedFilter = props.selected
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
        markerEnd={props.markerEnd}
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
            className="nodrag nopan pointer-events-none absolute select-none rounded-full border border-amber-300 bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
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
            className="nodrag nopan pointer-events-none absolute flex select-none items-center justify-center rounded-full border border-red-400 bg-red-50 px-1.5 text-[12px] font-bold leading-none text-red-700 shadow-sm dark:border-red-700 dark:bg-red-950 dark:text-red-200"
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
                ? 'nodrag nopan pointer-events-none absolute select-none rounded-full border border-rose-400 bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-700 shadow-sm dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
                : 'nodrag nopan pointer-events-none absolute select-none rounded-full border border-neutral-300 bg-neutral-50 px-1.5 text-[10px] font-semibold text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
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
            className="nodrag nopan pointer-events-none absolute select-none rounded-full bg-neutral-700 px-1.5 text-[10px] font-semibold text-white shadow-sm dark:bg-neutral-200 dark:text-neutral-800"
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
      */}
      {assumptionCount > 0 && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute select-none rounded-full bg-violet-500 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX - 16}px, ${labelY - 14}px)`,
            }}
            title={`${assumptionCount} assumption${assumptionCount === 1 ? '' : 's'} on this edge`}
          >
            A{assumptionCount > 1 ? assumptionCount : ''}
          </div>
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
            className="nodrag nopan pointer-events-none absolute select-none rounded px-1 py-px text-[10px] italic text-neutral-400 dark:text-neutral-500"
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
 * `React.memo` so mutations to other edges don't re-render every edge in
 * the diagram. React Flow re-derives EdgeProps per render; the
 * shallow-equal default comparison catches the case where `data` hasn't
 * changed for this edge.
 */
export const TPEdge = memo(TPEdgeImpl);
TPEdge.displayName = 'TPEdge';
