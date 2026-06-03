import type { ActionEligibility } from '@/domain/actionEligibility';
import type { Entity } from '@/domain/types';
import { TextArea, TextInput } from '../settings/formPrimitives';
import { InsetCard } from '../ui/InsetCard';
import { Field } from './Field';

/**
 * Transition-Tree Action fields — the Step # ordering, the per-step Need /
 * Working Assumption (the rest of the TT triple: Action ← Need ← Working
 * Assumption), and the action-eligibility callout. All action-only; the
 * eligibility card renders only when there's a precondition slot to judge
 * (`status !== 'na'`). The parent wraps `updateEntity` so this section takes a
 * plain `onUpdate`. Extracted verbatim from `EntityInspector.tsx` (Session 169).
 */
export function ActionFields({
  entity,
  locked,
  eligibility,
  onUpdate,
}: {
  entity: Entity;
  locked: boolean;
  eligibility: ActionEligibility | null;
  // Explicit `| undefined` per field: clearing a value passes `undefined`, which
  // the store's `updateEntity` patch accepts but a bare `Partial<Entity>` would
  // reject under `exactOptionalPropertyTypes`.
  onUpdate: (patch: {
    ordering?: number | undefined;
    need?: string | undefined;
    workingAssumption?: string | undefined;
  }) => void;
}) {
  return (
    <>
      {entity.type === 'action' && (
        <Field label="Step #">
          <TextInput
            type="number"
            className="w-24"
            value={entity.ordering?.toString() ?? ''}
            placeholder="—"
            disabled={locked}
            onChange={(raw) => {
              if (raw === '') {
                onUpdate({ ordering: undefined });
                return;
              }
              const n = Number.parseInt(raw, 10);
              if (Number.isFinite(n) && n > 0) onUpdate({ ordering: n });
            }}
          />
        </Field>
      )}

      {/* Phase 3 #8 (TT richness) — per-step Need + Working Assumption, the rest
          of the Transition-Tree triple. Action-only, like Step # above. */}
      {entity.type === 'action' && (
        <>
          <Field label="Need">
            <TextArea
              rows={2}
              value={entity.need ?? ''}
              placeholder="Why is this step needed — the need it satisfies. Optional."
              disabled={locked}
              onChange={(next) => onUpdate({ need: next || undefined })}
            />
          </Field>
          <Field label="Working assumption">
            <TextArea
              rows={2}
              value={entity.workingAssumption ?? ''}
              placeholder="The belief that makes this action sufficient to meet the need. Optional."
              disabled={locked}
              onChange={(next) => onUpdate({ workingAssumption: next || undefined })}
            />
          </Field>
        </>
      )}

      {/* Action eligibility (medium gap) — folds the action's preconditions'
          effective states. Renders only when there's a precondition slot to
          judge (status !== 'na'). Reflects the speculation overlay when active. */}
      {eligibility && eligibility.status !== 'na' && (
        <Field label="Eligibility" as="group">
          {eligibility.status === 'eligible' && (
            <InsetCard tone="emerald">
              <span className="font-semibold">Eligible</span> — every precondition is satisfied;
              this step is ready to fire.
            </InsetCard>
          )}
          {eligibility.status === 'blocked' && (
            <InsetCard tone="rose">
              <span className="font-semibold">Blocked</span> — precondition{' '}
              <span className="font-semibold">
                {eligibility.blockedBy?.title?.trim() || '(untitled)'}
              </span>{' '}
              is false.
            </InsetCard>
          )}
          {eligibility.status === 'pending' && (
            <InsetCard tone="amber">
              <span className="font-semibold">Pending</span> —{' '}
              {eligibility.preconditions.length === 1
                ? 'the precondition is'
                : 'some preconditions are'}{' '}
              not yet established (unknown / disputed).
            </InsetCard>
          )}
        </Field>
      )}
    </>
  );
}
