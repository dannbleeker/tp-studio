import { incomingEdges, outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * TT-specific Complete-Step structural rule.
 *
 * From the book's TT taxonomy: a Transition Tree "step" is a structural
 * triple — `(Outcome ← Precondition + Action)` — joined at the Outcome via
 * an AND junction. The Action is the do-something; the Precondition is the
 * existing condition or reality that, together with the Action, sufficient-
 * cause-produces the Outcome. A TT that has Actions without paired
 * Preconditions is structurally incomplete: "what's the existing state
 * that lets this Action work?" remains unanswered.
 *
 * Concretely, the rule fires on any Action whose outgoing edges to its
 * target Outcome lack a non-Action sibling. Specifically:
 *
 *   For each `action` entity A:
 *     For each outgoing edge A → T:
 *       Collect T's other structural incoming edges (excluding assumptions).
 *       If none of those siblings is from a non-`action` entity:
 *         Fire the warning, targeting the A → T edge.
 *
 * "A non-`action` sibling" plays the precondition role. We don't require
 * the sibling to be specifically typed as `effect` or `necessaryCondition`
 * because the book's framing is flexible — any condition / state / reality
 * the user models as a non-Action entity counts.
 *
 * Entities flagged `unspecified: true` are valid preconditions even with
 * an empty title — the user is signalling "there's something here, I
 * don't know what yet" rather than forgetting to add a precondition. The
 * rule treats the placeholder as filling the slot. The user resolves the
 * unspecified flag once they've articulated the thing.
 */
export const completeStepRule = (doc: TPDocument): UntieredWarning[] => {
  const out: UntieredWarning[] = [];
  const seenEdgeIds = new Set<string>();

  for (const action of Object.values(doc.entities)) {
    if (action.type !== 'action') continue;
    for (const edge of outgoingEdges(doc, action.id)) {
      if (seenEdgeIds.has(edge.id)) continue;
      const target = doc.entities[edge.targetId];
      if (!target) continue;

      const siblings = incomingEdges(doc, target.id).filter((e) => e.id !== edge.id);
      // Skip if any sibling is from a non-action structural entity (the
      // precondition slot is filled). `unspecified: true` placeholders
      // count — they're deliberate slots, not forgotten ones.
      const hasPrecondition = siblings.some((s) => {
        const src = doc.entities[s.sourceId];
        if (!src) return false;
        if (src.type === 'assumption') return false;
        if (src.type === 'action') return false;
        return true;
      });
      if (hasPrecondition) continue;

      seenEdgeIds.add(edge.id);
      out.push(
        makeWarning(
          doc,
          'complete-step',
          { kind: 'edge', id: edge.id },
          'Action has no precondition — what existing condition lets it produce this outcome?'
        )
      );
    }
  }
  return out;
};
