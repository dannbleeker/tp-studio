import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Fabrication-shop strategic Goal Tree.
 *
 * Dettmer's worked strategic Intermediate Objectives Map from the *TOC
 * Handbook* (Ch. 19, "Strategy"), abstracted to any metal-fabrication shop: the
 * goal of higher profitability now and in the future decomposes into four
 * critical success factors — a competitive edge the market values, reliable
 * delivery, consistent quality, and healthy cash/margins — each resting on the
 * constraint-management necessary conditions Dettmer highlights (protective
 * capacity, buffer-driven release, quality at the source, constraint-focused
 * spending). Demonstrates a valid four-CSF tree, at the upper end of Dettmer's
 * 3–5 band. Node text is original; no company names.
 */
export const buildPatternGoalTreeFabricationShop = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity('goal', 'The shop is more profitable, now and in the future', t, 1);

  const csfEdge = buildEntity(
    'criticalSuccessFactor',
    'The shop holds a competitive edge its market genuinely values',
    t,
    2
  );
  const csfDelivery = buildEntity(
    'criticalSuccessFactor',
    'Orders are delivered reliably and on time',
    t,
    3
  );
  const csfQuality = buildEntity(
    'criticalSuccessFactor',
    'Product quality is consistent, with few defects',
    t,
    4
  );
  const csfCash = buildEntity('criticalSuccessFactor', 'Cash and margins stay healthy', t, 5);

  const ncCompete = buildEntity(
    'necessaryCondition',
    "The shop competes on reliability and lead-time rivals can't easily copy, not on price",
    t,
    6
  );
  const ncProtective = buildEntity(
    'necessaryCondition',
    'Protective capacity is kept at non-constraints so the constraint never starves',
    t,
    7
  );
  const ncBuffer = buildEntity(
    'necessaryCondition',
    'Work is released and steered by buffer management, not by keeping everyone busy',
    t,
    8
  );
  const ncSource = buildEntity(
    'necessaryCondition',
    'Quality is built in at the source, not inspected in afterward',
    t,
    9
  );
  const ncSpending = buildEntity(
    'necessaryCondition',
    'Spending rises only where it lifts constraint throughput',
    t,
    10
  );

  const entities = [
    goal,
    csfEdge,
    csfDelivery,
    csfQuality,
    csfCash,
    ncCompete,
    ncProtective,
    ncBuffer,
    ncSource,
    ncSpending,
  ];
  const edges: Edge[] = [
    // Four CSFs, each necessary for the goal.
    buildEdge(csfEdge.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfDelivery.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfQuality.id, goal.id, { kind: 'necessity' }),
    buildEdge(csfCash.id, goal.id, { kind: 'necessity' }),
    // Necessary conditions beneath their CSFs.
    buildEdge(ncCompete.id, csfEdge.id, { kind: 'necessity' }),
    buildEdge(ncProtective.id, csfDelivery.id, { kind: 'necessity' }),
    buildEdge(ncBuffer.id, csfDelivery.id, { kind: 'necessity' }),
    buildEdge(ncSource.id, csfQuality.id, { kind: 'necessity' }),
    buildEdge(ncSpending.id, csfCash.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'goalTree',
    title: 'Fabrication-shop strategic Goal Tree',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 11,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
