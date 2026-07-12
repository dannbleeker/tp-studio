import { buildEntity } from '../examples/shared';
import { newDocumentId } from '../ids';
import type { TPDocument } from '../types';

/**
 * Pattern: Buffered to-do list (Freeform).
 *
 * The personal buffer-management board from the *TOC Handbook* (Ch. 38, "TOC
 * for Personal Productivity/Dilemmas", Cox & Schleier), abstracted: the day's
 * tasks sorted into three time buffers — red (do now, fixed and can't slip),
 * yellow (later today, important but not urgent), and green (optional). As red
 * clears, or Murphy strikes, the next yellow is pulled up. It applies TOC's own
 * buffer vocabulary to daily planning, and is the library's first Freeform
 * pattern — a board, not a causal graph, so no CLR rules apply. Each card
 * carries a rough time estimate. Node text is original.
 */
export const buildPatternFreeformBufferedTodo = (): TPDocument => {
  const t = Date.now();

  const noteRed = buildEntity('note', 'RED — do now (next 1–2 h): fixed, can’t slip', t, 1, {
    position: { x: 40, y: 40 },
  });
  const taskR1 = buildEntity('effect', 'Prep for the 10:00 review (30 min)', t, 2, {
    position: { x: 40, y: 150 },
  });
  const taskR2 = buildEntity('effect', "Unblock a teammate's pull request (10 min)", t, 3, {
    position: { x: 40, y: 230 },
  });

  const noteYellow = buildEntity('note', 'YELLOW — later today: important, not urgent', t, 4, {
    position: { x: 380, y: 40 },
  });
  const taskY1 = buildEntity('effect', 'Draft the proposal section (45 min)', t, 5, {
    position: { x: 380, y: 150 },
  });
  const taskY2 = buildEntity('effect', 'Work through the design feedback (30 min)', t, 6, {
    position: { x: 380, y: 230 },
  });

  const noteGreen = buildEntity('note', 'GREEN — end of day / optional: nice-to-have', t, 7, {
    position: { x: 720, y: 40 },
  });
  const taskG1 = buildEntity('effect', 'Tidy the backlog (15 min)', t, 8, {
    position: { x: 720, y: 150 },
  });
  const taskG2 = buildEntity('effect', 'Read the industry newsletter (10 min)', t, 9, {
    position: { x: 720, y: 230 },
  });

  const noteRule = buildEntity(
    'note',
    'Buffer rule: as red clears — or Murphy strikes — pull the next yellow up into red.',
    t,
    10,
    { position: { x: 380, y: 340 } }
  );

  const entities = [
    noteRed,
    taskR1,
    taskR2,
    noteYellow,
    taskY1,
    taskY2,
    noteGreen,
    taskG1,
    taskG2,
    noteRule,
  ];

  return {
    id: newDocumentId(),
    diagramType: 'freeform',
    title: 'Buffered to-do list',
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: {},
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 11,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 10,
  };
};
