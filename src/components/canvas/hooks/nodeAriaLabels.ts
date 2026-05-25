import type { EligibilityStatus } from '@/domain/actionEligibility';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import type { CustomEntityClass, Entity, EntityState, Group } from '@/domain/types';

/**
 * Session 135 — accessible names for the canvas.
 *
 * React Flow's node wrapper (`.react-flow__node`) is the focusable
 * element a keyboard / screen-reader user lands on. It supports an
 * `ariaLabel` prop on each emitted node; without one, the announced
 * name is the empty string and the canvas reads as silent rectangles.
 *
 * These pure helpers compose a single readable string per node kind
 * from the same data the visual badges already encode: title + type +
 * locus + step + state (incl. speculative) + eligibility for entities;
 * title + member count (+ collapsed / archived modifiers) for groups.
 *
 * Kept pure (no React, no store) so unit tests can pin the exact
 * announcement shape — assistive tech consistency is part of the
 * contract.
 */

const STATE_PHRASE: Record<Exclude<EntityState, 'unknown'>, string> = {
  true: 'state true',
  false: 'state false',
  disputed: 'state disputed',
};

const ELIGIBILITY_PHRASE: Record<Exclude<EligibilityStatus, 'na'>, string> = {
  eligible: 'eligible',
  blocked: 'blocked',
  pending: 'pending preconditions',
};

export type EntityAriaOpts = {
  customClasses?: Record<string, CustomEntityClass>;
  /** Effective state (post-propagation + speculation overlay) — omit
   *  to skip the state phrase. `'unknown'` also skipped. */
  effectiveState?: EntityState;
  /** Phase 1C speculation flag — appended to the state phrase. */
  speculated?: boolean;
  /** Action-eligibility status (Action nodes only) — `'na'` skipped. */
  eligibility?: Exclude<EligibilityStatus, 'na'>;
};

export const entityAriaLabel = (entity: Entity, opts: EntityAriaOpts = {}): string => {
  const meta = resolveEntityTypeMeta(entity.type, opts.customClasses);
  const parts: string[] = [`${meta.label}: ${entity.title || 'untitled'}`];
  if (typeof entity.ordering === 'number') parts.push(`step ${entity.ordering}`);
  if (entity.spanOfControl) parts.push(`locus ${entity.spanOfControl}`);
  if (opts.effectiveState && opts.effectiveState !== 'unknown') {
    const phrase = STATE_PHRASE[opts.effectiveState];
    parts.push(opts.speculated ? `${phrase} (speculative)` : phrase);
  }
  if (opts.eligibility) parts.push(`action ${ELIGIBILITY_PHRASE[opts.eligibility]}`);
  return parts.join(', ');
};

const pluralEntities = (n: number): string => `${n} entit${n === 1 ? 'y' : 'ies'}`;
const pluralAssumptions = (n: number): string => `${n} assumption${n === 1 ? '' : 's'}`;

/** Visible group rectangle — title + transitive entity count + modifiers. */
export const groupAriaLabel = (group: Group, memberCount: number): string => {
  const head = `Group: ${group.title || 'untitled'} (${pluralEntities(memberCount)})`;
  const modifiers: string[] = [];
  if (group.collapsed) modifiers.push('collapsed');
  if (group.archived) modifiers.push('archived');
  return modifiers.length ? `${head}, ${modifiers.join(', ')}` : head;
};

/** Collapsed-root card — one node standing in for an entire group's contents. */
export const collapsedGroupAriaLabel = (group: Group, memberCount: number): string =>
  `Collapsed group: ${group.title || 'untitled'} (${pluralEntities(memberCount)} hidden)`;

export type EdgeAriaOpts = {
  sourceTitle: string;
  targetTitle: string;
  /** When >1, this is a synthetic edge representing N aggregated real
   *  edges across a collapsed-group boundary. */
  aggregateCount?: number;
  isBackEdge?: boolean;
  isMutex?: boolean;
  /** First-class + legacy assumption count (already deduped in emission). */
  assumptionCount?: number;
};

export const edgeAriaLabel = (opts: EdgeAriaOpts): string => {
  const src = opts.sourceTitle || 'untitled';
  const tgt = opts.targetTitle || 'untitled';
  if (opts.aggregateCount && opts.aggregateCount > 1) {
    return `${opts.aggregateCount} aggregated edges from ${src} to ${tgt}`;
  }
  const parts = [`Edge from ${src} to ${tgt}`];
  if (opts.isBackEdge) parts.push('back-edge');
  if (opts.isMutex) parts.push('mutually exclusive');
  if (opts.assumptionCount && opts.assumptionCount > 0) {
    parts.push(pluralAssumptions(opts.assumptionCount));
  }
  return parts.join(', ');
};
