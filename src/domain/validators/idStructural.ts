import { entitiesOfType, incomingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Interference-Diagram structural rules. The ID carries no sufficiency/necessity
 * logic — its arrows are intuition — so these are the only ID-specific
 * reservations, and both are soft structural checks (no causal CLR applies).
 *
 * Edge convention (matches PRT and the ID example builder): an intermediate
 * objective points INTO the interference it removes (`IO → interference`), and
 * the interference points at the central objective (`interference → objective`).
 */

/**
 * An interference (an `obstacle`) with no paired Intermediate Objective — the
 * analysis isn't actionable until every interference has a fix. Fires on
 * obstacles with no incoming edge from an `intermediateObjective` (the same
 * query as the PRT obstacle↔IO rule, gated to the ID).
 */
export const idInterferenceNoIoRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'id') return [];
  const out: UntieredWarning[] = [];
  for (const interference of entitiesOfType(doc, 'obstacle')) {
    const hasIo = incomingEdges(doc, interference.id).some(
      (e) => doc.entities[e.sourceId]?.type === 'intermediateObjective'
    );
    if (!hasIo) {
      out.push(
        makeWarning(
          doc,
          'id-interference-no-io',
          { kind: 'entity', id: interference.id },
          'This interference has no paired intermediate objective — add the injection that removes or reduces it.'
        )
      );
    }
  }
  return out;
};

/**
 * More than one central objective on a single Interference Diagram. The ID is a
 * hub-and-spoke around ONE objective; a second `goal` means two analyses share a
 * canvas. Soft `clarity` nudge, anchored on the DOCUMENT (the count is a
 * property of the diagram, not any one goal — so the warning id stays stable
 * when a goal is deleted / re-typed). Silent at 0 or 1, matching the Goal-Tree
 * multi-goal and CRT UDE-count precedents.
 */
export const idMultipleCentralObjectivesRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'id') return [];
  const goals = entitiesOfType(doc, 'goal');
  if (goals.length <= 1) return [];
  return [
    makeWarning(
      doc,
      'id-multiple-central-objectives',
      { kind: 'document' },
      `This Interference Diagram has ${goals.length} central objectives — an ID maps interferences around a single objective. Split the second one into its own diagram.`
    ),
  ];
};
