import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * System archetype — "Limits to Growth" (Senge), as an FRT.
 *
 * Investing in the growth engine accelerates growth, but success consumes a
 * limiting resource that pushes back and slows further growth — a **balancing**
 * (B) loop wrapped around the reinforcing engine. The loop arc (limit → growth)
 * carries `weight: 'negative'`, so the polarity product is −1 → the B badge, and
 * the FRT loop-polarity nudge fires ("a balancing loop means the injection may
 * be self-limiting — intended?") — which is exactly this archetype's lesson:
 * break it with an injection that lifts the limit, not one that drives growth.
 */
export const buildPatternFRTLimitsToGrowth = (): TPDocument => {
  const t = Date.now();

  const invest = buildEntity('injection', 'Invest in the growth engine', t, 1);
  const growth = buildEntity('desiredEffect', 'Growth accelerates', t, 2);
  const limit = buildEntity('effect', 'Success consumes a limiting resource', t, 3);

  const entities = [invest, growth, limit];
  const edges: Edge[] = [
    buildEdge(invest.id, growth.id),
    buildEdge(growth.id, limit.id),
    // Balancing loop arc — the consumed limit slows growth (counter-causal).
    { ...buildEdge(limit.id, growth.id), isBackEdge: true, weight: 'negative' },
  ];

  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: 'Limits to Growth (system archetype)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 4,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
