import type { Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { ArrowUpRight, Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Field } from './Field';

export function EdgeAssumptions({
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
    // Pre-populate the title with the prefix so the user types the rest.
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
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const detachAssumption = useDocumentStore((s) => s.detachAssumption);
  const selectEntity = useDocumentStore((s) => s.selectEntity);
  const locked = useDocumentStore((s) => s.browseLocked);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      // Move the caret to the end of any seed text (e.g. the EC "…because "
      // prefix) so the user types where they expect rather than at index 0.
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }, [autoFocus]);

  return (
    <li className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50/40 px-1 py-1 dark:border-violet-900/40 dark:bg-violet-950/20">
      <input
        ref={inputRef}
        data-assumption-id={assumption.id}
        value={assumption.title}
        placeholder="State the assumption…"
        onChange={(e) => updateEntity(assumption.id, { title: e.target.value })}
        disabled={locked}
        className="flex-1 bg-transparent px-1 py-0.5 text-neutral-800 text-xs outline-none placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200"
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
