import { entitiesOfType, incomingEdges } from '../graph';
import type { TPDocument } from '../types';
import { makeWarning, type UntieredWarning } from './shared';

/**
 * Goal-Tree structural rules (improvement review — Goal Tree previously had no
 * connectivity/count validators beyond the single-apex nudge). A Goal Tree
 * decomposes **Goal → Critical Success Factors → Necessary Conditions**; edges
 * read `NC → CSF → goal` (a child points *into* its parent — see the
 * `add-nc-child` command, `connect(nc.id, parent.id)`). Both rules are pure
 * graph queries mirroring the shipped CRT rules (`crt-ude-count`, the
 * rollup/no-upstream shape).
 */

/**
 * A Critical Success Factor with no Necessary Conditions beneath it — a CSF is
 * "make-or-break" and should decompose into the conditions that satisfy it.
 * Fires on CSFs with no incoming edge from a `necessaryCondition`.
 */
export const goalTreeCsfNoNcsRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const out: UntieredWarning[] = [];
  for (const csf of entitiesOfType(doc, 'criticalSuccessFactor')) {
    const hasNc = incomingEdges(doc, csf.id).some(
      (e) => doc.entities[e.sourceId]?.type === 'necessaryCondition'
    );
    if (!hasNc) {
      out.push(
        makeWarning(
          doc,
          'goalTree-csf-no-ncs',
          { kind: 'entity', id: csf.id },
          'This Critical Success Factor has no Necessary Conditions beneath it — add the conditions that must hold for it.'
        )
      );
    }
  }
  return out;
};

const MIN_CSF = 3;
const MAX_CSF = 5;

/**
 * Goal-Tree CSF-count scope guard (analogue of `crt-ude-count`). Dettmer's
 * pattern is typically 3–5 Critical Success Factors — the small set of
 * make-or-break conditions between the Goal and its Necessary Conditions.
 * Targets the document (the count is a property of the tree). Silent below one
 * CSF so a brand-new Goal Tree isn't nagged.
 */
export const goalTreeCsfCountRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'goalTree') return [];
  const count = entitiesOfType(doc, 'criticalSuccessFactor').length;
  if (count === 0) return [];
  if (count < MIN_CSF) {
    return [
      makeWarning(
        doc,
        'goalTree-csf-count',
        { kind: 'document' },
        `This Goal Tree has ${count} Critical Success Factor${count === 1 ? '' : 's'} — Dettmer's pattern is typically ${MIN_CSF}–${MAX_CSF}; you may be missing some make-or-break conditions.`
      ),
    ];
  }
  if (count > MAX_CSF) {
    return [
      makeWarning(
        doc,
        'goalTree-csf-count',
        { kind: 'document' },
        `This Goal Tree has ${count} Critical Success Factors — more than ${MAX_CSF} usually means some are really Necessary Conditions a tier down.`
      ),
    ];
  }
  return [];
};
