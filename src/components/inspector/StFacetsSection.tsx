import { ST_FACET_KEYS } from '@/domain/graph';
import { TextArea } from '../settings/formPrimitives';
import { Field } from './Field';

/**
 * Session 76 — first-class S&T (Strategy & Tactics) facet inputs; Session 198
 * (backlog B) — directional, plain-language. Surfaces only on an injection entity
 * inside an `'st'` diagram. Each step declares three assumptions, each with a
 * DIRECTION (Handbook Ch. 34, Ferguson):
 *   - **Necessary** — why the step is needed (points up to its parent).
 *   - **Parallel** — why this tactic is the right way to reach the strategy.
 *   - **Sufficiency** — why the step needs sub-steps (points down to its children).
 * The entity's `title` is the tactic; the four reserved attribute keys
 * (`ST_FACET_KEYS`) round-trip through JSON via the B7 attribute machinery.
 *
 * Extracted from `EntityInspector.tsx` (Session 169 structural tier).
 */
export function StFacetsSection({
  entity,
  locked,
  onSet,
  onClear,
}: {
  entity: { title?: string; attributes?: Record<string, { kind: string; value: unknown }> };
  locked: boolean;
  onSet: (key: string, value: string) => void;
  onClear: (key: string) => void;
}) {
  const readFacet = (key: string): string => {
    const v = entity.attributes?.[key];
    return v?.kind === 'string' && typeof v.value === 'string' ? v.value : '';
  };

  // Directional order top-to-bottom, matching the canvas card:
  // Necessary (up) · Strategy · Parallel · Sufficiency (down).
  const rows: { label: string; key: string; placeholder: string }[] = [
    {
      label: 'Necessary Assumption',
      key: ST_FACET_KEYS.necessaryAssumption,
      placeholder: 'Why this step is needed — what makes it a must for the level above.',
    },
    {
      label: 'Strategy',
      key: ST_FACET_KEYS.strategy,
      placeholder: 'The outcome this step achieves (what, not how).',
    },
    {
      label: 'Parallel Assumption',
      key: ST_FACET_KEYS.parallelAssumption,
      placeholder: 'Why THIS tactic is the right way to reach the strategy (vs. alternatives).',
    },
    {
      label: 'Sufficiency Assumption',
      key: ST_FACET_KEYS.sufficiencyAssumption,
      placeholder: "Why this step isn't enough alone — what its sub-steps must add.",
    },
  ];

  // Directional read-aloud, built only from the facets that are filled.
  const tactic = entity.title?.trim() || 'this tactic';
  const strat = readFacet(ST_FACET_KEYS.strategy).trim();
  const na = readFacet(ST_FACET_KEYS.necessaryAssumption).trim();
  const pa = readFacet(ST_FACET_KEYS.parallelAssumption).trim();
  const sa = readFacet(ST_FACET_KEYS.sufficiencyAssumption).trim();
  const readAloud: string[] = [];
  if (strat)
    readAloud.push(`In order to ${strat}, we do "${tactic}"${pa ? `, because ${pa}` : ''}.`);
  else if (pa) readAloud.push(`We do "${tactic}", because ${pa}.`);
  if (na) readAloud.push(`This step is necessary because ${na}.`);
  if (sa) readAloud.push(`It is not enough on its own — ${sa} — so it needs sub-steps.`);

  return (
    <Field label="S&T facets" as="group">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          The entity title is the <b>tactic</b>. Each assumption has a direction: <b>necessary</b>{' '}
          justifies the step up to its parent, <b>parallel</b> bridges the strategy and the tactic,
          and <b>sufficiency</b> justifies the step down to its sub-steps.
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
        {readAloud.length > 0 && (
          <p
            data-component="st-read-aloud"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-600 leading-snug italic dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300"
          >
            Read it aloud: {readAloud.join(' ')}
          </p>
        )}
      </div>
    </Field>
  );
}
