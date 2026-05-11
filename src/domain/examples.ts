import { nanoid } from 'nanoid';
import type { Edge, Entity, EntityType, TPDocument } from './types';

const buildEntity = (type: EntityType, title: string, t: number): Entity => ({
  id: nanoid(),
  type,
  title,
  createdAt: t,
  updatedAt: t,
});

const buildEdge = (sourceId: string, targetId: string, andGroupId?: string): Edge => ({
  id: nanoid(),
  sourceId,
  targetId,
  kind: 'sufficiency',
  ...(andGroupId ? { andGroupId } : {}),
});

export const buildExampleCRT = (): TPDocument => {
  const t = Date.now();

  const rcManual = buildEntity('rootCause', 'Order entry is manual', t);
  const rcUnderstaffed = buildEntity('rootCause', 'Warehouse is understaffed', t);
  const rcBug = buildEntity('rootCause', 'Shipping label generator has a known bug', t);

  const effMistakes = buildEntity('effect', 'Wrong items ship to customers', t);
  const effSlow = buildEntity('effect', 'Order fulfilment is slow', t);

  const ude = buildEntity('ude', 'Customer satisfaction is declining', t);

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
    id: nanoid(),
    diagramType: 'crt',
    title: 'Customer-satisfaction CRT (example)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    resolvedWarnings: {},
    createdAt: t,
    updatedAt: t,
    schemaVersion: 1,
  };
};

export const buildExampleFRT = (): TPDocument => {
  const t = Date.now();

  const injApi = buildEntity('injection', 'Automate order entry via an API integration', t);
  const injHire = buildEntity('injection', 'Hire two more warehouse pickers', t);

  const effAccuracy = buildEntity('effect', 'Order accuracy improves', t);
  const effSpeed = buildEntity('effect', 'Order fulfilment speeds up', t);

  const de = buildEntity('desiredEffect', 'Customer satisfaction improves', t);

  const entities = [injApi, injHire, effAccuracy, effSpeed, de];
  const edges: Edge[] = [
    buildEdge(injApi.id, effAccuracy.id),
    buildEdge(injHire.id, effSpeed.id),
    buildEdge(effAccuracy.id, de.id),
    buildEdge(effSpeed.id, de.id),
  ];

  return {
    id: nanoid(),
    diagramType: 'frt',
    title: 'Customer-satisfaction FRT (example)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    resolvedWarnings: {},
    createdAt: t,
    updatedAt: t,
    schemaVersion: 1,
  };
};
