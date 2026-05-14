import { nanoid } from 'nanoid';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example Current Reality Tree: customer-satisfaction problem with a small
 * AND-group at the "wrong items ship" effect. Showcases the canonical CRT
 * shape — root causes at the bottom feeding effects feeding a single UDE
 * at the top — plus the AND-group feature.
 */
export const buildExampleCRT = (): TPDocument => {
  const t = Date.now();

  const rcManual = buildEntity('rootCause', 'Order entry is manual', t, 1);
  const rcUnderstaffed = buildEntity('rootCause', 'Warehouse is understaffed', t, 2);
  const rcBug = buildEntity('rootCause', 'Shipping label generator has a known bug', t, 3);

  const effMistakes = buildEntity('effect', 'Wrong items ship to customers', t, 4);
  const effSlow = buildEntity('effect', 'Order fulfilment is slow', t, 5);

  const ude = buildEntity('ude', 'Customer satisfaction is declining', t, 6);

  const entities = [rcManual, rcUnderstaffed, rcBug, effMistakes, effSlow, ude];
  const andGroupId = nanoid(8);
  const edges: Edge[] = [
    buildEdge(rcManual.id, effMistakes.id, andGroupId),
    buildEdge(rcBug.id, effMistakes.id, andGroupId),
    buildEdge(rcUnderstaffed.id, effSlow.id),
    buildEdge(effMistakes.id, ude.id),
    buildEdge(effSlow.id, ude.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Customer-satisfaction Current Reality Tree (example)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 7,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 7,
  };
};
