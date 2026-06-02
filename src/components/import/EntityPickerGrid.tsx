import clsx from 'clsx';
import { useMemo, useState } from 'react';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { isNonCausal } from '@/domain/graph';
import type { CustomEntityClass, Entity } from '@/domain/types';
import { TextInput } from '../settings/formPrimitives';
import { CARD_FOCUS } from '../ui/focusClasses';

/**
 * The causally-meaningful entities of a source doc (notes + assumptions dropped
 * via `isNonCausal`), sorted by annotation number. Exported so a dialog's
 * subtitle count and the grid agree on the same set.
 */
export const causalEntities = (entities: Record<string, Entity>): Entity[] =>
  Object.values(entities)
    .filter((e) => !isNonCausal(e))
    .sort((a, b) => a.annotationNumber - b.annotationNumber);

type EntityPickerGridProps = {
  /** Source entities to pick from (the picker dialog's open/parsed doc). */
  entities: Record<string, Entity>;
  /** The source doc's custom entity classes, for type-meta resolution. */
  customClasses?: Record<string, CustomEntityClass> | undefined;
  onPick: (entity: Entity) => void;
  /** Shown when the source has no causally-meaningful entities at all. */
  emptyLabel: string;
  /** aria-label for the results list. */
  gridAriaLabel: string;
  /** Verb prefixing each card's accessible name, e.g. "Import" / "Link to". */
  cardActionVerb: string;
  /** `data-component` stamped on each card button (inspection / test hook). */
  cardDataComponent: string;
};

/**
 * Shared entity-picker grid — a filterable, annotation-number-sorted list of a
 * source doc's causally-meaningful entities, each a clickable card showing the
 * type stripe, label, annotation number, title, and description. Used by both
 * `ImportEntityPickerDialog` (copy-with-traceability) and `LinkEntityPickerDialog`
 * (cross-tab link); only the verb / data hook / empty copy / pick action differ.
 * Purely presentational — the parent owns the dialog chrome and what happens on
 * pick. Owns its own filter state, which resets when the parent dialog (and thus
 * this grid) unmounts on close.
 */
export function EntityPickerGrid({
  entities,
  customClasses,
  onPick,
  emptyLabel,
  gridAriaLabel,
  cardActionVerb,
  cardDataComponent,
}: EntityPickerGridProps) {
  const [filter, setFilter] = useState('');
  const candidates = useMemo(() => causalEntities(entities), [entities]);
  const visible = useMemo<Entity[]>(() => {
    if (filter.trim().length === 0) return candidates;
    const q = filter.trim().toLowerCase();
    return candidates.filter((e) => e.title.toLowerCase().includes(q));
  }, [candidates, filter]);

  return (
    <>
      <div className="mb-3 flex flex-col gap-2">
        <TextInput
          value={filter}
          onChange={setFilter}
          placeholder="Filter by title…"
          ariaLabel="Filter entities by title"
        />
      </div>

      {visible.length === 0 ? (
        <p className="px-1 py-6 text-center text-neutral-500 text-sm dark:text-neutral-400">
          {candidates.length === 0 ? emptyLabel : `No entities match "${filter}".`}
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
          aria-label={gridAriaLabel}
        >
          {visible.map((entity) => {
            const meta = resolveEntityTypeMeta(entity.type, customClasses);
            return (
              <li key={entity.id}>
                <button
                  type="button"
                  data-component={cardDataComponent}
                  onClick={() => onPick(entity)}
                  aria-label={`${cardActionVerb} ${entity.title || 'untitled entity'} (${meta.label})`}
                  className={clsx(
                    'group flex h-full w-full flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                    'hover:border-indigo-400 hover:bg-indigo-50/40',
                    CARD_FOCUS,
                    'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-1 shrink-0 rounded-sm"
                      style={{ backgroundColor: meta.stripeColor }}
                      aria-hidden
                    />
                    <span className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                      {meta.label}
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500">
                      #{entity.annotationNumber}
                    </span>
                  </span>
                  <span className="line-clamp-3 text-neutral-900 text-sm leading-snug dark:text-neutral-100">
                    {entity.title || <span className="text-neutral-400 italic">(untitled)</span>}
                  </span>
                  {entity.description && (
                    <span className="line-clamp-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                      {entity.description}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
