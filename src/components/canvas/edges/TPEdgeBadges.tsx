import { EdgeLabelRenderer } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';
import { memo } from 'react';
import type { EdgeWeight } from '@/domain/types';

/**
 * Session 135 — extracted from `TPEdge.tsx` (file split), mirroring the
 * `TPNodeBadges.tsx` precedent. Each mid-edge badge is a self-contained
 * `<EdgeLabelRenderer>` block that depends only on the bezier label
 * anchor (`labelX` / `labelY`) plus its own datum — no edge-component
 * closure. Pulling them here leaves `TPEdge.tsx` to own the path
 * geometry + the store reads; the render becomes a clean sequence of
 * these badges. Placement offsets (the `translate(...)` deltas) are
 * preserved verbatim so a heavily-annotated edge keeps its layout.
 *
 * Session 135 / Perf #5 — wrapped in `memo` (parallel to the node
 * badges). They re-render only when `TPEdge` does; once it does, a badge
 * whose own props (anchor + datum) are unchanged skips its own render.
 */

type Anchor = { labelX: number; labelY: number };

/** ↻ glyph — an intentional back-edge (loop is a feature, not a CLR concern). */
export const BackEdgeBadge = memo(function BackEdgeBadge({ labelX, labelY }: Anchor) {
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-none absolute select-none rounded-full border border-amber-300 bg-amber-50 px-1.5 font-semibold text-[10px] text-amber-800 shadow-xs dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        style={{ transform: `translate(-50%, -50%) translate(${labelX + 16}px, ${labelY - 14}px)` }}
        title="Back-edge — this loop is intentional"
        role="img"
        aria-label="Back-edge — intentional loop"
      >
        ↻
      </div>
    </EdgeLabelRenderer>
  );
});

