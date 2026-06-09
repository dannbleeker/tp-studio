import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, Entity, TPDocument } from '../types';

/**
 * The TOC critique of cost / Activity-Based-Costing "product costing", as a CRT.
 *
 * Goldratt called cost accounting "the number-one enemy of productivity": the
 * habit of assigning every product a fully-loaded cost (truly-variable cost +
 * an allocated share of fixed overhead — Goldratt's "phantom") and letting that
 * number govern decisions. The paradigm is the root cause (flagged
 * `coreProblem`), and it sprays a field of UDEs — profitable products dropped,
 * good marginal orders rejected, cost-plus mispricing, inventory built to
 * "absorb" overhead, capex that adds no throughput, and net profit stalling
 * while the local efficiency metrics look healthy.
 *
 * ABC inherits the same root cause: it refines the allocation drivers but still
 * spreads fixed cost onto products as if it were per-unit-variable. The paired
 * conflict is the `ec-cost-vs-throughput` cloud (control cost vs grow profit) —
 * spawn it from the core-problem entity via the U-Shape "Create the Core Cloud"
 * command.
 */
export const buildPatternCRTCostAccounting = (): TPDocument => {
  const t = Date.now();

  // The policy/paradigm root cause — flagged as the core problem so the U-Shape
  // "Create the Core Cloud…" flow can spawn the paired Cost-vs-Throughput cloud.
  const rc: Entity = {
    ...buildEntity(
      'rootCause',
      'Products carry a fully-loaded cost (TVC + allocated fixed overhead)',
      t,
      1
    ),
    coreProblem: true,
  };
  const ic1 = buildEntity('effect', 'Fixed overhead is allocated to products per unit', t, 2);
  const ic2 = buildEntity('effect', 'Managers are judged on local efficiency', t, 3);
  const prof = buildEntity('effect', 'Profitability = price − fully-loaded cost', t, 4);
  const ude1 = buildEntity('ude', 'Profitable products are dropped, weak ones kept', t, 5);
  const ude2 = buildEntity('ude', "Good marginal orders are rejected as 'below cost'", t, 6);
  const ude3 = buildEntity('ude', 'Prices are set cost-plus on a phantom cost', t, 7);
  const batch = buildEntity('effect', 'Large batches are run to absorb overhead', t, 8);
  const ude4 = buildEntity('ude', 'WIP piles up; cash is trapped in inventory', t, 9);
  const ude5 = buildEntity('ude', 'Capex adds capacity that yields no throughput', t, 10);
  const ude6 = buildEntity('ude', 'Net profit stalls while local metrics look healthy', t, 11);

  const entities = [rc, ic1, ic2, prof, ude1, ude2, ude3, batch, ude4, ude5, ude6];
  const edges: Edge[] = [
    buildEdge(rc.id, ic1.id),
    buildEdge(rc.id, ic2.id),
    buildEdge(ic1.id, prof.id),
    buildEdge(prof.id, ude1.id),
    buildEdge(prof.id, ude2.id),
    buildEdge(prof.id, ude3.id),
    buildEdge(ic2.id, batch.id),
    buildEdge(batch.id, ude4.id),
    buildEdge(batch.id, ude5.id),
    buildEdge(ude1.id, ude6.id),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: 'Cost-accounting / product-costing trap',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 12,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
