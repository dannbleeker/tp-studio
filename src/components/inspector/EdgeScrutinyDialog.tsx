import clsx from 'clsx';
import { AlertTriangle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CLR_SCRUTINY } from '@/domain/clrScrutiny';
import type { ClrRuleId, ClrTier, Edge, TPDocument, Warning } from '@/domain/types';
import { validate } from '@/domain/validators';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Button } from '../ui/Button';
import { LargeDialog } from '../ui/LargeDialog';

/**
 * Phase 3 #7 — guided CLR-scrutiny dialog. Opened by the "Scrutinize this
 * edge…" palette command on a single selected edge. Walks the eight canonical
 * Categories of Legitimate Reservation one question at a time for that one
 * cause→effect arrow, surfacing any auto-flagged validator warnings under each
 * category and letting the practitioner tick off each reservation as reviewed.
 *
 * Purely a review surface: it reads `validate(doc)` but mutates nothing and
 * persists nothing — the "reviewed" ticks are ephemeral session state that
 * resets each time a new edge is scrutinized (the body remounts via `key`).
 * No schema change; the basic drawing flow is untouched.
 */
export function EdgeScrutinyDialog() {
  const edgeId = useDocumentStore((s) => s.edgeScrutinyId);
  const close = useDocumentStore((s) => s.closeEdgeScrutiny);
  const doc = useDocumentStore((s) => currentDoc(s));

  if (edgeId === null) return null;
  const edge = doc.edges[edgeId];

  // The edge can disappear out from under an open dialog (undo, or a delete
  // in another tab). Render a dismissible shell rather than calling the
  // close action during render.
  if (!edge) {
    return (
      <LargeDialog
        open
        onClose={close}
        title="Scrutinize this link"
        subtitle="This link no longer exists."
        closeAriaLabel="Close edge scrutiny"
        widthClass="w-[min(560px,94vw)]"
      >
        <p className="px-1 py-6 text-center text-neutral-500 text-sm dark:text-neutral-400">
          The link you were scrutinizing has been removed. Close this and pick another.
        </p>
      </LargeDialog>
    );
  }

  return <EdgeScrutinyBody key={edgeId} doc={doc} edge={edge} onClose={close} />;
}

const TIER_META: Record<ClrTier, { label: string; cls: string }> = {
  clarity: {
    label: 'Clarity',
    cls: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  },
  existence: {
    label: 'Existence',
    cls: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  },
  sufficiency: {
    label: 'Sufficiency',
    cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
};

function EdgeScrutinyBody({
  doc,
  edge,
  onClose,
}: {
  doc: TPDocument;
  edge: Edge;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [reviewed, setReviewed] = useState<Set<ClrRuleId>>(() => new Set());

  // Auto-flagged validator warnings on THIS edge, bucketed by rule so each
  // scrutiny question can show what (if anything) the validators caught.
  const warningsByRule = useMemo(() => {
    const map = new Map<ClrRuleId, Warning[]>();
    for (const w of validate(doc)) {
      if (w.target.kind === 'edge' && w.target.id === edge.id) {
        const list = map.get(w.ruleId);
        if (list) list.push(w);
        else map.set(w.ruleId, [w]);
      }
    }
    return map;
  }, [doc, edge.id]);

  const total = CLR_SCRUTINY.length;
  const category = CLR_SCRUTINY[stepIndex];
  if (!category) return null; // unreachable: stepIndex is clamped 0..total-1

  const cause = doc.entities[edge.sourceId];
  const effect = doc.entities[edge.targetId];
  const causeTitle = cause?.title.trim() || 'Untitled';
  const effectTitle = effect?.title.trim() || 'Untitled';

  const tier = TIER_META[category.tier];
  const flagged = warningsByRule.get(category.ruleId) ?? [];
  const flaggedTotal = Array.from(warningsByRule.values()).reduce((n, ws) => n + ws.length, 0);
  const isLast = stepIndex === total - 1;

  const toggleReviewed = (ruleId: ClrRuleId): void => {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  return (
    <LargeDialog
      open
      onClose={onClose}
      title="Scrutinize this link"
      subtitle={`“${causeTitle}” → “${effectTitle}”`}
      closeAriaLabel="Close edge scrutiny"
      widthClass="w-[min(620px,94vw)]"
    >
      <div className="flex flex-col gap-4">
        {/* Orientation: how many reservations the validators already flagged. */}
        <p className="text-neutral-500 text-xs dark:text-neutral-400">
          {flaggedTotal === 0
            ? 'Nothing was auto-flagged on this link — walk the questions anyway; the validators only catch the structural cases.'
            : `TP Studio auto-flagged ${flaggedTotal} reservation${flaggedTotal === 1 ? '' : 's'} on this link. They are called out under the matching questions below.`}
        </p>

        {/* Progress dots — clickable to jump to any question. */}
        <ol className="flex flex-wrap gap-1.5" aria-label="CLR questions">
          {CLR_SCRUTINY.map((c, i) => {
            const done = reviewed.has(c.ruleId);
            const current = i === stepIndex;
            return (
              <li key={c.ruleId}>
                <button
                  type="button"
                  onClick={() => setStepIndex(i)}
                  aria-label={`Question ${i + 1}: ${c.label}${done ? ' (reviewed)' : ''}`}
                  aria-current={current ? 'step' : undefined}
                  className={clsx(
                    'flex h-6 w-6 items-center justify-center rounded-full border text-[11px] transition',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400',
                    current
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : done
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-neutral-300 text-neutral-500 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400'
                  )}
                >
                  {done && !current ? <Check className="h-3 w-3" /> : i + 1}
                </button>
              </li>
            );
          })}
        </ol>

        {/* The current question. */}
        <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400 text-xs dark:text-neutral-500">
              Question {stepIndex + 1} of {total}
            </span>
            <span
              className={clsx(
                'rounded-full px-2 py-0.5 font-medium text-[10px] uppercase tracking-wider',
                tier.cls
              )}
            >
              {tier.label}
            </span>
          </div>
          <h3 className="font-semibold text-neutral-800 text-sm dark:text-neutral-100">
            {category.label}
          </h3>
          <p className="text-neutral-700 text-sm leading-relaxed dark:text-neutral-200">
            {category.question}
          </p>
          <p className="text-neutral-500 text-xs italic dark:text-neutral-400">{category.hint}</p>

          {flagged.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900/40 dark:bg-amber-950/30">
              <span className="flex items-center gap-1.5 font-medium text-[11px] text-amber-700 uppercase tracking-wider dark:text-amber-300">
                <AlertTriangle className="h-3.5 w-3.5" />
                Auto-flagged here
              </span>
              <ul className="flex flex-col gap-1">
                {flagged.map((w) => (
                  <li key={w.id} className="text-amber-800 text-xs dark:text-amber-200">
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="mt-1 flex items-center gap-2 text-neutral-600 text-xs dark:text-neutral-300">
            <input
              type="checkbox"
              checked={reviewed.has(category.ruleId)}
              onChange={() => toggleReviewed(category.ruleId)}
              className="h-4 w-4 rounded border-neutral-300 text-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-neutral-600"
            />
            I’ve considered this reservation for this link
          </label>
        </section>

        {/* Stepper controls. */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-neutral-400 text-xs dark:text-neutral-500">
            {reviewed.size} of {total} reviewed
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="softNeutral"
              size="sm"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            >
              Previous
            </Button>
            {isLast ? (
              <Button variant="primary" size="sm" onClick={onClose}>
                Finish
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStepIndex((i) => Math.min(total - 1, i + 1))}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </LargeDialog>
  );
}
