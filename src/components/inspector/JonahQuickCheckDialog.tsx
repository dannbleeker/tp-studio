import clsx from 'clsx';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { LargeDialog } from '@/components/ui/LargeDialog';
import { useDocumentStore } from '@/store';

/**
 * Session 199 (backlog A4, Scheinkopf) — the "Jonah quick-check": a fast pass
 * over the whole diagram before the full Categories-of-Legitimate-Reservation
 * walk. Four questions on the two axes a Jonah checks first — entity vs.
 * causality × existence vs. clarity — each with a read-aloud reminder. It is a
 * guided-review surface only: it reads nothing from the doc, mutates nothing, and
 * the "considered" ticks are a session aid that resets when the dialog closes.
 */
type QuickCheck = { tier: 'clarity' | 'existence' | 'sufficiency'; question: string; hint: string };

const TIER_PILL: Record<QuickCheck['tier'], string> = {
  clarity: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  existence: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  sufficiency: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
};

export const JONAH_QUICK_CHECKS: readonly QuickCheck[] = [
  {
    tier: 'clarity',
    question:
      'Read every box aloud. Is each one a single, clear statement — no jargon, nothing a reasonable person could read two ways?',
    hint: 'Entity × clarity. If a box needs a second sentence to explain it, split or reword it.',
  },
  {
    tier: 'existence',
    question:
      'Does every box name something real you could point to — a present condition, not a guess, a goal, or a bare label?',
    hint: 'Entity × existence. Name the evidence you would show for each one.',
  },
  {
    tier: 'existence',
    question:
      'Read each arrow aloud: "if [cause], then [effect]." Is that a real cause-and-effect, or just two things that happen together?',
    hint: 'Causality × existence. If the sentence sounds forced, you may have correlation, not cause.',
  },
  {
    tier: 'sufficiency',
    question:
      'Is each cause enough on its own to produce its effect, or is an unstated extra condition (a hidden AND) quietly required?',
    hint: 'Causality × sufficiency. If something else must also hold, add it as a co-cause.',
  },
];

export function JonahQuickCheckDialog() {
  const open = useDocumentStore((s) => s.jonahQuickCheckOpen);
  const close = useDocumentStore((s) => s.closeJonahQuickCheck);
  const [idx, setIdx] = useState(0);
  const [reviewed, setReviewed] = useState<ReadonlySet<number>>(() => new Set());

  if (!open) return null;
  const total = JONAH_QUICK_CHECKS.length;
  const step = JONAH_QUICK_CHECKS[Math.min(idx, total - 1)]!;
  const isLast = idx >= total - 1;

  const onClose = () => {
    // Reset the session ticks + position so a re-open starts fresh.
    setIdx(0);
    setReviewed(new Set());
    close();
  };

  return (
    <LargeDialog
      open={open}
      onClose={onClose}
      title="Jonah quick-check"
      subtitle="A fast read-aloud pass before the full reservation walk — four questions for the whole diagram."
      widthClass="w-[min(620px,94vw)]"
    >
      <div className="flex flex-col gap-4 p-4">
        <ol className="flex flex-wrap gap-1.5">
          {JONAH_QUICK_CHECKS.map((_, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`Question ${i + 1}`}
                aria-current={i === idx}
                className={clsx(
                  'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition',
                  i === idx
                    ? 'border-accent-500 bg-accent-500 text-white'
                    : reviewed.has(i)
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'border-neutral-300 text-neutral-500 dark:border-neutral-700 dark:text-neutral-400'
                )}
              >
                {reviewed.has(i) && i !== idx ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
              </button>
            </li>
          ))}
        </ol>

        <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Question {idx + 1} of {total}
            </span>
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 font-medium text-[10px] uppercase tracking-wider',
                TIER_PILL[step.tier]
              )}
            >
              {step.tier}
            </span>
          </div>
          <p className="text-neutral-800 text-sm leading-relaxed dark:text-neutral-100">
            {step.question}
          </p>
          <p className="text-neutral-500 text-xs italic dark:text-neutral-400">{step.hint}</p>
          <label className="mt-1 flex items-center gap-2 text-neutral-600 text-sm dark:text-neutral-300">
            <input
              type="checkbox"
              checked={reviewed.has(idx)}
              onChange={(e) =>
                setReviewed((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) next.add(idx);
                  else next.delete(idx);
                  return next;
                })
              }
            />
            I've checked the whole diagram against this
          </label>
        </section>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {reviewed.size} of {total} considered
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-700 text-sm transition hover:bg-neutral-50 disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => (isLast ? onClose() : setIdx((i) => Math.min(total - 1, i + 1)))}
              className="rounded-md border border-accent-400 bg-accent-50 px-3 py-1.5 font-medium text-accent-900 text-sm transition hover:bg-accent-100 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-100"
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </LargeDialog>
  );
}
