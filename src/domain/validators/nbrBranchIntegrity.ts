import { isOfBuiltin } from '../entityTypeMeta';
import { entitiesOfType, incomingEdges, outgoingEdges, reachableForward } from '../graph';
import type { Entity, TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 181 — NBR shape rules (closes the "NBR validator gap" flag).
 *
 * The canonical Negative Branch Reservation walks: candidate injection →
 * forward chain → turning point → UDEs (the method checklist teaches exactly
 * this, and the risk-register export structurally assumes it — its mitigation
 * inference BFSes injection → UDE). Until now nothing validated that shape:
 * NBR borrowed the FRT rule set wholesale and was the only typed diagram with
 * zero diagram-specific rules. These two cover the structurally-verifiable
 * halves; the judgment steps (turning point, reactive-vs-proactive mitigation,
 * adopt/modify/reject) stay with the checklist — a rule there would nag during
 * normal use (a mitigation is legitimately absent while you're still deciding).
 *
 * Type matching: injections resolve via `isOfBuiltin` so custom classes with
 * `supersetOf: 'injection'` participate (consistent with the sibling
 * `predicted-effect-existence` rule in the NBR set); UDEs match the plain type
 * (consistent with every CRT UDE rule).
 */

const injectionsOf = (doc: TPDocument): Entity[] =>
  Object.values(doc.entities).filter((e) =>
    isOfBuiltin(e.type, 'injection', doc.customEntityClasses)
  );

/**
 * `nbr-no-negative-branch` — the user has started tracing forward from the
 * candidate injection but hasn't captured a single UDE: the document is still
 * an FRT, not an NBR (and the risk-register export would be empty).
 *
 * Deliberately silent until at least one injection has an outgoing edge, so the
 * nudges sequence instead of stacking: a lone injection with no trace already
 * gets `predicted-effect-existence` ("what follows?"); this rule takes over
 * once the trace exists but the branch doesn't. Anchors on the earliest
 * injection — `WarningTarget` has no document-level kind (same workaround as
 * `crt-ude-count`).
 */
export const nbrNoNegativeBranchRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'nbr') return [];
  if (entitiesOfType(doc, 'ude').length > 0) return [];
  const tracing = injectionsOf(doc)
    .filter((inj) => outgoingEdges(doc, inj.id).length > 0)
    .sort((a, b) => a.annotationNumber - b.annotationNumber);
  const anchor = tracing[0];
  if (!anchor) return [];
  return [
    makeWarning(
      doc,
      'nbr-no-negative-branch',
      { kind: 'entity', id: anchor.id },
      'No undesirable effect captured yet — trace the injection forward to where the chain turns negative ("yes, but…"). Without a UDE this still reads as an FRT.'
    ),
  ];
};

/**
 * `nbr-ude-disconnected` — a UDE that is wired into the graph but doesn't
 * trace back to any injection. The negative branch must originate at the
 * candidate injection, or the UDE can't inform the adopt / modify / reject
 * decision (and the risk register shows it as a permanently-open risk with no
 * mitigation, since its mitigation inference is reachability-based).
 *
 * Two deliberate scoping calls:
 *   - A UDE with NO incoming edges is skipped — `additional-cause` already
 *     fires "no causes captured" there; double-warning the same gap is noise.
 *   - Silent when the doc has no injection at all — per-UDE nags about an
 *     absent entity would repeat one problem N times mid-sketch; checklist
 *     step 1 ("state the candidate injection") owns that moment.
 */
export const nbrUdeDisconnectedRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'nbr') return [];
  const injections = injectionsOf(doc);
  if (injections.length === 0) return [];
  const reachable = reachableForward(
    doc,
    injections.map((inj) => inj.id)
  );
  const out: UntieredWarning[] = [];
  for (const ude of entitiesOfType(doc, 'ude')) {
    if (incomingEdges(doc, ude.id).length === 0) continue;
    if (reachable.has(ude.id)) continue;
    out.push(
      makeWarning(
        doc,
        'nbr-ude-disconnected',
        { kind: 'entity', id: ude.id },
        `UDE "${ude.title || '(untitled)'}" doesn't trace back to the candidate injection — connect the chain (injection → … → UDE) or it can't inform the adopt / modify / reject call.`
      )
    );
  }
  return out;
};
