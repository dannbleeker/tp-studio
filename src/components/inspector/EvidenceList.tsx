import clsx from 'clsx';
import { CheckCircle2, ExternalLink, Plus, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { EvidenceItem, EvidenceSource, EvidenceStrength } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { TextArea, TextInput } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import { EVIDENCE_SOURCE_CHIP, EVIDENCE_STRENGTH_CHIP } from './chipColors';
import { Field } from './Field';

/**
 * Session 134 / spec major gap #6 (structured half) — Evidence list.
 *
 * Renders the entity's `evidence[]` array beneath the Owner field
 * in the EntityInspector. Each row is editable in place: description
 * textarea on top, a compact strip below with source pill, strength
 * pill, optional URL field, validate button, and a trash icon.
 *
 * The component is intentionally a single editable list — no
 * collapsible row, no per-item modal. The evidence model is
 * append-mostly + edit-rarely, and a dialog-per-row would add gesture
 * cost without a payoff. Keeps the parity with the AssumptionWell's
 * lightweight inline-edit pattern.
 *
 * State flow: every field-change goes through the dedicated
 * `updateEvidence(entityId, evidenceId, patch)` store action. Add is
 * `addEvidence(entityId, partial?)` which mints id + timestamps +
 * defaults (`source: 'observed'`, `strength: 'moderate'`) and returns
 * the new id so we can focus the description textarea. Remove is
 * `removeEvidence(entityId, evidenceId)`.
 */

const SOURCE_ORDER: EvidenceSource[] = [
  'observed',
  'stakeholder',
  'metric',
  'policy',
  'assumption',
];

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  observed: 'Observed',
  stakeholder: 'Stakeholder',
  metric: 'Metric',
  policy: 'Policy',
  assumption: 'Assumption',
};

// Session 135 — chip palettes moved to `chipColors.ts` (shared with
// AssumptionWell). Local aliases keep the call-site labels readable
// while the colour stack lives in one place.
const SOURCE_CHIP_CLASS = EVIDENCE_SOURCE_CHIP;

const STRENGTH_ORDER: EvidenceStrength[] = ['weak', 'moderate', 'strong'];

const STRENGTH_LABEL: Record<EvidenceStrength, string> = {
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
};

const STRENGTH_CHIP_CLASS = EVIDENCE_STRENGTH_CHIP;

const cycleSource = (s: EvidenceSource): EvidenceSource => {
  const idx = SOURCE_ORDER.indexOf(s);
  return SOURCE_ORDER[(idx + 1) % SOURCE_ORDER.length] ?? 'observed';
};

const cycleStrength = (s: EvidenceStrength): EvidenceStrength => {
  const idx = STRENGTH_ORDER.indexOf(s);
  return STRENGTH_ORDER[(idx + 1) % STRENGTH_ORDER.length] ?? 'moderate';
};

const formatValidatedAt = (t: number): string =>
  new Date(t).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export function EvidenceList({
  entityId,
  evidence,
  ownerHint,
}: {
  entityId: string;
  evidence: EvidenceItem[] | undefined;
  /** The entity's `owner` field — used as a default `validatedBy`
   *  value when the user clicks "Mark validated" on a row. The
   *  evidence row can override this per-item if the entity owner
   *  isn't the right person to credit. Explicit `| undefined` so
   *  callers can pass `entity.owner` (an `optional string`)
   *  through without conditional spread. */
  ownerHint: string | undefined;
}) {
  const addEvidence = useDocumentStore((s) => s.addEvidence);
  const locked = useDocumentStore((s) => s.browseLocked);
  const lastAddedRef = useRef<string | null>(null);

  const items = evidence ?? [];

  const handleAdd = () => {
    const id = addEvidence(entityId);
    if (id) lastAddedRef.current = id;
  };

  return (
    <Field label={`Evidence (${items.length})`} as="group">
      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <EvidenceRow
              key={item.id}
              entityId={entityId}
              item={item}
              ownerHint={ownerHint}
              autoFocus={item.id === lastAddedRef.current}
            />
          ))}
        </ul>
      )}
      <Button variant="softNeutral" size="md" onClick={handleAdd} disabled={locked}>
        <Plus className="h-3.5 w-3.5" />
        Add evidence
      </Button>
    </Field>
  );
}

