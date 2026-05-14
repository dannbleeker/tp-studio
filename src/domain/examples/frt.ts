import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example Future Reality Tree: the "what if we did this?" counterpart to
 * the CRT example. Two injections at the bottom, intermediate effects, and
 * a single desired effect at the top.
 */
export const buildExampleFRT = (): TPDocument => {
  const t = Date.now();

  const injApi = buildEntity('injection', 'Automate order entry via an API integration', t, 1);
  const injHire = buildEntity('injection', 'Hire two more warehouse pickers', t, 2);

  const effAccuracy = buildEntity('effect', 'Order accuracy improves', t, 3);
  const effSpeed = buildEntity('effect', 'Order fulfilment speeds up', t, 4);

  const de = buildEntity('desiredEffect', 'Customer satisfaction improves', t, 5);

  const entities = [injApi, injHire, effAccuracy, effSpeed, de];
  const edges: Edge[] = [
    buildEdge(injApi.id, effAccuracy.id),
    buildEdge(injHire.id, effSpeed.id),
    buildEdge(effAccuracy.id, de.id),
    buildEdge(effSpeed.id, de.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Customer-satisfaction Future Reality Tree (example)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 7,
  };
};
