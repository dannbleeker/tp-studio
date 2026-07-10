import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Alcohol availability (Current Reality Tree).
 *
 * A public-policy CRT paraphrased from Mabin & Cavana's open-access New
 * Zealand supermarket-alcohol case study (System Dynamics Review 40(4),
 * 2024, CC BY-NC-ND) — one of the few fully published, node-complete
 * Thinking-Process analyses, and a demonstration that the tools work
 * outside business settings. Node text here is an original paraphrase of
 * the case's logic, not the paper's figure text.
 */
export const buildPatternCRTAlcoholAvailability = (): TPDocument => {
  const t = Date.now();

  const rcLaw = buildEntity('rootCause', 'Everyday grocery stores may sell alcohol', t, 1);
  const rcRivalry = buildEntity(
    'rootCause',
    'Retail rivalry rewards using cheap alcohol to pull shoppers in',
    t,
    2
  );
  const effNormalised = buildEntity(
    'effect',
    'Alcohol sits cheap and normalised beside the weekly shop',
    t,
    3
  );
  const effConsumption = buildEntity('effect', 'Population-level consumption stays high', t, 4);
  const udeHarm = buildEntity(
    'ude',
    'Alcohol-related harm — illness, injuries, violence — stays high',
    t,
    5
  );
  const udeCost = buildEntity(
    'ude',
    'The cost of harm lands on the health and justice systems',
    t,
    6
  );

  const entities = [rcLaw, rcRivalry, effNormalised, effConsumption, udeHarm, udeCost];

  const andNorm = nanoid(8);

  const edges: Edge[] = [
    // Legal availability AND retail rivalry jointly normalise cheap alcohol.
    buildEdge(rcLaw.id, effNormalised.id, { andGroupId: andNorm }),
    buildEdge(rcRivalry.id, effNormalised.id, { andGroupId: andNorm }),
    // Normalised cheap alcohol keeps population-level consumption high.
    buildEdge(effNormalised.id, effConsumption.id),
    // High consumption keeps harm high, and harm lands on public systems.
    buildEdge(effConsumption.id, udeHarm.id),
    buildEdge(udeHarm.id, udeCost.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Alcohol-availability policy CRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