function EvidenceRow({
  entityId,
  item,
  ownerHint,
  autoFocus,
}: {
  entityId: string;
  item: EvidenceItem;
  ownerHint: string | undefined;
  autoFocus: boolean;
}) {
  const updateEvidence = useDocumentStore((s) => s.updateEvidence);
  const removeEvidence = useDocumentStore((s) => s.removeEvidence);
  const locked = useDocumentStore((s) => s.browseLocked);
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus) {
      const ta = descRef.current;
      if (!ta) return;
      ta.focus();
      const end = ta.value.length;
      ta.setSelectionRange(end, end);
    }
  }, [autoFocus]);

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/60 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
      <TextArea
        ref={descRef}
        rows={2}
        value={item.description}
        placeholder="What's the evidence? Citation, observation, measurement, claim…"
        disabled={locked}
        onChange={(next) => updateEvidence(entityId, item.id, { description: next })}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => updateEvidence(entityId, item.id, { source: cycleSource(item.source) })}
          disabled={locked}
          title={`Source: ${SOURCE_LABEL[item.source]} (click to cycle)`}
          aria-label={`Source ${SOURCE_LABEL[item.source]}. Press to cycle.`}
          className={clsx(
            'shrink-0 rounded-sm border px-1.5 py-0 font-semibold text-[10px] uppercase tracking-wide outline-hidden transition focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50',
            SOURCE_CHIP_CLASS[item.source]
          )}
        >
          {SOURCE_LABEL[item.source]}
        </button>
        <button
          type="button"
          onClick={() =>
            updateEvidence(entityId, item.id, { strength: cycleStrength(item.strength) })
          }
          disabled={locked}
          title={`Strength: ${STRENGTH_LABEL[item.strength]} (click to cycle)`}
          aria-label={`Strength ${STRENGTH_LABEL[item.strength]}. Press to cycle.`}
          className={clsx(
            'shrink-0 rounded-sm border px-1.5 py-0 font-semibold text-[10px] uppercase tracking-wide outline-hidden transition focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50',
            STRENGTH_CHIP_CLASS[item.strength]
          )}
        >
          {STRENGTH_LABEL[item.strength]}
        </button>
        <TextInput
          type="url"
          value={item.url ?? ''}
          placeholder="https://… (optional)"
          disabled={locked}
          onChange={(next) =>
            updateEvidence(entityId, item.id, {
              // Empty string clears the field; trim whitespace so " "
              // doesn't persist as the only character.
              url: next.trim() === '' ? undefined : next,
            })
          }
          className="h-[26px] min-w-[160px] flex-1 text-xs"
          ariaLabel="Evidence URL"
        />
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="rounded-sm p-1 text-neutral-500 transition hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
            title="Open citation in new tab"
            aria-label="Open citation in new tab"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <button
          type="button"
          onClick={() => removeEvidence(entityId, item.id)}
          disabled={locked}
          className="rounded-sm p-1 text-neutral-500 transition hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
          title="Remove evidence"
          aria-label="Remove evidence"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-neutral-500 dark:text-neutral-400">
        <Button
          variant="softNeutral"
          size="xs"
          disabled={locked}
          onClick={() =>
            updateEvidence(entityId, item.id, {
              validatedAt: Date.now(),
              ...(ownerHint && ownerHint.length > 0 ? { validatedBy: ownerHint } : {}),
            })
          }
        >
          <CheckCircle2 className="h-3 w-3" />
          {item.validatedAt === undefined ? 'Mark validated' : 'Re-validate'}
        </Button>
        {item.validatedAt !== undefined && (
          <span>
            {formatValidatedAt(item.validatedAt)}
            {item.validatedBy ? ` · ${item.validatedBy}` : ''}
          </span>
        )}
      </div>
    </li>
  );
}
