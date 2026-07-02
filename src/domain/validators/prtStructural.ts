import { entitiesOfType, incomingEdges, outgoingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Prerequisite-Tree structural rules (improvement review — PRT previously had
 * NO type-specific validators despite a fully-defined structure). The PRT
 * method pairs each **Obstacle** with an **Intermediate Objective** that removes
 * it on the way to the goal; edges read `IO → obstacle → goal` (an IO points
 * *into* the obstacle it overcomes — see the `add-io-for-obstacle` command,
 * `connect(io.id, obstacle.id)`). Both rules are pure graph queries mirroring
 * the shipped CRT/NBR structural rules.
 */

/**
 * An Obstacle with no Intermediate Objective overcoming it — the PRT is
 * incomplete until every obstacle has a plan to remove it. Fires on obstacles
 * with no incoming edge from an `intermediateObjective`.
 */
export const prtObstacleNoIoRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'prt') return [];
  const out: UntieredWarning[] = [];
  for (const obstacle of entitiesOfType(doc, 'obstacle')) {
    const hasIo = incomingEdges(doc, obstacle.id).some(
      (e) => doc.entities[e.sourceId]?.type === 'intermediateObjective'
    );
    if (!hasIo) {
      out.push(
        makeWarning(
          doc,
          'prt-obstacle-no-io',
          { kind: 'entity', id: obstacle.id },
          'This obstacle has no Intermediate Objective overcoming it — add the IO that removes it on the way to the goal.'
        )
      );
    }
  }
  return out;
};

/**
 * The symmetric check: an Intermediate Objective that doesn't overcome any
 * obstacle. Fires on IOs with no outgoing edge to an `obstacle`.
 */
export const prtIoNoObstacleRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'prt') return [];
  const out: UntieredWarning[] = [];
  for (const io of entitiesOfType(doc, 'intermediateObjective')) {
    const overcomesObstacle = outgoingEdges(doc, io.id).some(
      (e) => doc.entities[e.targetId]?.type === 'obstacle'
    );
    if (!overcomesObstacle) {
      out.push(
        makeWarning(
          doc,
          'prt-io-no-obstacle',
          { kind: 'entity', id: io.id },
          'This Intermediate Objective doesn’t overcome any obstacle — connect it to the obstacle it removes.'
        )
      );
    }
  }
  return out;
};
