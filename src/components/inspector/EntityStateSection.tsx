import clsx from 'clsx';
import { effectiveState } from '@/domain/statePropagation';
import type { Entity, EntityId, EntityState } from '@/domain/types';
import {
  SELECTED_BUTTON_CLASS,
  TOGGLE_BUTTON_BASE,
  UNSELECTED_BUTTON_CLASS,
} from '../ui/buttonClasses';
import { Field } from './Field';

/**
 * Session 135 / spec gap #4 Phase 1B — entity-state picker + propagation-derived
 * state callout. The four buttons set `entity.state` (or clear it for "Unknown");
 * the caption beneath surfaces what the graph itself implies via `propagateStates`
 * and turns amber when the user's claim conflicts with it.
 *
 * Phase 1C — in speculation mode the picker writes to the overlay (hypothetical),
 * the highlight reflects the speculative value, and a hint reminds the user
 * nothing is committed. The parent wraps the two writes (`onSetState` /
 * `onSetSpeculative`) so this section stays free of store wiring.
 *
 * Extracted verbatim from `EntityInspector.tsx` (Session 169 structural tier).
 */
export function EntityStateSection({
  entity,
  entityId,
  locked,
  speculationOverlay,
  derivedStates,
  onSetState,
  onSetSpeculative,
}: {
  entity: Entity;
  entityId: string;
  locked: boolean;
  speculationOverlay: Record<string, EntityState> | null;
  derivedStates: Record<EntityId, EntityState>;
  onSetState: (next: EntityState | undefined) => void;
  onSetSpeculative: (next: EntityState | undefined) => void;
}) {
  return (
    <Field label="State" as="group">
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
          // In speculation mode the highlight tracks the overlay value (falling
          // back to the manual state if no override is set for this entity yet);
          // otherwise it tracks the persisted manual state. Persisted `'unknown'`
          // is treated as "no claim" so "Unknown" highlights for both `undefined`
          // and the explicit `'unknown'` value.
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
                if (speculating) onSetSpeculative(next);
                else onSetState(next);
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
        // Surface propagation only when the graph has something meaningful to
        // say. Hide when derived is `'unknown'` and the user hasn't claimed
        // anything either, or when derived === manual (they agree).
        const derived = derivedStates[entity.id] ?? 'unknown';
        const manual = entity.state;
        const effective = effectiveState(entity, derivedStates);
        if (derived === 'unknown' && manual === undefined) return null;
        if (derived === manual) return null;
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
  );
}
