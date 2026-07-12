import type { Entity } from '@/domain/types';
import { CollapsibleSection } from './CollapsibleSection';

/**
 * Session 198 (backlog F) — the Six Success Criteria checklist for an injection
 * (Handbook Ch. 15 Table 15-4, Barnard; Ch. 34). A quick quality gate on a
 * proposed solution: is it excellent, win-win-win, low-risk, simpler, fast to
 * give feedback, and non-self-destructing? Each criterion round-trips as a
 * reserved boolean entity attribute, so there is no schema change; unchecked
 * criteria are omitted from the map. Shown on `injection` entities.
 */
export const SIX_CRITERIA: ReadonlyArray<{ key: string; label: string; hint: string }> = [
  {
    key: 'sc-excellent',
    label: 'Excellent',
    hint: 'Genuinely solves the core problem, not a symptom.',
  },
  {
    key: 'sc-win-win-win',
    label: 'Win-win-win',
    hint: 'Every affected party comes out ahead — no one is quietly worse off.',
  },
  {
    key: 'sc-low-risk',
    label: 'Low-risk',
    hint: 'Few negative branches, and the ones there are can be trimmed.',
  },
  {
    key: 'sc-simpler',
    label: 'Simpler',
    hint: 'Removes complexity rather than adding a new moving part.',
  },
  {
    key: 'sc-fast-feedback',
    label: 'Fast feedback',
    hint: 'Gives an early, cheap signal that it is working.',
  },
  {
    key: 'sc-self-sustaining',
    label: "Won't self-destruct",
    hint: 'Does not erode the very conditions it depends on.',
  },
];

const checked = (entity: Entity, key: string): boolean => {
  const a = entity.attributes?.[key];
  return a?.kind === 'bool' && a.value === true;
};

export function SixCriteriaSection({
  entity,
  locked,
  onSet,
  onClear,
}: {
  entity: Entity;
  locked: boolean;
  onSet: (key: string) => void;
  onClear: (key: string) => void;
}) {
  const done = SIX_CRITERIA.filter((c) => checked(entity, c.key)).length;
  return (
    <CollapsibleSection
      id="six-criteria"
      title={`Six success criteria (${done}/6)`}
      defaultOpen={done > 0}
    >
      <p className="text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
        A quality gate on this injection (Handbook Ch. 15). A good solution clears all six.
      </p>
      <div className="flex flex-col gap-1.5">
        {SIX_CRITERIA.map((c) => {
          const isChecked = checked(entity, c.key);
          return (
            <label
              key={c.key}
              className="flex items-start gap-2 text-neutral-700 text-xs dark:text-neutral-200"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={isChecked}
                disabled={locked}
                aria-label={c.label}
                onChange={() => (isChecked ? onClear(c.key) : onSet(c.key))}
              />
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="text-neutral-500 dark:text-neutral-400"> — {c.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}
