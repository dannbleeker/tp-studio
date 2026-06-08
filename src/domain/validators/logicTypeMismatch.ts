import { edgesArray } from '../graph';
import type { DiagramType, EdgeKind, TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Session 179 (Theme C2) — logic-type consistency lint.
 *
 * Each TP tree reads in one primary logic: **sufficiency** ("X exists,
 * therefore Y" — CRT / FRT / TT / NBR) or **necessity** ("in order to Y, X must
 * hold" — Goal Tree). Wiring an edge of the wrong `kind` into a tree is a
 * classic novice error that Mabin's curriculum flags explicitly. We surface the
 * odd-one-out edge as a gentle clarity nudge.
 *
 * Diagram types whose logic is genuinely mixed or position-based (EC, PRT, S&T,
 * Freeform) are out of scope — they're omitted from the map and the rule
 * no-ops, so it only fires where the expectation is unambiguous.
 */
const PRIMARY_LOGIC: Partial<Record<DiagramType, EdgeKind>> = {
  crt: 'sufficiency',
  frt: 'sufficiency',
  tt: 'sufficiency',
  nbr: 'sufficiency',
  goalTree: 'necessity',
};

const READING: Record<EdgeKind, string> = {
  sufficiency: '"X exists, therefore Y"',
  necessity: '"in order to Y, X must hold"',
};

export const logicTypeMismatchRule = (doc: TPDocument): UntieredWarning[] => {
  const expected = PRIMARY_LOGIC[doc.diagramType];
  if (!expected) return [];
  const out: UntieredWarning[] = [];
  for (const edge of edgesArray(doc)) {
    if (edge.kind !== expected) {
      out.push(
        makeWarning(
          doc,
          'logic-type-mismatch',
          { kind: 'edge', id: edge.id },
          `This diagram reads in ${expected} logic ${READING[expected]}, but this link is typed ${edge.kind} — check that it reads correctly.`
        )
      );
    }
  }
  return out;
};
