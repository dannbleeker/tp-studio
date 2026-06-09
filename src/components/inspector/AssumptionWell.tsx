import clsx from 'clsx';
import { Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { AssumptionKind, AssumptionStatus } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Button } from '../ui/Button';
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

// Session 135 — chip palette moved to `chipColors.ts` so the
// inspector's status / source / strength pills share one source of
// truth for the dark-mode colour stack.
const STATUS_CHIP_CLASS = ASSUMPTION_STATUS_CHIP;

const nextStatus = (s: AssumptionStatus): AssumptionStatus => {
  const idx = STATUS_ORDER.indexOf(s);
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length] ?? 'unexamined';
};

// S&T sub-typing (Session 135). The kind chip cycles through the
// "untyped" state (undefined) plus the three roles, so a user can
// always get back to untyped without a separate clear control.
const KIND_CYCLE: (AssumptionKind | undefined)[] = [
  undefined,
  'necessary',
  'parallel',
  'sufficient',
];

const KIND_LABEL: Record<AssumptionKind, string> = {
  necessary: 'Necessary',
  parallel: 'Parallel',
  sufficient: 'Sufficient',
};

/** Single-letter glyph for the compact chip. `—` reads as "untyped". */
const kindGlyph = (k: AssumptionKind | undefined): string => (k ? KIND_LABEL[k].charAt(0) : '—');
const kindLabel = (k: AssumptionKind | undefined): string => (k ? KIND_LABEL[k] : 'Untyped');

const nextKind = (k: AssumptionKind | undefined): AssumptionKind | undefined => {
  const idx = KIND_CYCLE.indexOf(k);
  return KIND_CYCLE[(idx + 1) % KIND_CYCLE.length];
};

export function AssumptionWell({
  edgeId,
  assumptionIds,
}: {
  edgeId: string;
  assumptionIds: readonly string[];
}) {
  const addAssumptionToEdge = useDocumentStore((s) => s.addAssumptionToEdge);
  const locked = useDocumentStore((s) => s.browseLocked);
  const diagramType = useDocumentStore((s) => currentDoc(s).diagramType);
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
    <Field label={`Assumptions (${assumptionIds.length})`} as="group">
      {assumptionIds.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {assumptionIds.map((id) => (
            <AssumptionRow
              key={id}
              edgeId={edgeId}
              assumptionId={id}
              autoFocus={id === lastAddedRef.current}
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
    <li className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50/40 px-1 py-1 dark:border-violet-900/40 dark:bg-violet-950/20">
      <button
        type="button"
        onClick={() => setAssumptionStatus(assumptionId, nextStatus(status))}
        disabled={locked}
        title={`Status: ${STATUS_LABEL[status]} (click to cycle to ${STATUS_LABEL[nextStatus(status)]})`}
        aria-label={`Assumption status: ${STATUS_LABEL[status]}. Press to cycle to ${STATUS_LABEL[nextStatus(status)]}.`}
        className={clsx(
          'shrink-0 rounded-xs border px-1 py-0 font-bold text-[9px] uppercase tracking-wide transition focus:outline-hidden focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50',
          STATUS_CHIP_CLASS[status]
        )}
      >
        {STATUS_LABEL[status][0]}
      </button>
      {/* S&T sub-typing chip (Session 135) — cycles untyped → necessary
          → parallel → sufficient. Sits next to the status chip so the
          two single-letter pills read as "status · kind". */}
      <button
        type="button"
        onClick={() => setAssumptionKind(assumptionId, nextKind(kind))}
        disabled={locked}
        title={`Kind: ${kindLabel(kind)} (click to cycle to ${kindLabel(nextKind(kind))})`}
        aria-label={`Assumption kind: ${kindLabel(kind)}. Press to cycle to ${kindLabel(nextKind(kind))}.`}
        className={clsx(
          'shrink-0 rounded-xs border px-1 py-0 font-bold text-[9px] uppercase tracking-wide transition focus:outline-hidden focus:ring-2 focus:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50',
          kind ? ASSUMPTION_KIND_CHIP[kind] : CHIP_SCHEME.neutral
        )}
      >
        {kindGlyph(kind)}
      </button>
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
