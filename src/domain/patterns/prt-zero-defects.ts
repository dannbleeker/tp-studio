import { buildEdge, buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { Edge, TPDocument } from '../types';

/**
 * Pattern: Achieve zero-defect manufacturing (Prerequisite Tree).
 *
 * A quality-program PRT pointed at a measurable apex ("ship five
 * consecutive lots at zero customer-reported defects on the critical
 * SKU"). The obstacles are the recurring ones in any quality
 * initiative: a culture that hides bad units, an inspection regime
 * that only catches the obvious failures, a supplier whose
 * incoming materials drift outside spec, and engineering changes
 * that arrive faster than the line can absorb them.
 *
 * The structure mirrors Cox/Boyd's quality-system PRTs: each IO is
 * a measurable, scheduled action rather than an exhortation.
 */
export const buildPatternPRTZeroDefects = (): TPDocument => {
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Ship five consecutive lots of the critical SKU at zero customer-reported defects',
    t,
    1
  );

  const obsHidden = buildEntity(
    'obstacle',
    'Operators scrap defective units quietly to protect line yield numbers',
    t,
    2
  );
  const obsInspection = buildEntity(
    'obstacle',
    'End-of-line inspection only catches the failure modes that show up cosmetically',
    t,
    3
  );
  const obsSupplier = buildEntity(
    'obstacle',
    'Incoming raw material from the secondary supplier drifts outside the spec band',
    t,
    4
  );
  const obsEngChanges = buildEntity(
    'obstacle',
    'Engineering change orders arrive on the line with under two days of notice',
    t,
    5
  );

  const ioHidden = buildEntity(
    'intermediateObjective',
    'Publish line yield separately from quality cost; remove the incentive to hide scrap',
    t,
    6
  );
  const ioInspection = buildEntity(
    'intermediateObjective',
    'Add in-process measurement at the two stations where electrical failures originate',
    t,
    7
  );
  const ioSupplier = buildEntity(
    'intermediateObjective',
    'Require a control chart from the secondary supplier on each shipment, audited monthly',
    t,
    8
  );
  const ioEngChanges = buildEntity(
    'intermediateObjective',
    'Enforce a minimum 10-day notice for any ECO before it reaches the production floor',
    t,
    9
  );

  const entities = [
    goal,
    obsHidden,
    obsInspection,
    obsSupplier,
    obsEngChanges,
    ioHidden,
    ioInspection,
    ioSupplier,
    ioEngChanges,
  ];
  const edges: Edge[] = [
    buildEdge(ioHidden.id, obsHidden.id, { kind: 'necessity' }),
    buildEdge(ioInspection.id, obsInspection.id, { kind: 'necessity' }),
    buildEdge(ioSupplier.id, obsSupplier.id, { kind: 'necessity' }),
    buildEdge(ioEngChanges.id, obsEngChanges.id, { kind: 'necessity' }),
    buildEdge(obsHidden.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsInspection.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsSupplier.id, goal.id, { kind: 'necessity' }),
    buildEdge(obsEngChanges.id, goal.id, { kind: 'necessity' }),
  ];

  return {
    id: newDocumentId(),
    diagramType: 'prt',
    title: 'Zero-defect manufacturing PRT',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 10,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 8,
  };
};
