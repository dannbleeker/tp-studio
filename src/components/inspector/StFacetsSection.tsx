import { ST_FACET_KEYS } from '@/domain/graph';
import { TextArea } from '../settings/formPrimitives';
import { Field } from './Field';

/**
 * Session 76 — first-class S&T 5-facet inputs. Surfaces only on an
 * injection entity inside an `'st'` diagram. The four reserved
 * attribute keys (Strategy, NA, PA, SA) round-trip through JSON via
 * the existing B7 attribute machinery; the tactic itself is the
 * entity's `title`. Filling any of the four facets flips the canvas
 * card into the tall 5-row layout.
 *
 * Extracted verbatim from `EntityInspector.tsx` (Session 169 structural tier).
 */
export function StFacetsSection({
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
