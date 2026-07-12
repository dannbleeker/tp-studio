import { Plus, X } from 'lucide-react';
import type { Entity } from '@/domain/types';
import { Button } from '../ui/Button';
import { CollapsibleSection } from './CollapsibleSection';

/**
 * Session 198 (backlog D6) — the alternative-means brainstorm list.
 *
 * Cheng's Ch. 27 method: a Want (D/D′) is only *one* means to its Need, and an
 * injection is only *one* way to break the conflict. Listing candidate
 * alternatives beside the node keeps the brainstorm attached to what it's about
 * — and one of them may satisfy the same Need without triggering the conflict.
 *
 * Renders for `want` and `injection` entities only. Values are held raw in the
 * store while editing (so the user can type freely); blank entries are dropped
 * on persist by `validateAlternativeMeans`. Removing the last entry clears the
 * field (→ undefined) rather than leaving an empty array.
 */
const INPUT_CLASS =
  'w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-xs outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

export function AlternativeMeansSection({
  entity,
  locked,
  onChange,
}: {
  entity: Entity;
  locked: boolean;
  /** Persist the next list; pass `undefined` to clear the field entirely. */
  onChange: (next: string[] | undefined) => void;
}) {
  const means = entity.alternativeMeans ?? [];
  const isInjection = entity.type === 'injection';

  const setAt = (index: number, value: string): void => {
    onChange(means.map((m, j) => (j === index ? value : m)));
  };
  const removeAt = (index: number): void => {
    const next = means.filter((_, j) => j !== index);
    onChange(next.length > 0 ? next : undefined);
  };
  const add = (): void => onChange([...means, '']);

  return (
    <CollapsibleSection
      id="alternative-means"
      title="Alternative means"
      defaultOpen={means.length > 0}
    >
      <p className="text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
        {isInjection
          ? 'This injection is one way to break the conflict — brainstorm others. A different one may carry less risk or resistance.'
          : 'This Want is just one means to its Need. List other means that could meet the same Need — one of them may dissolve the conflict.'}
      </p>
      {means.map((m, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are controlled straight from the store (no per-row local state), and the list only ever appends or removes — never reorders — so index keys are stable here.
          key={i}
          className="flex items-center gap-1.5"
        >
          <input
            className={INPUT_CLASS}
            value={m}
            disabled={locked}
            aria-label={`Alternative means ${i + 1}`}
            placeholder="Another way to meet the need…"
            onChange={(e) => setAt(i, e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            disabled={locked}
            aria-label={`Remove alternative means ${i + 1}`}
            onClick={() => removeAt(i)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div>
        <Button variant="softNeutral" size="sm" disabled={locked} onClick={add}>
          <Plus className="h-3.5 w-3.5" />
          Add a means
        </Button>
      </div>
    </CollapsibleSection>
  );
}
