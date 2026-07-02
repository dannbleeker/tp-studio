import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { assumptionsForEdge } from '@/domain/graph';
import type { AssumptionKind, AssumptionStatus } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Button } from '../ui/Button';
import { ChipSelect } from './ChipSelect';
import { ASSUMPTION_KIND_CHIP, ASSUMPTION_STATUS_CHIP, CHIP_SCHEME } from './chipColors';
import { Field } from './Field';

/**
 * Session 77 / brief §6 — Assumption Well.
 *
 * Renders each assumption with a status chip (unexamined / valid / invalid /
 * challengeable) so the user can track the lifecycle of every
 * "we're assuming X" claim attached to an edge.
 *
 * Status colour mapping (from brief):
 *   - unexamined → grey (default for newly added)
 *   - valid       → amber
 *   - invalid     → red (often the breakthrough)
 *   - challengeable → blue (lights up the injection workbench)
 *
 * Session 193 — the status + kind chips are direct-pick `ChipSelect`s (any
 * value one click away), replacing the earlier forward-only cycle chips.
 */

const STATUS_ORDER: AssumptionStatus[] = ['unexamined', 'valid', 'invalid', 'challengeable'];

const STATUS_LABEL: Record<AssumptionStatus, string> = {
  unexamined: 'Unexamined',
  valid: 'Valid',
  invalid: 'Invalid',
  challengeable: 'Challengeable',
};

const STATUS_OPTIONS = STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

// Session 135 — chip palette moved to `chipColors.ts` so the
// inspector's status / source / strength pills share one source of
// truth for the dark-mode colour stack.
const STATUS_CHIP_CLASS = ASSUMPTION_STATUS_CHIP;

const KIND_LABEL: Record<AssumptionKind, string> = {
  necessary: 'Necessary',
  parallel: 'Parallel',
  sufficient: 'Sufficient',
};

// The kind picker includes the "untyped" state (persisted as `undefined`),
// mapped to the empty-string sentinel so the native <select> can round-trip it.
const KIND_OPTIONS: { value: '' | AssumptionKind; label: string }[] = [
  { value: '', label: 'Untyped' },
  { value: 'necessary', label: KIND_LABEL.necessary },
  { value: 'parallel', label: KIND_LABEL.parallel },
  { value: 'sufficient', label: KIND_LABEL.sufficient },
];

const kindLabel = (k: AssumptionKind | undefined): string => (k ? KIND_LABEL[k] : 'Untyped');

export function AssumptionWell({ edgeId }: { edgeId: string }) {
  const addAssumptionToEdge = useDocumentStore((s) => s.addAssumptionToEdge);
  const locked = useDocumentStore((s) => s.browseLocked);
  const diagramType = useDocumentStore((s) => currentDoc(s).diagramType);
  // Record-canonical: the edge's assumptions are the `doc.assumptions` records
  // keyed to it. `assumptionsForEdge` returns a per-`doc.assumptions` cached,
  // referentially-stable array, so this selector doesn't re-render on unrelated
  // store changes.
  const records = useDocumentStore((s) => assumptionsForEdge(currentDoc(s), edgeId));
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
    <Field label={`Assumptions (${records.length})`} as="group">
      {records.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {records.map((rec) => (
            <AssumptionRow
              key={rec.id}
              edgeId={edgeId}
              assumptionId={rec.id}
              autoFocus={rec.id === lastAddedRef.current}
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
  assumptionId,
  autoFocus,
}: {
  edgeId: string;
  assumptionId: string;
  autoFocus: boolean;
}) {
  const setAssumptionText = useDocumentStore((s) => s.setAssumptionText);
  const setAssumptionStatus = useDocumentStore((s) => s.setAssumptionStatus);
  const setAssumptionKind = useDocumentStore((s) => s.setAssumptionKind);
  const detachAssumption = useDocumentStore((s) => s.detachAssumption);
  // Subscribe to this assumption's own record (granular — the row re-renders
  // only when ITS record changes). Record-canonical: text / status / kind all
  // come from the record now, not the legacy assumption-Entity's title.
  const record = useDocumentStore((s) => currentDoc(s).assumptions?.[assumptionId]);
  const status: AssumptionStatus = record?.status ?? 'unexamined';
  const kind: AssumptionKind | undefined = record?.kind;
  const text = record?.text ?? '';
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
    <li className="flex flex-wrap items-center gap-1 rounded-md border border-violet-200 bg-violet-50/40 px-1 py-1 dark:border-violet-900/40 dark:bg-violet-950/20">
      <ChipSelect
        value={status}
        options={STATUS_OPTIONS}
        onChange={(next) => setAssumptionStatus(assumptionId, next)}
        disabled={locked}
        colorClass={STATUS_CHIP_CLASS[status]}
        ariaLabel={`Assumption status: ${STATUS_LABEL[status]}`}
        title="Assumption status"
      />
      {/* S&T sub-typing (Session 135) — untyped / necessary / parallel /
          sufficient. Sits next to the status chip so the two read as
          "status · kind". */}
      <ChipSelect
        value={kind ?? ''}
        options={KIND_OPTIONS}
        onChange={(next) => setAssumptionKind(assumptionId, next === '' ? undefined : next)}
        disabled={locked}
        colorClass={kind ? ASSUMPTION_KIND_CHIP[kind] : CHIP_SCHEME.neutral}
        ariaLabel={`Assumption kind: ${kindLabel(kind)}`}
        title="Assumption kind (S&T)"
      />
      <input
        ref={inputRef}
        data-assumption-id={assumptionId}
        value={text}
        placeholder="State the assumption…"
        onChange={(e) => setAssumptionText(assumptionId, e.target.value)}
        disabled={locked}
        className="flex-1 bg-transparent px-1 py-0.5 text-neutral-800 text-xs outline-hidden placeholder:text-neutral-400 disabled:opacity-60 dark:text-neutral-200"
      />
      <button
        type="button"
        onClick={() => detachAssumption(edgeId, assumptionId)}
        disabled={locked}
        className="rounded-sm p-1 text-neutral-500 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
        title="Detach from this edge"
        aria-label="Detach from this edge"
      >
        <X className="h-3 w-3" />
      </button>
    </li>
  );
}
