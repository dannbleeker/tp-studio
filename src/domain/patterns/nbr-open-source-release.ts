import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Open-source release (Negative Branch Reservation).
 *
 * A go-to-market NBR. The injection ("open-source the core engine
 * under a permissive license") has a clear desired effect — the
 * project becomes the de-facto standard inside its niche, and
 * inbound interest grows from developers who can run it without
 * talking to sales. The negative branch is the load that arrives
 * with that visibility: support requests from non-paying users,
 * security issues filed publicly, and the recurring "why did you
 * change the license?" conversation that the project may not have
 * planned for.
 *
 * The mitigation is structural: ship the engine permissively but
 * carve out clear paid surfaces (managed hosting, enterprise
 * support, premium features) so the visibility benefit lands
 * without the support-load branch driving away the contributors
 * the project meant to attract.
 */
export const buildPatternNBROpenSourceRelease = (): TPDocument => {
  const t = Date.now();

  const injOriginal = buildEntity(
    'injection',
    'Open-source the core engine under a permissive license with the same feature set as the paid product',
    t,
    1
  );

  const effVisibility = buildEntity(
    'effect',
    'Developer inbound triples in the first three months after release',
    t,
    2
  );
  const deAdoption = buildEntity(
    'desiredEffect',
    'The project becomes the recognised standard inside its category',
    t,
    3
  );

  const effSupportLoad = buildEntity(
    'effect',
    'GitHub issues from non-customers reach 30+ per week',
    t,
    4
  );
  const effSecurityDisclosure = buildEntity(
    'effect',
    'Security researchers file vulnerabilities publicly rather than via the customer security channel',
    t,
    5
  );

  const udeMaintainerBurnout = buildEntity(
    'ude',
    'Maintainer team spends ≥30% of time answering questions instead of building',
    t,
    6
  );
  const udeRevenueDilution = buildEntity(
    'ude',
    'Enterprise pipeline slows because prospects use the OSS version indefinitely',
    t,
    7
  );

  const injMitigation = buildEntity(
    'injection',
    'Open-source the engine but reserve managed hosting + enterprise SLAs as paid surfaces, with a published security disclosure policy',
    t,
    8
  );

  const entities = [
    injOriginal,
    effVisibility,
    deAdoption,
    effSupportLoad,
    effSecurityDisclosure,
    udeMaintainerBurnout,
    udeRevenueDilution,
    injMitigation,
  ];
  const edges: Edge[] = [
    buildEdge(injOriginal.id, effVisibility.id),
    buildEdge(effVisibility.id, deAdoption.id),
    buildEdge(injOriginal.id, effSupportLoad.id),
    buildEdge(injOriginal.id, effSecurityDisclosure.id),
    buildEdge(effSupportLoad.id, udeMaintainerBurnout.id),
    buildEdge(effSecurityDisclosure.id, udeMaintainerBurnout.id),
    buildEdge(effVisibility.id, udeRevenueDilution.id),
    buildEdge(injMitigation.id, deAdoption.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'nbr',
    title: 'Open-source release NBR',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 9,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
