import { findCycles, outgoingEdges } from '../graph';
import type { Edge, TPDocument } from '../types';
import { type UntieredWarning, makeWarning } from './shared';

/**
 * Cycle CLR rule (E3 — Bucket E extension). CLR is built on sufficiency
 * logic — A causes B causes C — which is intrinsically acyclic. A cycle
 * in the graph means at least one edge isn't the cause/effect relation
 * the user thinks it is (or is the result of a copy/paste or a missed
 * reverse-edge command).
 *
 * Emits one warning per cycle, targeting the edge that closes it (the
 * edge from the last entity in the canonicalized cycle back to the
 * first). Targeting the closing edge rather than the entity gives the
 * user a concrete thing to reverse or delete. If the closing edge can't
 * be found in the doc (shouldn't happen — `findCycles` derived it from
 * the same edge set), the warning falls back to targeting the first
 * entity in the cycle.
 *
 * Back-edge exemption (TOC-reading): when any edge participating in a
 * cycle is explicitly flagged `isBackEdge: true`, the user has
 * acknowledged the loop as intentional (a vicious-circle CRT, a
 * positive reinforcing FRT) and the rule stays silent on that cycle.
 */
export const cycleRule = (doc: TPDocument): UntieredWarning[] => {
  const cycles = findCycles(doc);
  if (cycles.length === 0) return [];

  const out: UntieredWarning[] = [];
  for (const cycle of cycles) {
    const closing = cycle[cycle.length - 1];
    const first = cycle[0];
    if (!closing || !first) continue;
    // Walk every edge in the cycle to find both the closing edge and any
    // back-edge tag along the way. If the user has flagged ANY edge in
    // this cycle as a back-edge, the loop is intentional — skip.
    const cycleEdges: Edge[] = [];
    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      if (!from || !to) continue;
      const edge = outgoingEdges(doc, from).find((e) => e.targetId === to);
      if (edge) cycleEdges.push(edge);
    }
    if (cycleEdges.some((e) => e.isBackEdge === true)) continue;

    const closingEdge = outgoingEdges(doc, closing).find((e) => e.targetId === first);
    const message =
      cycle.length === 2
        ? 'Mutual cause/effect — one of these edges is probably reversed.'
        : `Cycle of ${cycle.length} entities — CLR is built on acyclic sufficiency.`;
    if (closingEdge) {
      out.push(makeWarning(doc, 'cycle', { kind: 'edge', id: closingEdge.id }, message));
    } else {
      out.push(makeWarning(doc, 'cycle', { kind: 'entity', id: first }, message));
    }
  }
  return out;
};
