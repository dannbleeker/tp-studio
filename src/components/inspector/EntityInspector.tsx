import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { actionEligibility } from '@/domain/actionEligibility';
import { EC_SLOT_GUIDING_QUESTIONS, EC_SLOT_LABEL, type ECSlot } from '@/domain/ecGuiding';
import { paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { ST_FACET_KEYS } from '@/domain/graph';
import { effectiveState } from '@/domain/statePropagation';
import type { EntityState, EntityType, Warning } from '@/domain/types';
import { usePropagatedStates } from '@/hooks/usePropagatedStates';
import { useEntity } from '@/hooks/useSelected';
import { confirmAndDeleteEntity } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { TextArea, TextInput } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import { ButtonGroup } from '../ui/ButtonGroup';
import {
  SELECTED_BUTTON_CLASS,
  TOGGLE_BUTTON_BASE,
  UNSELECTED_BUTTON_CLASS,
} from '../ui/buttonClasses';
import { InsetCard } from '../ui/InsetCard';
import { AttachedEdgesList } from './AttachedEdgesList';
import { EntityAttributesSection } from './AttributesSection';
import { EvidenceList } from './EvidenceList';
import { Field } from './Field';
import { MarkdownField } from './MarkdownField';
import { WarningsList } from './WarningsList';

export function EntityInspector({ entityId, warnings }: { entityId: string; warnings: Warning[] }) {
  const entity = useEntity(entityId);
  // Session 87 — narrow store subscriptions to only the fields the
  // inspector actually consumes. Pre-fix, this component subscribed to
  // the entire `doc` object, which re-rendered EntityInspector on every
  // mutation (title edit, edge drag, anywhere in the doc). Now we
  // subscribe to the two doc fields that drive the palette:
  // `diagramType` (filters which entity types appear) and
  // `customEntityClasses` (B10 user-defined classes layered onto the
  // built-in palette). The rest of the doc state doesn't influence this
  // component's render output.
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const customEntityClasses = useDocumentStore((s) => s.doc.customEntityClasses);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const setEntityAttribute = useDocumentStore((s) => s.setEntityAttribute);
  const removeEntityAttribute = useDocumentStore((s) => s.removeEntityAttribute);
  // Phase 1C — when a speculation overlay is active, the state picker
  // writes to the overlay (hypothetical) instead of the doc.
  const speculationOverlay = useDocumentStore((s) => s.speculationOverlay);
  const setSpeculativeState = useDocumentStore((s) => s.setSpeculativeState);
  const locked = useDocumentStore((s) => s.browseLocked);
  // Session 135 / spec gap #4 Phase 1B — propagated state for the
  // currently selected entity. Computed once per entities/edges
  // snapshot; the lookup against the returned record is O(1).
  const derivedStates = usePropagatedStates();
  // Action-eligibility (medium gap) — for a TT Action, fold its
  // preconditions' effective states into eligible / blocked / pending.
  // `usePropagatedStates` already subscribes to entities + edges, so
  // these two reads don't widen the component's re-render surface.
  const docEntities = useDocumentStore((s) => s.doc.entities);
  const docEdges = useDocumentStore((s) => s.doc.edges);
  const eligibility = useMemo(
    () =>
      entity?.type === 'action'
        ? actionEligibility(
            { entities: docEntities, edges: docEdges },
            derivedStates,
            entityId,
            speculationOverlay ?? undefined
          )
        : null,
    [entity?.type, docEntities, docEdges, derivedStates, entityId, speculationOverlay]
  );

  // Memoize the palette derivation — `paletteForDoc` walks the doc's
  // custom classes and merges with the built-in list. Cheap, but
  // re-running it on every render added measurable cost to the
  // selection-to-inspector-visible window. `paletteForDoc` accepts a
  // structural Pick of the two fields so we don't have to lift the
  // whole doc into scope just to call it.
  const availableTypes = useMemo(
    () => paletteForDoc({ diagramType, customEntityClasses }),
    [diagramType, customEntityClasses]
  );

  if (!entity) return null;

  // Session 87 / EC PPT comparison item #2 — re-surface the wizard's
  // per-slot guiding question whenever an EC slot entity is selected,
  // so the prompt stays available after the wizard closes.
  const ecSlot: ECSlot | undefined = entity.ecSlot;
  const showGuidingQuestion = diagramType === 'ec' && ecSlot !== undefined;

  return (
    <div className="flex flex-col gap-4">
      {showGuidingQuestion && ecSlot && (
        <InsetCard
          tone="indigo"
          role="note"
          aria-label={`Guiding question for slot ${ecSlot.toUpperCase()}`}
          data-component="ec-guiding-question"
        >
          <p className="mb-1 font-semibold text-[10px] text-indigo-700 uppercase tracking-wider dark:text-indigo-300">
            {EC_SLOT_LABEL[ecSlot]}
          </p>
          <p className="italic leading-snug">{EC_SLOT_GUIDING_QUESTIONS[ecSlot]}</p>
        </InsetCard>
      )}

      <Field label="Title">
        {/* Session 135 (design audit #1) — `Field` now wraps the
            control in a `<label>`, so the textarea gets its name from
            the visible "Title" implicitly. The Session-119 explicit
            ariaLabel is no longer needed. */}
        <TextArea
          value={entity.title}
          onChange={(next) => updateEntity(entityId, { title: next })}
          rows={3}
          disabled={locked}
        />
      </Field>

      <Field label="Type" as="group">
        <ButtonGroup
          variant="plain"
          columns={2}
          disabled={locked}
          value={entity.type}
          onChange={(type) => updateEntity(entityId, { type: type as EntityType })}
          options={availableTypes.map((type) => {
            const meta = resolveEntityTypeMeta(type, customEntityClasses);
            return { id: type, label: meta.label, stripe: meta.stripeColor };
          })}
        />
      </Field>

      <MarkdownField
        label="Description"
        value={entity.description ?? ''}
        onChange={(next) => updateEntity(entityId, { description: next })}
        placeholder={
          'Optional notes — supports **markdown**.\n' +
          'Link to another entity with [its title](#42) using its #annotation number.'
        }
        locked={locked}
      />

      <Field label="Title size" as="group">
        <ButtonGroup
          columns={3}
          disabled={locked}
          value={entity.titleSize ?? 'md'}
          // `'md'` is the default — clearing it (rather than storing
          // `'md'`) keeps the persisted entity lean.
          onChange={(size) =>
            updateEntity(entityId, { titleSize: size === 'md' ? undefined : size })
          }
          options={[
            { id: 'sm', label: 'Compact' },
            { id: 'md', label: 'Regular' },
            { id: 'lg', label: 'Large' },
          ]}
        />
      </Field>

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
                updateEntity(entityId, { ordering: undefined });
                return;
              }
              const n = Number.parseInt(raw, 10);
              if (Number.isFinite(n) && n > 0) updateEntity(entityId, { ordering: n });
            }}
          />
        </Field>
      )}

      {/* Action eligibility (medium gap) — folds the action's
          preconditions' effective states. Renders only when there's a
          precondition slot to judge (status !== 'na'). Green = ready to
          fire, red = blocked by a false precondition, neutral =
          pending. Reflects the speculation overlay when active. */}
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

      {/* Session 135 / spec major gap #3 Phase 1B — cross-diagram
          traceability badge. Renders only when the entity was
          minted via the "Import entity from another doc…" command
          (Cmd+K). The badge is intentionally subtle — a single line
          beneath the editing controls — because the import-from
          relationship is metadata, not a primary affordance. The
          source-title snapshot was captured at import time and
          doesn't auto-sync; it labels the trail even when the
          source doc isn't open. */}
      {entity.importedFrom && (
        <Field label="Imported from" as="group">
          <InsetCard tone="indigo">
            <span className="font-semibold">
              {entity.importedFrom.sourceTitle || '(untitled source)'}
            </span>
            <span className="ml-1 text-indigo-700/70 dark:text-indigo-300/70">
              · doc {entity.importedFrom.docId.slice(0, 8)}…
            </span>
            {entity.importedFrom.importedAt && (
              <span className="ml-1 text-indigo-700/70 dark:text-indigo-300/70">
                · imported{' '}
                {new Date(entity.importedFrom.importedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}
          </InsetCard>
        </Field>
      )}

      <Field label="Attestation">
        {/* E6: optional source / evidence citation for the entity — "where
            did this come from?" Free text rather than a structured field
            because real sources don't fit one shape (URL, doc page, person,
            interview date, internal report). The field's purpose is
            *visible provenance*, not searchable metadata; the inspector is
            the only consumer today. */}
        <TextArea
          rows={2}
          value={entity.attestation ?? ''}
          placeholder="Source or evidence — URL, document, interview, etc. Optional."
          onChange={(next) => updateEntity(entityId, { attestation: next || undefined })}
          disabled={locked}
        />
      </Field>

      {/* `as="group"` — this Field carries the Owner input PLUS the
          "Mark validated" button, so a single `<label>` can't wrap it;
          the input keeps an explicit ariaLabel for its own name. */}
      <Field label="Owner" as="group">
        {/* Session 134 / spec major gap #6: who's accountable for this
            entity. Free-form string. Feeds the `owner` column of the
            risk-register CSV export and gives readers a quick "ask
            this person" anchor without forcing a formal user model. */}
        <TextInput
          value={entity.owner ?? ''}
          placeholder="Person / role accountable for this entity. Optional."
          ariaLabel="Owner"
          onChange={(next) => {
            updateEntity(entityId, { owner: next || undefined });
          }}
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
          onClick={() => updateEntity(entityId, { lastValidatedAt: Date.now() })}
          className="mt-1 self-start"
        >
          {entity.lastValidatedAt === undefined ? 'Mark validated' : 'Re-validate (now)'}
        </Button>
      </Field>

      {/* Session 134 / spec major gap #6 (structured half) — first-class
          evidence list. Lives beneath the Owner field block since the
          two are conceptually paired ("who's accountable" + "what
          they're standing on"). Defaults: hidden chevron means the
          section is always expanded — the row count in the field label
          tells the user at a glance whether there's anything to read. */}
      <EvidenceList entityId={entityId} evidence={entity.evidence} ownerHint={entity.owner} />

      {/* `as="group"` — body is itself a `<label>` (checkbox + text);
          nesting it inside another `<label>` would be invalid. */}
      <Field label="Unspecified placeholder" as="group">
        <label className="flex items-start gap-2 text-neutral-600 text-xs dark:text-neutral-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={entity.unspecified === true}
            disabled={locked}
            onChange={(e) =>
              updateEntity(entityId, { unspecified: e.target.checked ? true : undefined })
            }
          />
          <span>
            Mark as an unarticulated placeholder. The entity-existence rule won't fire on an empty
            title, and the node renders with a help-circle glyph. Useful when you know there's a
            precondition / cause / condition here but can't yet name it.
          </span>
        </label>
      </Field>

      <Field label="Locus" as="group">
        {/*
          TOC-reading (CRT Step 7): "have you built down to causes you
          actually control or influence?" The three-value flag captures the
          distinction the book makes between things we can act on directly,
          things we can affect indirectly, and things we can only observe.
          A small soft CLR nudge (`external-root-cause`) fires when a
          rootCause is flagged `external` — those are rarely the real root.
        */}
        <div className="grid grid-cols-4 gap-1.5 text-xs">
          {(
            [
              { id: undefined, label: 'Unset' },
              { id: 'control', label: 'Control' },
              { id: 'influence', label: 'Influence' },
              { id: 'external', label: 'External' },
            ] as const
          ).map((opt) => {
            const selected = (entity.spanOfControl ?? null) === (opt.id ?? null);
            return (
              <button
                key={opt.label}
                type="button"
                disabled={locked}
                onClick={() => updateEntity(entityId, { spanOfControl: opt.id })}
                className={clsx(
                  TOGGLE_BUTTON_BASE,
                  selected ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* Session 135 / spec gap #4 Phase 1B — entity-state picker +
          propagation-derived state callout. The four buttons set
          `entity.state` (or clear it for "Unknown"); the small
          caption beneath surfaces what the graph itself implies via
          {@link propagateStates}. When the user's claim disagrees
          with propagation, the caption turns amber so the conflict
          reads at a glance. */}
      <Field label="State" as="group">
        {/* Phase 1C — in speculation mode the picker writes to the
            overlay (hypothetical), the highlight reflects the
            speculative value, and a hint reminds the user nothing is
            committed. Outside speculation it edits `entity.state`. */}
        {speculationOverlay !== null && (
          <p className="mb-1.5 text-[11px] text-indigo-700 dark:text-indigo-300">
            Speculating — picking a state explores the cascade without saving.
          </p>
        )}
        <div data-component="entity-state-picker" className="grid grid-cols-4 gap-1.5 text-xs">
          {(
            [
              { id: undefined, label: 'Unknown' },
              { id: 'true', label: 'True' },
              { id: 'false', label: 'False' },
              { id: 'disputed', label: 'Disputed' },
            ] as const
          ).map((opt) => {
            const speculating = speculationOverlay !== null;
            // In speculation mode the highlight tracks the overlay
            // value (falling back to the manual state if no override
            // is set for this entity yet); otherwise it tracks the
            // persisted manual state. Persisted `'unknown'` is treated
            // as "no claim" so the "Unknown" button highlights for both
            // `undefined` and the explicit `'unknown'` value.
            const overlayVal = speculating ? speculationOverlay[entityId] : undefined;
            const base = overlayVal ?? entity.state;
            const current: EntityState | undefined = base === 'unknown' ? undefined : base;
            const selected = (current ?? null) === (opt.id ?? null);
            return (
              <button
                key={opt.label}
                type="button"
                disabled={locked && !speculating}
                onClick={() => {
                  const next = opt.id as EntityState | undefined;
                  if (speculating) {
                    setSpeculativeState(entityId, next);
                  } else {
                    updateEntity(entityId, { state: next });
                  }
                }}
                className={clsx(
                  TOGGLE_BUTTON_BASE,
                  selected ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {(() => {
          // Surface propagation only when the graph has something
          // meaningful to say. Hide when:
          //   - derived is `'unknown'` AND the user hasn't claimed
          //     anything either (nothing to report).
          //   - derived === manual (they agree — uninteresting).
          const derived = derivedStates[entity.id] ?? 'unknown';
          const manual = entity.state;
          const effective = effectiveState(entity, derivedStates);
          if (derived === 'unknown' && manual === undefined) return null;
          if (derived === manual) return null;
          // Conflict: a manual claim disagrees with what propagation
          // computed (and propagation has signal — not 'unknown').
          const conflicts =
            manual !== undefined &&
            manual !== 'unknown' &&
            derived !== 'unknown' &&
            derived !== manual;
          return (
            <p
              className={clsx(
                'mt-1.5 text-[11px]',
                conflicts
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-neutral-600 dark:text-neutral-400'
              )}
              data-component="entity-state-derived"
              data-conflicts={conflicts ? 'true' : undefined}
            >
              {conflicts ? (
                <>
                  Graph implies <span className="font-semibold">{derived}</span>; your claim is{' '}
                  <span className="font-semibold">{manual}</span>.
                </>
              ) : (
                <>
                  Graph implies <span className="font-semibold">{derived}</span>
                  {manual === undefined ? ' (no manual claim yet).' : '.'}
                </>
              )}
              <span className="sr-only"> Effective state: {effective}.</span>
            </p>
          );
        })()}
      </Field>

      {entity.type === 'assumption' && <AttachedEdgesList assumptionId={entityId} />}

      {diagramType === 'st' && entity.type === 'injection' && (
        <StFacetsSection
          entity={entity}
          locked={locked}
          onSet={(key, value) => setEntityAttribute(entityId, key, { kind: 'string', value })}
          onClear={(key) => removeEntityAttribute(entityId, key)}
        />
      )}

      <EntityAttributesSection entity={entity} />

      <WarningsList warnings={warnings} />

      <Button
        variant="destructive"
        onClick={() => confirmAndDeleteEntity(entityId)}
        className="mt-2"
        disabled={locked}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete entity
      </Button>
    </div>
  );
}

/**
 * Session 76 — first-class S&T 5-facet inputs. Surfaces only on an
 * injection entity inside an `'st'` diagram. The four reserved
 * attribute keys (Strategy, NA, PA, SA) round-trip through JSON via
 * the existing B7 attribute machinery; the tactic itself is the
 * entity's `title`. Filling any of the four facets flips the canvas
 * card into the tall 5-row layout.
 */
function StFacetsSection({
  entity,
  locked,
  onSet,
  onClear,
}: {
  entity: { attributes?: Record<string, { kind: string; value: unknown }> };
  locked: boolean;
  onSet: (key: string, value: string) => void;
  onClear: (key: string) => void;
}) {
  const readFacet = (key: string): string => {
    const v = entity.attributes?.[key];
    return v?.kind === 'string' && typeof v.value === 'string' ? v.value : '';
  };
  const rows: { label: string; key: string; placeholder: string }[] = [
    {
      label: 'Strategy',
      key: ST_FACET_KEYS.strategy,
      placeholder: 'What this tactic achieves (the parent objective).',
    },
    {
      label: 'Necessary Assumption',
      key: ST_FACET_KEYS.necessaryAssumption,
      placeholder: 'Why the strategy itself matters.',
    },
    {
      label: 'Parallel Assumption',
      key: ST_FACET_KEYS.parallelAssumption,
      placeholder: 'Why THIS tactic is the right approach (vs. alternatives).',
    },
    {
      label: 'Sufficiency Assumption',
      key: ST_FACET_KEYS.sufficiencyAssumption,
      placeholder: 'Why the tactic actually achieves the strategy.',
    },
  ];
  return (
    <Field label="S&T facets" as="group">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Goldratt's S&T pattern: the entity title is the <b>tactic</b>. Fill in the four companion
          facets to render the node as a first-class S&T card.
        </p>
        {rows.map((row) => {
          const value = readFacet(row.key);
          const fieldId = `st-facet-${row.key}`;
          return (
            <div key={row.key} className="flex flex-col gap-0.5 text-xs">
              <label htmlFor={fieldId} className="text-neutral-600 dark:text-neutral-300">
                {row.label}
              </label>
              <TextArea
                id={fieldId}
                value={value}
                rows={2}
                placeholder={row.placeholder}
                disabled={locked}
                onChange={(next) => {
                  if (next === '') onClear(row.key);
                  else onSet(row.key, next);
                }}
                className="text-xs"
              />
            </div>
          );
        })}
      </div>
    </Field>
  );
}
