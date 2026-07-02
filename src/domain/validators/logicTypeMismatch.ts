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
 * EC is necessity too: its support edges are uniformly necessity-typed by
 * design (the v6→v7 migration upgrades them), so a sufficiency-typed EC support
 * edge is the same novice error. The only non-support link in an EC is the
 * D↔D′ mutual-exclusion arrow, which is skipped below. Diagram types whose
 * logic is genuinely mixed or position-based (PRT, S&T, Freeform) stay out of
 * scope — omitted from the map so the rule no-ops there.
 */
const PRIMARY_LOGIC: Partial<Record<DiagramType, EdgeKind>> = {
  crt: 'sufficiency',
  frt: 'sufficiency',
  tt: 'sufficiency',
  nbr: 'sufficiency',
  goalTree: 'necessity',
  ec: 'necessity',
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
    // The EC D↔D′ mutual-exclusion link (and any mutex edge elsewhere) is not a
    // causal support edge, so its `kind` isn't held to the diagram's logic.
    if (edge.isMutualExclusion) continue;
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
