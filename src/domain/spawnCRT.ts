import { newDocumentId, newEntityId } from './ids';
import type { Entity, TPDocument } from './types';

/**
 * Session 198 (backlog C) — spawn a fresh Current Reality Tree from a Goal Tree
 * by benchmarking its standards. Each Critical Success Factor / Necessary
 * Condition becomes a candidate undesirable effect titled "<standard> is not
 * met" — the shortfall you'd diagnose (Dettmer, Handbook Ch. 19 Fig 19-10: a
 * Goal Tree defines the standard; a CRT explains why reality falls short of it).
 *
 * Pure + UNLINKED: reads the source and returns a brand-new document with a fresh
 * id; it never mutates the Goal Tree and creates no cross-doc link, so the Goal
 * Tree stays fully usable standalone. The caller routes the result through
 * `openDocInTab`, opening it in a new tab beside the Goal Tree.
 */
export const spawnCRTFromGoalTree = (sourceDoc: TPDocument): TPDocument => {
  const t = Date.now();
  const standards = Object.values(sourceDoc.entities).filter(
    (e) => e.type === 'criticalSuccessFactor' || e.type === 'necessaryCondition'
  );

  let ann = 0;
  const entities: Entity[] = standards.map((standard, i) => {
    ann += 1;
    return {
      id: newEntityId(),
      type: 'ude',
      title: `${standard.title.trim() || 'This condition'} is not met`,
      annotationNumber: ann,
      createdAt: t,
      updatedAt: t,
      position: { x: 120 + (i % 3) * 300, y: 80 + Math.floor(i / 3) * 130 },
    };
  });

  const titlePrefix = (sourceDoc.title || 'Goal Tree').slice(0, 40);
  return {
    id: newDocumentId(),
    diagramType: 'crt',
    title: `CRT from "${titlePrefix}"`,
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: {},
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: ann + 1,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
