import { newDocumentId, newEntityId } from './ids';
import type { Entity, TPDocument } from './types';

/**
 * Session 198 (backlog C) — spawn a fresh Future Reality Tree from a Current
 * Reality Tree by "inverting" its undesirable effects. Each UDE becomes a
 * desired-effect seed (titled "Reverse: <UDE>", for the user to rewrite to the
 * positive form), plus one starter injection at the bottom. The book move
 * (Goldratt-Ashlag, Handbook Ch. 20 Layer 4): a solution tree's desired effects
 * are the mirror image of the problem tree's undesirable effects.
 *
 * Pure + UNLINKED: it reads the source and returns a brand-new document with a
 * fresh id; it never mutates the CRT and creates no cross-doc link, so the CRT
 * stays fully usable standalone. The caller routes the result through
 * `openDocInTab`, opening it in a new tab beside the CRT.
 */
export const spawnFRTFromCrt = (sourceDoc: TPDocument): TPDocument => {
  const t = Date.now();
  const udes = Object.values(sourceDoc.entities).filter((e) => e.type === 'ude');

  let ann = 0;
  const entities: Entity[] = [];

  // One desired-effect seed per UDE, laid out in two columns near the top.
  udes.forEach((ude, i) => {
    ann += 1;
    entities.push({
      id: newEntityId(),
      type: 'desiredEffect',
      title: `Reverse: ${ude.title.trim() || 'undesirable effect'}`,
      annotationNumber: ann,
      createdAt: t,
      updatedAt: t,
      position: { x: 120 + (i % 2) * 340, y: 80 + Math.floor(i / 2) * 140 },
    });
  });

  // A starter injection below the desired effects — the change to build toward.
  ann += 1;
  entities.push({
    id: newEntityId(),
    type: 'injection',
    title: 'Injection — the change that turns these effects around',
    annotationNumber: ann,
    createdAt: t,
    updatedAt: t,
    position: { x: 290, y: 80 + Math.ceil(Math.max(udes.length, 1) / 2) * 140 + 80 },
  });

  const titlePrefix = (sourceDoc.title || 'CRT').slice(0, 40);
  return {
    id: newDocumentId(),
    diagramType: 'frt',
    title: `FRT from "${titlePrefix}"`,
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
