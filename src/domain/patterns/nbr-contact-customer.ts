import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Contact-the-customer Negative Branch Reservation.
 *
 * The negative branch behind the obvious fix to the fire-fighting cloud
 * ("ec-contact-vs-procedure") from the *TOC Handbook* (Ch. 24, "Daily
 * Management with TOC", Cohen). The injection — let the shipping clerk call the
 * customer directly — gets the order out on time, but it also spawns a branch:
 * the customer is contacted by someone other than their usual account manager,
 * grows unsure who owns their account, and comes to see the team as
 * disorganised. The branch is trimmed by a proactive redesign: allow direct
 * contact only when the account manager is unavailable, and have the clerk
 * reference them by name. A worked EC → NBR handoff (Layer 3 → Layer 4 of the
 * buy-in). Node text is original; no names.
 */
export const buildPatternNBRContactCustomer = (): TPDocument => {
  const t = Date.now();

  // The candidate injection under interrogation.
  const injOriginal = buildEntity(
    'injection',
    'Let the shipping clerk call the customer directly for the missing detail',
    t,
    1
  );

  // Intended positive chain (the FRT half).
  const effDetail = buildEntity(
    'effect',
    "The missing detail arrives without waiting for the account manager's return",
    t,
    2
  );
  const deShip = buildEntity('desiredEffect', 'The order ships correctly and on time', t, 3);

  // The turning point — where the chain heads somewhere bad.
  const effOtherCaller = buildEntity(
    'effect',
    'The customer is contacted by someone other than their usual account manager',
    t,
    4
  );

  // The negative branch.
  const udeConfused = buildEntity(
    'ude',
    'The customer is unsure who actually owns their account',
    t,
    5
  );
  const udeUnprofessional = buildEntity(
    'ude',
    'The customer comes to see the account team as disorganised and unprofessional',
    t,
    6
  );

  // The proactive-redesign mitigation: amend the rule so the branch can't form.
  const injMitigation = buildEntity(
    'injection',
    'Allow direct contact only when the account manager is unavailable, and have the clerk reference them by name',
    t,
    7
  );

  const entities = [
    injOriginal,
    effDetail,
    deShip,
    effOtherCaller,
    udeConfused,
    udeUnprofessional,
    injMitigation,
  ];
  const edges: Edge[] = [
    // Intended positive chain.
    buildEdge(injOriginal.id, effDetail.id),
    buildEdge(effDetail.id, deShip.id),
    // The negative branch.
    buildEdge(injOriginal.id, effOtherCaller.id),
    buildEdge(effOtherCaller.id, udeConfused.id),
    buildEdge(udeConfused.id, udeUnprofessional.id),
    // The mitigation: same on-time ship, no branch.
    buildEdge(injMitigation.id, deShip.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Contact-the-customer Negative Branch Reservation',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 8,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
