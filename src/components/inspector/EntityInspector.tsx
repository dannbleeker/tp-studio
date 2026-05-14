import { paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { ST_FACET_KEYS } from '@/domain/graph';
import type { EntityType, Warning } from '@/domain/types';
import { useEntity } from '@/hooks/useSelected';
import { confirmAndDeleteEntity } from '@/services/confirmations';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { AttachedEdgesList } from './AttachedEdgesList';
import { EntityAttributesSection } from './AttributesSection';
import { Field } from './Field';
import { MarkdownField } from './MarkdownField';
import { WarningsList } from './WarningsList';

export function EntityInspector({
  entityId,
  warnings,
}: {
  entityId: string;
  warnings: Warning[];
}) {
  const entity = useEntity(entityId);
  const doc = useDocumentStore((s) => s.doc);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const setEntityAttribute = useDocumentStore((s) => s.setEntityAttribute);
  const removeEntityAttribute = useDocumentStore((s) => s.removeEntityAttribute);
  const locked = useDocumentStore((s) => s.browseLocked);

  if (!entity) return null;

  // B10: palette merges built-ins with the doc's custom entity classes.
  const availableTypes = paletteForDoc(doc);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Title">
        <textarea
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          rows={3}
          value={entity.title}
          onChange={(e) => updateEntity(entityId, { title: e.target.value })}
          disabled={locked}
        />
      </Field>

      <Field label="Type">
        <div className="grid grid-cols-2 gap-1.5">
          {availableTypes.map((type) => {
            const meta = resolveEntityTypeMeta(type, doc.customEntityClasses);
            const selected = entity.type === type;
            return (
              <button
                key={type}
                type="button"
                disabled={locked}
                onClick={() => updateEntity(entityId, { type: type as EntityType })}
                className={clsx(
                  'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition disabled:cursor-not-allowed disabled:opacity-60',
                  selected
                    ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40'
                    : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
                )}
              >
                <span
                  className="h-3 w-1 shrink-0 rounded"
                  style={{ backgroundColor: meta.stripeColor }}
                />
                <span className="truncate text-neutral-700 dark:text-neutral-200">
                  {meta.label}
                </span>
              </button>
            );
          })}
        </div>
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

      <Field label="Title size">
        <div className="grid grid-cols-3 gap-1.5">
          {(['sm', 'md', 'lg'] as const).map((size) => {
            const active = (entity.titleSize ?? 'md') === size;
            const label = size === 'sm' ? 'Compact' : size === 'md' ? 'Regular' : 'Large';
            return (
              <button
                key={size}
                type="button"
                disabled={locked}
                onClick={() =>
                  updateEntity(entityId, { titleSize: size === 'md' ? undefined : size })
                }
                className={clsx(
                  'rounded-md border px-2 py-1.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60',
                  active
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {entity.type === 'action' && (
        <Field label="Step #">
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            className="w-24 rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            value={entity.ordering ?? ''}
            placeholder="—"
            disabled={locked}
            onChange={(e) => {
              const raw = e.target.value;
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

      <Field label="Attestation">
        <textarea
          // E6: optional source / evidence citation for the entity — "where
          // did this come from?" Free text rather than a structured field
          // because real sources don't fit one shape (URL, doc page, person,
          // interview date, internal report). The field's purpose is
          // *visible provenance*, not searchable metadata; the inspector is
          // the only consumer today.
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-700 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
          rows={2}
          value={entity.attestation ?? ''}
          placeholder="Source or evidence — URL, document, interview, etc. Optional."
          onChange={(e) => updateEntity(entityId, { attestation: e.target.value || undefined })}
          disabled={locked}
        />
      </Field>

      <Field label="Unspecified placeholder">
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

      <Field label="Span of control">
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
                className={`rounded-md border px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  selected
                    ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Field>

      {entity.type === 'assumption' && <AttachedEdgesList assumptionId={entityId} />}

      {doc.diagramType === 'st' && entity.type === 'injection' && (
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
    <Field label="S&T facets">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Goldratt's S&T pattern: the entity title is the <b>tactic</b>. Fill in the four companion
          facets to render the node as a first-class S&T card.
        </p>
        {rows.map((row) => {
          const value = readFacet(row.key);
          return (
            <label key={row.key} className="flex flex-col gap-0.5 text-xs">
              <span className="text-neutral-600 dark:text-neutral-300">{row.label}</span>
              <textarea
                value={value}
                rows={2}
                placeholder={row.placeholder}
                disabled={locked}
                onChange={(e) => {
                  const next = e.target.value;
                  if (next === '') onClear(row.key);
                  else onSet(row.key, next);
                }}
                className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
              />
            </label>
          );
        })}
      </div>
    </Field>
  );
}
