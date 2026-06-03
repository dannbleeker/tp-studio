import clsx from 'clsx';
import { Syringe, Target, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { actionEligibility } from '@/domain/actionEligibility';
import { EC_SLOT_GUIDING_QUESTIONS, EC_SLOT_LABEL, type ECSlot } from '@/domain/ecGuiding';
import { paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import type { EntityType, Warning } from '@/domain/types';
import { usePropagatedStates } from '@/hooks/usePropagatedStates';
import { useEntity } from '@/hooks/useSelected';
import { confirmAndDeleteEntity } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { TextArea } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import { ButtonGroup } from '../ui/ButtonGroup';
import {
  SELECTED_BUTTON_CLASS,
  TOGGLE_BUTTON_BASE,
  UNSELECTED_BUTTON_CLASS,
} from '../ui/buttonClasses';
import { InsetCard } from '../ui/InsetCard';
import { ActionFields } from './ActionFields';
import { AttachedEdgesList } from './AttachedEdgesList';
import { EntityLinksSection } from './EntityLinksSection';
import { EntityProvenanceSection } from './EntityProvenanceSection';
import { EntityStateSection } from './EntityStateSection';
// Session 136 — EntityAttributesSection removed (user-custom
// attributes dropped per Dann's usage feedback). The `attributes`
// field on Entity stays in the data model because the S&T 5-facet
// feature uses it for built-in keys (ST_FACET_KEYS); only the
// free-form key/value editor surface is gone.
import { Field } from './Field';
import { MarkdownField } from './MarkdownField';
import { StFacetsSection } from './StFacetsSection';
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
  const diagramType = useDocumentStore((s) => currentDoc(s).diagramType);
  const customEntityClasses = useDocumentStore((s) => currentDoc(s).customEntityClasses);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const setEntityAttribute = useDocumentStore((s) => s.setEntityAttribute);
  const removeEntityAttribute = useDocumentStore((s) => s.removeEntityAttribute);
  // Phase 1C — when a speculation overlay is active, the state picker
  // writes to the overlay (hypothetical) instead of the doc.
  const speculationOverlay = useDocumentStore((s) => s.speculationOverlay);
  const setSpeculativeState = useDocumentStore((s) => s.setSpeculativeState);
  const locked = useDocumentStore((s) => s.browseLocked);
  // Phase 2a — navigable cross-doc links: resolve link targets from the open
  // tabs (`docs`) and jump via switchTab + selectEntity.
  const docs = useDocumentStore((s) => s.docs);
  const switchTab = useDocumentStore((s) => s.switchTab);
  const selectEntity = useDocumentStore((s) => s.selectEntity);
  const unlinkEntity = useDocumentStore((s) => s.unlinkEntity);
  const toggleCoreProblem = useDocumentStore((s) => s.toggleCoreProblem);
  // Phase 3 #3 — open the per-injection "flower" (a read-only composite of its
  // linked desired effects / negative branch / plan).
  const openInjectionFlower = useDocumentStore((s) => s.openInjectionFlower);
  // Session 135 / spec gap #4 Phase 1B — propagated state for the
  // currently selected entity. Computed once per entities/edges
  // snapshot; the lookup against the returned record is O(1).
  const derivedStates = usePropagatedStates();
  // Action-eligibility (medium gap) — for a TT Action, fold its
  // preconditions' effective states into eligible / blocked / pending.
  // `usePropagatedStates` already subscribes to entities + edges, so
  // these two reads don't widen the component's re-render surface.
  const docEntities = useDocumentStore((s) => currentDoc(s).entities);
  const docEdges = useDocumentStore((s) => currentDoc(s).edges);
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

      <ActionFields
        entity={entity}
        locked={locked}
        eligibility={eligibility}
        onUpdate={(patch) => updateEntity(entityId, patch)}
      />

      {/* Phase 2b (U-Shape) — the user's "core problem" marker (the hinge of
          Cohen's U-Shape). A rose chip when set; stays visible read-only under
          Browse Lock, toggles otherwise. "Create the Core Cloud…" (palette)
          spawns its linked cloud. */}
      {(entity.coreProblem || !locked) && (
        <button
          type="button"
          disabled={locked}
          onClick={() => toggleCoreProblem(entity.id)}
          className={clsx(
            'flex w-full items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 font-medium text-xs transition disabled:cursor-default disabled:opacity-80',
            entity.coreProblem
              ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
              : 'border-neutral-200 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800'
          )}
        >
          <Target aria-hidden className="h-3.5 w-3.5" />
          {entity.coreProblem ? 'Core problem — marked' : 'Mark as core problem'}
        </button>
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

      <EntityLinksSection
        entity={entity}
        docs={docs}
        locked={locked}
        onNavigate={(docId, entityId) => {
          switchTab(docId);
          selectEntity(entityId);
        }}
        onUnlink={(link) => unlinkEntity(entity.id, link)}
      />

      {/* Phase 3 #3 — the "Injection Flower". Injection-only, read-only review
          surface (opens a dialog), so it stays enabled under Browse Lock. */}
      {entity.type === 'injection' && (
        <Field label="Injection flower" as="group">
          <Button variant="softNeutral" size="sm" onClick={() => openInjectionFlower(entity.id)}>
            <Syringe className="h-3.5 w-3.5" />
            View the injection flower
          </Button>
        </Field>
      )}

      <EntityProvenanceSection
        entity={entity}
        entityId={entityId}
        locked={locked}
        onUpdate={(patch) => updateEntity(entityId, patch)}
      />

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

      <EntityStateSection
        entity={entity}
        entityId={entityId}
        locked={locked}
        speculationOverlay={speculationOverlay}
        derivedStates={derivedStates}
        onSetState={(next) => updateEntity(entityId, { state: next })}
        onSetSpeculative={(next) => setSpeculativeState(entityId, next)}
      />

      {entity.type === 'assumption' && <AttachedEdgesList assumptionId={entityId} />}

      {diagramType === 'st' && entity.type === 'injection' && (
        <StFacetsSection
          entity={entity}
          locked={locked}
          onSet={(key, value) => setEntityAttribute(entityId, key, { kind: 'string', value })}
          onClear={(key) => removeEntityAttribute(entityId, key)}
        />
      )}

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
