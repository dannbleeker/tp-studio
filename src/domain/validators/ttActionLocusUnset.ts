import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 135 — Transition Tree (TT) action-locus check.
 *
 * The TT method-checklist explicitly tells the practitioner to "test
 * each action against your locus — control / influence / external."
 * Until now the prompt lived in the checklist text but no validator
 * enforced it; an action without a `spanOfControl` set would sail
 * through the CLR sweep even though it's the most consequential
 * field on a TT action.
 *
 * Fires on every `action` entity whose `spanOfControl` is `undefined`.
 * Explicit `'external'` is allowed — sometimes a TT records actions
 * the user has to coordinate with someone outside their direct
 * control, and the framing is intentional. The point of the rule
 * is "is the locus categorised at all?", not "is the locus the
 * right one?".
 *
 * Tier: `clarity` — the rule is about expressive completeness
 * (matching the existing `external-root-cause` pattern's tier
 * choice). A user can resolve the warning by either:
 *   1. Setting the locus on the entity (Inspector → Locus radio).
 *   2. Acknowledging the warning via the existing
 *      `resolvedWarnings` dismissal mechanism.
 *
 * Runs only on TT diagrams via the per-diagram registry in
 * `validators/index.ts`. CRT / FRT / PRT actions (if any user
 * embeds them outside TT) don't fire — the locus discipline is a
 * TT-specific authoring convention per the book.
 */
export const ttActionLocusUnsetRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (e.type !== 'action') continue;
    if (e.spanOfControl !== undefined) continue;
    // Skip unspecified placeholders — the user explicitly marked
    // the entity as "I know there's something here but can't yet
    // articulate it." Demanding a locus on an unarticulated slot
    // would be premature.
    if (e.unspecified === true) continue;
    out.push(
      makeWarning(
        doc,
        'tt-action-locus-unset',
        { kind: 'entity', id: e.id },
        'Action has no locus set — flag it as control / influence / external so the plan reads honestly about authority.'
      )
    );
  }
  return out;
};
