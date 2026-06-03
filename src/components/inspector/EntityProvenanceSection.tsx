import type { Entity } from '@/domain/types';
import { TextArea, TextInput } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import { EvidenceList } from './EvidenceList';
import { Field } from './Field';

/**
 * Provenance block — "where did this come from + who's accountable + what's it
 * standing on": the free-text Attestation (E6), the Owner + Mark-validated
 * control, and the first-class Evidence list (paired with Owner since the two
 * are conceptually "who's accountable" + "what they're standing on"). The parent
 * wraps `updateEntity` so this section takes a plain `onUpdate`. Extracted
 * verbatim from `EntityInspector.tsx` (Session 169 structural tier).
 */
export function EntityProvenanceSection({
  entity,
  entityId,
  locked,
  onUpdate,
}: {
  entity: Entity;
  entityId: string;
  locked: boolean;
  onUpdate: (patch: {
    attestation?: string | undefined;
    owner?: string | undefined;
    lastValidatedAt?: number | undefined;
  }) => void;
}) {
  return (
    <>
      <Field label="Attestation">
        {/* E6: optional source / evidence citation for the entity — "where did
            this come from?" Free text rather than a structured field because
            real sources don't fit one shape (URL, doc page, person, interview
            date, internal report). The field's purpose is *visible provenance*,
            not searchable metadata; the inspector is the only consumer today. */}
        <TextArea
          rows={2}
          value={entity.attestation ?? ''}
          placeholder="Source or evidence — URL, document, interview, etc. Optional."
          onChange={(next) => onUpdate({ attestation: next || undefined })}
          disabled={locked}
        />
      </Field>

      {/* `as="group"` — this Field carries the Owner input PLUS the "Mark
          validated" button, so a single `<label>` can't wrap it; the input keeps
          an explicit ariaLabel for its own name. */}
      <Field label="Owner" as="group">
        {/* Session 134 / spec major gap #6: who's accountable for this entity.
            Free-form string. Feeds the `owner` column of the risk-register CSV
            export and gives readers a quick "ask this person" anchor. */}
        <TextInput
          value={entity.owner ?? ''}
          placeholder="Person / role accountable for this entity. Optional."
          ariaLabel="Owner"
          onChange={(next) => onUpdate({ owner: next || undefined })}
          disabled={locked}
        />
        {entity.lastValidatedAt !== undefined && (
          <p className="mt-1 text-[10px] text-neutral-500 dark:text-neutral-400">
            Last validated{' '}
            {new Date(entity.lastValidatedAt).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
            {entity.owner ? ` by ${entity.owner}` : ''}
          </p>
        )}
        <Button
          variant="softNeutral"
          size="xs"
          disabled={locked}
          onClick={() => onUpdate({ lastValidatedAt: Date.now() })}
          className="mt-1 self-start"
        >
          {entity.lastValidatedAt === undefined ? 'Mark validated' : 'Re-validate (now)'}
        </Button>
      </Field>

      {/* Session 134 / spec major gap #6 (structured half) — first-class evidence
          list, beneath Owner since the two are conceptually paired. */}
      <EvidenceList entityId={entityId} evidence={entity.evidence} ownerHint={entity.owner} />
    </>
  );
}
