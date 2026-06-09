import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * System archetype — "Fixes that Fail" (Senge), as a CRT.
 *
 * A quick fix relieves a symptom fast, but it carries an unintended side-effect
 * that feeds back and aggravates the original symptom — a **reinforcing** (R)
 * vicious cycle. The loop is closed by the `isBackEdge` arc from the worsened
 * symptom back to the recurring problem; all edges are default-positive, so the
 * polarity product is +1 → the R badge. The lesson the hint carries: break it by
 * treating the root cause, not the symptom.
 */
export const buildPatternCRTFixesThatFail = (): TPDocument => {
  const t = Date.now();

  // A recurring symptom is an effect-in-a-loop, not a root cause — the archetype
  // is a self-sustaining cycle with no external root below it.
  const symptom = buildEntity('effect', 'A recurring symptom keeps coming back', t, 1);
  const fix = buildEntity('effect', 'A quick fix relieves the symptom fast', t, 2);
  const side = buildEntity('effect', 'The quick fix creates an unintended side-effect', t, 3);
  const worse = buildEntity('ude', 'The side-effect aggravates the original symptom', t, 4);

  const entities = [symptom, fix, side, worse];
  const edges: Edge[] = [
    buildEdge(symptom.id, fix.id),
    buildEdge(fix.id, side.id),
    buildEdge(side.id, worse.id),
    // Loop arc — the feedback that makes the fix fail. Reinforcing (no negatives).
    { ...buildEdge(worse.id, symptom.id), isBackEdge: true },
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Fixes that Fail (system archetype)',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 5,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
