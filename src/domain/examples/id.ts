import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';
import { buildEdge, buildEntity } from './shared';

/**
 * Example Interference Diagram — the constraint-exploitation case from
 * Sproull & Nelson, *Epiphanized* (App. 4): "More throughput from the XYZ
 * machine."
 *
 * The shape is a hub and two rings:
 *
 *   - a central `goal` — the objective you want more of;
 *   - a ring of `obstacle` interferences that steal time from it, each wired
 *     INWARD (`interference → objective`) so the radial layout keeps the
 *     objective at the hub;
 *   - a paired `intermediateObjective` per interference on the outer ring
 *     (`IO → interference`) — the injection that removes it.
 *
 * The arrows are non-logical intuition arrows (they say "this blocks that",
 * not sufficiency/necessity), so the default edge kind is cosmetic here — the
 * radial router draws them as arcs and no causal CLR rule runs on an ID.
 *
 * Per-interference time/impact values (the Pareto input) are added when the
 * impact inspector control lands; this builder stays structural for now.
 */
export const buildExampleID = (): TPDocument => {
  const t = Date.now();

  // The central objective (the hub).
  const objective = buildEntity('goal', 'More throughput from the XYZ machine', t, 1);

  // Interferences (ring 1) and their paired intermediate objectives (ring 2).
  const intfParts = buildEntity('obstacle', 'Parts are not available to work', t, 2);
  const ioParts = buildEntity(
    'intermediateObjective',
    'Parts are kitted and ready at the machine',
    t,
    3
  );

  const intfFindParts = buildEntity('obstacle', 'Operator has to find their own parts', t, 4);
  const ioFindParts = buildEntity(
    'intermediateObjective',
    'Parts are delivered to the operator',
    t,
    5
  );

  const intfBreaks = buildEntity('obstacle', 'Machine idles during breaks and lunch', t, 6);
  const ioBreaks = buildEntity('intermediateObjective', 'An alternate crew covers breaks', t, 7);

  const intfBroken = buildEntity('obstacle', 'The machine breaks down', t, 8);
  const ioBroken = buildEntity(
    'intermediateObjective',
    'Preventive maintenance (priority #1)',
    t,
    9
  );

  const entities = [
    objective,
    intfParts,
    ioParts,
    intfFindParts,
    ioFindParts,
    intfBreaks,
    ioBreaks,
    intfBroken,
    ioBroken,
  ];
  const edges: Edge[] = [
    // Interferences point inward at the objective (keeps it centred in radial).
    buildEdge(intfParts.id, objective.id),
    buildEdge(intfFindParts.id, objective.id),
    buildEdge(intfBreaks.id, objective.id),
    buildEdge(intfBroken.id, objective.id),
    // Each intermediate objective points at the interference it removes.
    buildEdge(ioParts.id, intfParts.id),
    buildEdge(ioFindParts.id, intfFindParts.id),
    buildEdge(ioBreaks.id, intfBreaks.id),
    buildEdge(ioBroken.id, intfBroken.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'id',
    title: 'XYZ machine Interference Diagram',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
