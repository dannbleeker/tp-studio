import { verbaliseEC } from '@/domain/verbalisation';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Quote } from 'lucide-react';

/**
 * Session 77 / brief §6 — Evaporating Cloud verbalisation strip.
 *
 * Renders the read-aloud verbal form of an EC document with click-
 * through anchors that jump the inspector to the corresponding edge.
 * Each `assumptionAnchor` token becomes a clickable chip that selects
 * the edge so the user lands on its AssumptionWell.
 *
 * Two display modes (controlled by `compact`):
 *
 *   - `compact` (default) — small italic prose block, suitable for
 *     embedding above the canvas as a top strip.
 *   - non-compact — slightly larger, padded layout for the inspector's
 *     Verbalisation tab.
 *
 * No-op on non-EC docs — the token list is empty and the component
 * returns `null`.
 */
export function VerbalisationStrip({ compact = true }: { compact?: boolean } = {}) {
  const doc = useDocumentStore((s) => s.doc);
  const selectEdge = useDocumentStore((s) => s.selectEdge);
  const tokens = verbaliseEC(doc);
  if (tokens.length === 0) return null;

  return (
    <div
      className={clsx(
        'flex items-start gap-2',
        compact
          ? 'mx-auto max-w-3xl rounded-md border border-neutral-200 bg-white/95 px-3 py-2 text-[12px] italic leading-snug text-neutral-700 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-neutral-300'
          : 'rounded-md border border-neutral-200 bg-white px-3 py-3 text-sm leading-relaxed text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      )}
      data-component="verbalisation-strip"
    >
      <Quote
        className={clsx(
          'shrink-0 text-neutral-400 dark:text-neutral-500',
          compact ? 'mt-0.5 h-3 w-3' : 'mt-1 h-4 w-4'
        )}
        aria-hidden
      />
      <p className="flex-1 whitespace-normal">
        {tokens.map((tok, i) => {
          // Stable key: position + kind + identifier-of-the-slot or
          // edge so React can match across renders even if a slot
          // gets renamed. Position prefix preserves uniqueness across
          // identical text tokens.
          const key =
            tok.kind === 'text'
              ? `${i}:t:${tok.text}`
              : tok.kind === 'slot'
                ? `${i}:s:${tok.slot}`
                : `${i}:a:${tok.edgeId || 'none'}`;
          if (tok.kind === 'text') return <span key={key}>{tok.text}</span>;
          if (tok.kind === 'slot') {
            return (
              <span
                key={key}
                className="font-semibold not-italic text-neutral-900 dark:text-neutral-100"
              >
                {tok.text}
              </span>
            );
          }
          // Assumption anchor — click-through chip showing the count.
          const label =
            tok.assumptionCount > 0
              ? `${tok.assumptionCount} assumption${tok.assumptionCount === 1 ? '' : 's'}`
              : 'no assumptions yet';
          const ariaLabel = tok.edgeId
            ? `Open Assumption Well for this arrow. ${label}.`
            : 'No edge wired yet — cannot open the Assumption Well.';
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (tok.edgeId) selectEdge(tok.edgeId);
              }}
              disabled={!tok.edgeId}
              aria-label={ariaLabel}
              className={clsx(
                'mx-0.5 inline rounded border px-1 py-0 text-[10px] font-semibold not-italic transition focus:outline-none focus:ring-2 focus:ring-violet-400',
                tok.assumptionCount > 0
                  ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300 dark:hover:bg-violet-900'
                  : 'border-neutral-300 bg-neutral-50 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800',
                !tok.edgeId && 'cursor-not-allowed opacity-50'
              )}
              title={tok.edgeId ? "Open the edge's Assumption Well" : 'No edge yet'}
            >
              {label}
            </button>
          );
        })}
      </p>
    </div>
  );
}
