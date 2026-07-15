import type { Entity } from './types';

/**
 * Reserved entity-attribute key holding an interference's time/impact magnitude
 * on an Interference Diagram. Stored as an `int` {@link AttrValue} — whole units
 * of time the interference steals (minutes per day or per week, kept consistent
 * within a diagram). It rides the generic `attributes` map rather than a
 * first-class `Entity` field: the metric is ID-specific and optional, so a
 * reserved key keeps the schema unchanged (the `SixCriteriaSection` /
 * `StFacetsSection` precedent).
 *
 * Single source of truth — the inspector writes it, the Pareto ranking reads it.
 */
export const INTERFERENCE_IMPACT_KEY = 'id-impact';

/**
 * An interference's impact magnitude, or `undefined` when it's unset (or the
 * stored attribute is the wrong kind — defensive against hand-edited JSON).
 */
export const interferenceImpact = (entity: Entity): number | undefined => {
  const a = entity.attributes?.[INTERFERENCE_IMPACT_KEY];
  return a?.kind === 'int' ? a.value : undefined;
};
