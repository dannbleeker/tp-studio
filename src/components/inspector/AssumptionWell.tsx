import type { AssumptionStatus, Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { ArrowUpRight, Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Field } from './Field';

/**
 * Session 77 / brief §6 — Assumption Well.
 *
 * Enhanced replacement for the legacy `EdgeAssumptions` panel. Renders
 * each assumption with a status chip (unexamined / valid / invalid /
 * challengeable) so the user can track the lifecycle of every
 * "we're assuming X" claim attached to an edge.
 *
 * Status colour mapping (from brief):
 *   - unexamined → grey (default for newly added)
 *   - valid       → amber
 *   - invalid     → red (often the breakthrough)
 *   - challengeable → blue (lights up the injection workbench)
 *
 * Clicking the chip cycles through the four states in order. The
 * "+1" round-trip is fine for a low-frequency action; the chip
 * doubles as a status indicator.
 */

const STATUS_ORDER: AssumptionStatus[] = ['unexamined', 'valid', 'invalid', 'challengeable'];

const STATUS_LABEL: Record<AssumptionStatus, string> = {
  unexamined: 'Unexamined',
  valid: 'Valid',
  invalid: 'Invalid',
  challengeable: 'Challengeable',
};

const STATUS_CHIP_CLASS: Record<AssumptionStatus, string> = {
  unexamined:
    'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
  valid:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
  invalid:
    'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
  challengeable:
    'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
};

const nextStatus = (s: AssumptionStatus): AssumptionStatus => {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? 'unexamined';
};

export function AssumptionWell({
  edgeId,
  assumptions,
}: {
  edgeId: string;
  assumptions: Entity[];
}) {
  const addAssumptionToEdge = useDocumentStore((s) => s.addAssumptionToEdge);
  const locked = useDocumentStore((s) => s.browseLocked);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const lastAddedRef = useRef<string | null>(null);

  const handleAdd = () => {
    // TOC-reading prompt: on Evaporating Cloud edges the book recommends
    // every assumption start with "…because" so the canonical reading
    // ("we must obtain Want because of Assumption") falls out for free.
    const seedTitle = diagramType === 'ec' ? '…because ' : undefined;
    const created = addAssumptionToEdge(edgeId, seedTitle);
    if (created) lastAddedRef.current = created.id;
  };

  return (
    <Field label={`Assumptions (${assumptions.length})`}>
      {assumptions.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {assumptions.map((a) => (
            <AssumptionRow
              key={a.id}
              edgeId={edgeId}
              assumption={a}
              autoFocus={a.id === lastAddedRef.current}
            />
          ))}
        </ul>
      )}
      <Button variant="softViolet" size="md" onClick={handleAdd} disabled={locked}>
        <Plus className="h-3.5 w-3.5" />
        New assumption
      </Button>
    </Field>
  );
}

function AssumptionRow({
  edgeId,
  assumption,
  autoFocus,
}: {
  edgeId: string;
  assumption: Entity;
  autoFocus: boolean;
}) {
  const setAssumptionText = useDocumentStore((s) => s.setAssumptionText);
  const setAssumptionStatus = useDocumentStore((s) => s.setAssumptionStatus);
  const detachAssumption = useDocumentStore((s) => s.detachAssumption);
  const selectEntity = useDocumentStore((s) => s.selectEntity);
  const status: AssumptionStatus =
    useDocumentStore((s) => s.doc.assumptions?.[assumption.id]?.status) ?? 'unexamined';
  const locked = useDocumentStore((s) => s.browseLocked);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }, [autoFocus]);

  return (
    <li className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50/40 px-1 py-1 dark:border-violet-900/40 dark:bg-violet-950/20">
      <button
        type="button"
        onClick={() => setAssumptionStatus(assumption.id, nextStatus(status))}
        disabled={locked}
        title={`Status: ${STATUS_LABEL[status]} (click to cycle)`}
        aria-label={`Assumption status: ${STATUS_LABEL[status]} — click to cycle`}
        className={clsx(
          'shrink-0 rounded border px-1 py-0 text-[9px] font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50',
          STATUS_CHIP_CLASS[status]
        )}
      >
        {STATUS_LABEL[status][0]}
      </button>
      <input
        ref={inputRef}
        data-assumption-id={assumption.id}
        value={assumption.title}
        placeholder="State the assumption…"
        onChange={(e) => setAssumptionText(assumption.id, e.target.value)}
        disabled={locked}
        className="flex-1 bg-transparent px-1 py-0.5 text-xs text-neutral-800 outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200"
      />
      <button
        type="button"
        onClick={() => selectEntity(assumption.id)}
        className="rounded p-1 text-neutral-500 transition hover:bg-violet-100 hover:text-violet-700 dark:hover:bg-violet-900/40 dark:hover:text-violet-300"
        title="Open assumption"
        aria-label="Open assumption"
      >
        <ArrowUpRight className="h-3 w-3" />
      </button>
      <button
        type="button"
        onClick={() => detachAssumption(edgeId, assumption.id)}
        disabled={locked}
        className="rounded p-1 text-neutral-500 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        title="Detach from this edge"
        aria-label="Detach from this edge"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
