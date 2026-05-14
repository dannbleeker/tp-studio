import { verbaliseEC } from '@/domain/verbalisation';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, Quote } from 'lucide-react';

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
 *     embedding above the canvas as a top strip. Session 87 added a
 *     **default-collapsed** mode (Dann's UX feedback): the canvas
 *     strip starts as a one-line summary "EC reading · N
 *     assumptions wired ▾" so the canvas reclaims ~150 px of vertical
 *     chrome that the full chained verbalisation otherwise eats. The
 *     inspector tab variant (non-compact) always renders expanded.
 *   - non-compact — slightly larger, padded layout for the inspector's
 *     Verbalisation tab. Always expanded; the inspector tab is the
 *     explicit "I want to read this in full" surface.
 *
 * No-op on non-EC docs — the token list is empty and the component
 * returns `null`.
 */
export function VerbalisationStrip({ compact = true }: { compact?: boolean } = {}) {
  const doc = useDocumentStore((s) => s.doc);
  const selectEdge = useDocumentStore((s) => s.selectEdge);
  // Persisted collapse flag — only consulted in the compact (canvas)
  // variant; the inspector tab is always expanded so the user can
  // read the full thing without re-clicking the chevron each time.
  const collapsed = useDocumentStore((s) => s.verbalisationStripCollapsed);
  const setCollapsed = useDocumentStore((s) => s.setVerbalisationStripCollapsed);
  const tokens = verbaliseEC(doc);
  if (tokens.length === 0) return null;

  const isCollapsed = compact && collapsed;

  // Compact-collapsed summary: count arrows that have at least one
  // assumption recorded. Useful single-glance signal — "have I
  // started reasoning about this cloud yet?" The arrow count is
  // always 5 for a well-formed EC; surfacing it would just be
  // visual noise.
  const arrowsWithAssumptions = tokens.filter(
    (t) => t.kind === 'assumptionAnchor' && t.assumptionCount > 0
  ).length;
  const totalArrows = tokens.filter((t) => t.kind === 'assumptionAnchor').length;

  return (
    <div
      className={clsx(
        'flex items-start gap-2',
        compact
          ? 'mx-auto max-w-3xl rounded-md border border-neutral-200 bg-white/95 px-3 py-2 text-[12px] text-neutral-700 italic leading-snug shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-neutral-300'
          : 'rounded-md border border-neutral-200 bg-white px-3 py-3 text-neutral-800 text-sm leading-relaxed dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
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
      {isCollapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand EC verbalisation"
          aria-expanded={false}
          className="flex w-full items-center justify-between gap-2 text-left not-italic outline-none hover:text-neutral-900 focus:ring-2 focus:ring-violet-400 dark:hover:text-neutral-100"
        >
          <span className="truncate">
            EC reading
            <span className="mx-1 text-neutral-400 dark:text-neutral-500">·</span>
            <span className="font-medium">
              {arrowsWithAssumptions}/{totalArrows} arrows with assumptions
            </span>
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-neutral-400 dark:text-neutral-500" />
        </button>
      ) : (
        <>
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
                    className="font-semibold text-neutral-900 not-italic dark:text-neutral-100"
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
                    'mx-0.5 inline rounded border px-1 py-0 font-semibold text-[10px] not-italic transition focus:outline-none focus:ring-2 focus:ring-violet-400',
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
          {compact && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse EC verbalisation"
              aria-expanded={true}
              className="shrink-0 self-start rounded p-0.5 text-neutral-400 outline-none transition hover:text-neutral-700 focus:ring-2 focus:ring-violet-400 dark:text-neutral-500 dark:hover:text-neutral-200"
              title="Collapse"
            >
              <ChevronUp className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
