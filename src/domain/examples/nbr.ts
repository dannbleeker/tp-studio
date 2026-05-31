import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Session 134 / spec major gap #5 — example Negative Branch Reservation.
 *
 * Walks the canonical NBR shape:
 *
 *   1. A candidate injection at the bottom (QA gate).
 *   2. Intermediate desirable effect (more careful releases) — the FRT
 *      path the injection was *intended* to enable.
 *   3. The turning-point intermediate effect (release cycle stretches)
 *      where the chain starts heading somewhere bad.
 *   4. One or more UDEs at the top (competitor ships first, lost
 *      customer, eroded morale).
 *   5. A mitigation injection (a counter-injection at the negative
 *      branch's root) that breaks the chain — proactive redesign of
 *      the QA gate into a test-suite investment that doesn't slow
 *      shipping.
 *
 * The story: "We were going to add a QA gate. The FRT says fewer
 * production bugs. The NBR says yes, but also slower releases and a
 * lost competitive edge. So instead, we invest in test-suite
 * hardening — same quality gain, no cycle stretch."
 */
export const buildExampleNBR = (): TPDocument => {
  const t = Date.now();

  // The candidate injection being interrogated.
  const injOriginal = buildEntity('injection', 'Add a 1-week QA gate before every release', t, 1);

  // The intended positive chain (the FRT half).
  const effCareful = buildEntity('effect', 'Releases get more careful review', t, 2);
  const deBugs = buildEntity('desiredEffect', 'Fewer production bugs slip through', t, 3);

  // The turning point — where the chain starts spawning UDEs.
  const effStretch = buildEntity('effect', 'Release cycle stretches by ~1 week', t, 4);

  // The negative branch.
  const udeCompetitor = buildEntity('ude', 'Competitor ships our feature first', t, 5);
  const udeMorale = buildEntity('ude', 'Engineers feel boxed in by review overhead', t, 6);

  // The proactive-redesign mitigation: swap the original injection for
  // a different one that doesn't spawn the branch.
  const injMitigation = buildEntity('injection', 'Harden the automated test suite instead', t, 7);

  const entities = [
    injOriginal,
    effCareful,
    deBugs,
    effStretch,
    udeCompetitor,
    udeMorale,
    injMitigation,
  ];
  const edges: Edge[] = [
    // Intended positive chain
    buildEdge(injOriginal.id, effCareful.id),
    buildEdge(effCareful.id, deBugs.id),
    // The negative branch
    buildEdge(injOriginal.id, effStretch.id),
    buildEdge(effStretch.id, udeCompetitor.id),
    buildEdge(effStretch.id, udeMorale.id),
    // The mitigation: same desired effect, no branch.
    buildEdge(injMitigation.id, deBugs.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'QA gate Negative Branch Reservation',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 8,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 9,
  };
};
