import { interferenceImpact } from '@/domain/interference';
import type { Entity } from '@/domain/types';
import { TextInput } from '../settings/formPrimitives';
import { Field } from './Field';

/**
 * Time/impact control for an interference (an `obstacle` on an Interference
 * Diagram). Reads/writes the reserved `id-impact` integer attribute — whole
 * units of time the interference steals (minutes per day or per week, kept
 * consistent within a diagram). This is the Pareto input: the ranking readout
 * sorts interferences by this value. Empty clears the attribute.
 *
 * Presentational only — the parent wires `onSet` / `onClear` to the store's
 * `setEntityAttribute` / `removeEntityAttribute`, mirroring `SixCriteriaSection`.
 */
export function InterferenceMetricSection({
  entity,
  locked,
  onSet,
  onClear,
}: {
  entity: Entity;
  locked: boolean;
  onSet: (minutes: number) => void;
  onClear: () => void;
}) {
  const current = interferenceImpact(entity);
  return (
    <Field label="Time lost">
      <div className="flex items-center gap-2">
        <TextInput
          type="number"
          className="w-24"
          value={current?.toString() ?? ''}
          placeholder="—"
          disabled={locked}
          aria-label="Time this interference steals"
          onChange={(raw) => {
            if (raw === '') {
              onClear();
              return;
            }
            const n = Number.parseInt(raw, 10);
            // Non-negative whole units only; ignore garbage (e.g. "-" mid-type).
            if (Number.isFinite(n) && n >= 0) onSet(n);
          }}
        />
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          time it steals (e.g. minutes/day) — ranks the interferences
        </span>
      </div>
    </Field>
  );
}
