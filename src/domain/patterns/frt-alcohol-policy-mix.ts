import { nanoid } from 'nanoid';
import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Alcohol policy mix (Future Reality Tree).
 *
 * The future-reality branch of Mabin & Cavana's New Zealand case (System
 * Dynamics Review 40(4), 2024), paraphrased: the primary injection moves
 * supermarket alcohol into a separate store the retailer may run nearby, and
 * four supporting policy levers — taxes, minimum prices, purchase limits,
 * harm warnings — take the pressure off consumption, so harm falls without
 * wrecking retail. Node text is an original paraphrase.
 */
export const buildPatternFRTAlcoholPolicyMix = (): TPDocument => {
  const t = Date.now();

  const injStore = buildEntity(
    'injection',
    'Move supermarket alcohol into a separate store the retailer may run nearby',
    t,
    1
  );
  const injLevers = buildEntity(
    'injection',
    'Back it with higher alcohol taxes, minimum prices, purchase limits, and stronger harm warnings',
    t,
    2
  );

  const effRoute = buildEntity(
    'effect',
    'Alcohol leaves the grocery aisles but retailers keep a lawful sales route',
    t,
    3
  );
  const effLevers = buildEntity(
    'effect',
    'Price and availability no longer favour heavy consumption',
    t,
    4
  );

  const deConsumption = buildEntity(
    'desiredEffect',
    'Consumption drifts down without a retail backlash',
    t,
    5
  );
  const deWellbeing = buildEntity(
    'desiredEffect',
    'Alcohol-related harm falls and national wellbeing rises',
    t,
    6
  );

  const entities = [injStore, injLevers, effRoute, effLevers, deConsumption, deWellbeing];

  const andDown = nanoid(8);

  const edges: Edge[] = [
    // Each injection produces its immediate effect.
    buildEdge(injStore.id, effRoute.id),
    buildEdge(injLevers.id, effLevers.id),
    // Lawful route AND corrected price/availability jointly bring consumption down.
    buildEdge(effRoute.id, deConsumption.id, { andGroupId: andDown }),
    buildEdge(effLevers.id, deConsumption.id, { andGroupId: andDown }),
    // Lower consumption lifts wellbeing.
    buildEdge(deConsumption.id, deWellbeing.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Alcohol policy-mix FRT',
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