/** ⚡ glyph — EC mutual-exclusion conflict between D and D′. */
export const MutexBadge = memo(function MutexBadge({ labelX, labelY }: Anchor) {
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-none absolute flex select-none items-center justify-center rounded-full border border-red-400 bg-red-50 px-1.5 font-bold text-[12px] text-red-700 leading-none shadow-xs dark:border-red-700 dark:bg-red-950 dark:text-red-200"
        style={{
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 14}px)`,
          minWidth: 18,
          minHeight: 18,
        }}
        title="Mutually exclusive — these two Wants conflict"
        role="img"
        aria-label="Mutually exclusive Wants — lightning-bolt conflict"
      >
        <span aria-hidden>⚡</span>
      </div>
    </EdgeLabelRenderer>
  );
});

/** Polarity badge for non-default edge weights (negative `−` / zero `∅`). */
export const WeightBadge = memo(function WeightBadge({
  labelX,
  labelY,
  weight,
}: Anchor & { weight: EdgeWeight }) {
  return (
    <EdgeLabelRenderer>
      <div
        className={
          weight === 'negative'
            ? 'nodrag nopan pointer-events-none absolute select-none rounded-full border border-rose-400 bg-rose-50 px-1.5 font-semibold text-[10px] text-rose-700 shadow-xs dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200'
            : 'nodrag nopan pointer-events-none absolute select-none rounded-full border border-neutral-300 bg-neutral-50 px-1.5 font-semibold text-[10px] text-neutral-700 shadow-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300'
        }
        style={{ transform: `translate(-50%, -50%) translate(${labelX + 32}px, ${labelY - 14}px)` }}
        title={
          weight === 'negative'
            ? 'Negative correlation — this cause REDUCES this effect'
            : 'Zero / neutral — flagged as non-influential'
        }
        role="img"
        aria-label={`Edge polarity: ${weight}`}
      >
        {weight === 'negative' ? '−' : '∅'}
      </div>
    </EdgeLabelRenderer>
  );
});

/** ×N pill — count of edges aggregated across a collapsed boundary. */
export const AggregateBadge = memo(function AggregateBadge({
  labelX,
  labelY,
  count,
}: Anchor & { count: number }) {
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-none absolute select-none rounded-full bg-neutral-700 px-1.5 font-semibold text-[10px] text-white shadow-xs dark:bg-neutral-200 dark:text-neutral-800"
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        title={`${count} edges aggregated across the collapsed boundary`}
      >
        ×{count}
      </div>
    </EdgeLabelRenderer>
  );
});

/**
 * E3 — "A" pill when the edge carries at least one assumption. A real
 * button: clicking selects the edge AND forces the EC inspector to its
 * Inspector tab so the AssumptionWell is visible without a second click.
 */
export const AssumptionBadge = memo(function AssumptionBadge({
  labelX,
  labelY,
  edgeId,
  count,
  onOpen,
}: Anchor & { edgeId: string; count: number; onOpen: () => void }) {
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        data-component="edge-assumption-badge"
        data-edge-id={edgeId}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="nodrag nopan pointer-events-auto absolute cursor-pointer select-none rounded-full bg-violet-500 px-1.5 font-semibold text-[10px] text-white uppercase tracking-wider shadow-xs transition hover:bg-violet-600 focus:outline-hidden focus:ring-2 focus:ring-violet-300"
        style={{ transform: `translate(-50%, -50%) translate(${labelX - 16}px, ${labelY - 14}px)` }}
        title={`${count} assumption${count === 1 ? '' : 's'} on this edge — click to open`}
        aria-label={`${count} assumption${count === 1 ? '' : 's'} on this edge. Open the Assumption Well.`}
      >
        A{count > 1 ? count : ''}
      </button>
    </EdgeLabelRenderer>
  );
});

/**
 * Open-comment badge — below-left of the edge label. Count of OPEN
 * (unresolved) top-level review comments anchored to this edge; clicking
 * selects the edge and opens the Comments panel. A real button (like the
 * assumption badge), so `stopPropagation` keeps the pane from clearing the
 * selection.
 */
export const CommentBadge = memo(function CommentBadge({
  labelX,
  labelY,
  edgeId,
  count,
  onOpen,
}: Anchor & { edgeId: string; count: number; onOpen: () => void }) {
  return (
    <EdgeLabelRenderer>
      <button
        type="button"
        data-component="edge-comment-badge"
        data-edge-id={edgeId}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        className="nodrag nopan pointer-events-auto absolute flex cursor-pointer select-none items-center gap-0.5 rounded-full border border-indigo-300 bg-indigo-50 px-1.5 font-semibold text-[10px] text-indigo-700 shadow-xs transition hover:bg-indigo-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-300 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
        style={{ transform: `translate(-50%, -50%) translate(${labelX - 16}px, ${labelY + 14}px)` }}
        title={`${count} open comment${count === 1 ? '' : 's'} on this edge — click to review`}
        aria-label={`${count} open comment${count === 1 ? '' : 's'} on this edge. Open the Comments panel.`}
      >
        <MessageSquare className="h-2.5 w-2.5" aria-hidden />
        {count}
      </button>
    </EdgeLabelRenderer>
  );
});

/** 📝 indicator — the edge carries a longer-form description. */
export const DescriptionBadge = memo(function DescriptionBadge({ labelX, labelY }: Anchor) {
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-none absolute select-none rounded-full border border-neutral-300 bg-white px-1.5 text-[10px] shadow-xs dark:border-neutral-700 dark:bg-neutral-900"
        style={{ transform: `translate(-50%, -50%) translate(${labelX + 16}px, ${labelY + 14}px)` }}
        title="This edge has a longer description — open inspector to read."
        role="img"
        aria-label="Edge has a description"
      >
        📝
      </div>
    </EdgeLabelRenderer>
  );
});

/** E5 — inline mid-edge label. Short labels show verbatim; long labels
 *  arrive pre-truncated with the full text on the `title` attribute. */
export const EdgeInlineLabel = memo(function EdgeInlineLabel({
  labelX,
  labelY,
  fullLabel,
  truncated,
  onSelect,
}: Anchor & { fullLabel: string; truncated: string; onSelect?: () => void }) {
  return (
    <EdgeLabelRenderer>
      {/* Goal #3 — the inline label is a click-to-select target so the edge
          has a bigger affordance than the thin line / tiny assumption badge.
          `stopPropagation` is essential: without it the click bubbles to the
          React Flow pane, which clears selection — the edge would deselect
          the instant it's selected. Stays a <div> (not <button>): React Flow
          edges carry their own keyboard focus + select path, so a button
          here would add a spurious, redundant tab stop. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: pointer-only select shortcut mirroring the junctor circle; the edge itself is the keyboard-focusable select target. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: same — redundant pointer shortcut; selecting the edge from the keyboard goes through React Flow's focusable edge, not this label. */}
      <div
        className="nodrag nopan pointer-events-auto absolute max-w-[220px] cursor-pointer select-none truncate rounded-md border border-neutral-200 bg-white/95 px-1.5 py-0.5 text-[11px] text-neutral-700 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-200"
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        title={fullLabel}
        onClick={(e) => {
          // Don't let the select bubble to the pane (which would clear it).
          e.stopPropagation();
          onSelect?.();
        }}
      >
        {truncated}
      </div>
    </EdgeLabelRenderer>
  );
});

/** Muted causality fallback label (e.g. "because" / "therefore") shown
 *  only when no explicit per-edge label is set. */
export const FallbackLabel = memo(function FallbackLabel({
  labelX,
  labelY,
  text,
}: Anchor & { text: string }) {
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-none absolute select-none rounded-sm px-1 py-px text-[10px] text-neutral-400 italic dark:text-neutral-500"
        style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        aria-hidden="true"
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
});
