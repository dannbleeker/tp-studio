import { incomingEdges, outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 135 — Strategy & Tactics (S&T) tactic-rollup sufficiency
 * check.
 *
 * Goldratt's S&T pattern: every tactic at a given layer must
 * decompose into child tactics that, taken together, are sufficient
 * for the parent. Semantic sufficiency is a workshop conversation,
 * not a validator's job — but the *structural* prerequisite is
 * checkable: a non-apex `injection` (tactic) that participates in
 * the tree must either have child tactics feeding it OR be
 * explicitly a leaf.
 *
 * The detection: walk every `injection` entity on an S&T diagram.
 * Distinguish three shapes:
 *   - **apex tactic** (the top of the S&T tree): has NO outgoing
 *     edges (no parent tactic). Skip — there's nothing to roll up
 *     into; rollup is the inverse direction.
 *   - **leaf tactic**: has outgoing edges (feeds a parent) but no
 *     incoming edges (no children). Fires the rule — without
 *     children, the structural sufficiency claim is empty.
 *   - **intermediate tactic**: has both incoming and outgoing
 *     edges. Skip — children + parent already form the rollup
 *     chain.
 *
 * Tier: `sufficiency` — matches how the existing `cause-sufficiency`
 * and `complete-step` rules are taxonomised. The question is "are
 * these causes enough on their own?" rather than "do these
 * entities exist?".
 *
 * Resolution paths:
 *   1. Add child tactics underneath (the typical fix on a real
 *      planning effort).
 *   2. Convert the entity type if the slot was misclassified
 *      (e.g. it's actually an `action`, not an `injection`).
 *   3. Dismiss the warning if the leaf framing is intentional
 *      (some leaves genuinely don't need further decomposition).
 *
 * Runs only on S&T diagrams via the per-diagram registry in
 * `validators/index.ts`.
 */
export const stTacticRollupRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  for (const e of Object.values(doc.entities)) {
    if (e.type !== 'injection') continue;
    // Skip unspecified placeholders — same logic as the
    // tt-action-locus rule. The user hasn't articulated the slot
    // yet; demanding rollup structure is premature.
    if (e.unspecified === true) continue;

    const outgoing = outgoingEdges(doc, e.id);
    const incoming = incomingEdges(doc, e.id);

    // Apex tactic — no parent. The rollup question doesn't apply.
    if (outgoing.length === 0) continue;
    // Has children → structural sufficiency at least exists.
    if (incoming.length > 0) continue;

    out.push(
      makeWarning(
        doc,
        'st-tactic-rollup',
        { kind: 'entity', id: e.id },
        'Tactic has a parent but no child tactics — every non-leaf tactic should decompose into sufficient sub-tactics, or be intentionally a leaf.'
      )
    );
  }
  return out;
};
