import { EdgeLabelRenderer } from '@xyflow/react';
import { EDGE_KIND_COACHING } from '@/domain/readerModeCoaching';
import type { EdgeId, EdgeKind } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * Session 180 / E6 — Reader mode edge overlay.
 *
 * Rendered at the edge midpoint when reader mode is active and the edge
 * is hovered. Shows two items stacked vertically:
 *
 *   1. A small pill labelling the edge kind ("Sufficiency arrow (→)" /
 *      "Necessity arrow (←)") — orients a non-expert reader quickly.
 *
 *   2. A "Challenge?" button that opens the Comments panel pre-anchored
 *      to this edge, with challenge-mode framing in the composer (see
 *      `CommentComposer`). Uses the existing `startCommentAt` action
 *      so no new store logic is needed.
 *
 * Both items are pointer-events-auto (so the button is clickable) but
 * rendered inside an `EdgeLabelRenderer` so they sit in screen space at
 * the label midpoint, just like the existing edge badges.
 */
export function ChallengeButton({
  edgeId,
  edgeKind,
  labelX,
  labelY,
}: {
  edgeId: string;
  edgeKind: EdgeKind;
  labelX: number;
  labelY: number;
}) {
  const startCommentAt = useDocumentStore((s) => s.startCommentAt);
  const coaching = EDGE_KIND_COACHING[edgeKind];

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          transform: `translate(-50%, -50%) translate(${labelX}px,${labelY + 32}px)`,
          pointerEvents: 'all',
        }}
        className="flex flex-col items-center gap-1"
      >
        {/* Edge-kind orientation label */}
        <span className="pointer-events-none rounded-full border border-accent-200/70 bg-white/90 px-2 py-0.5 text-[10px] text-accent-600 shadow-xs dark:border-accent-800/50 dark:bg-neutral-900/90 dark:text-accent-300">
          {coaching.label}
        </span>
        {/* Challenge button */}
        <button
          type="button"
          className="rounded-full border border-accent-300 bg-white px-2.5 py-0.5 font-medium text-accent-600 text-xs shadow-sm transition hover:bg-accent-50 dark:border-accent-700 dark:bg-neutral-900 dark:text-accent-300 dark:hover:bg-accent-950"
          title={coaching.tip}
          onClick={(e) => {
            e.stopPropagation();
            startCommentAt({ kind: 'edge', edgeId: edgeId as EdgeId });
          }}
        >
          Challenge?
        </button>
      </div>
    </EdgeLabelRenderer>
  );
}
