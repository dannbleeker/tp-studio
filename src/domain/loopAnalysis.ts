import { findCycles, outgoingEdges } from './graph';
import type { Edge, TPDocument } from './types';

/**
 * Loop polarity analysis — the System-Dynamics lens on TP feedback loops
 * (Session 179, docs/EXTERNAL_TP_SOURCE_REVIEW.md Theme A).
 *
 * System Dynamics classifies every cycle as **Reinforcing** ("more begets
 * more" — a virtuous cycle in an FRT, a vicious one in a CRT) or **Balancing**
 * (goal-seeking / self-correcting). The classification is the product of the
 * edge polarities around the loop: an even count of `negative` edges → R, an
 * odd count → B. TP Studio already stores polarity on `Edge.weight`, so this is
 * a pure derived read on top of the cached `findCycles` — no new data model.
 */

export type LoopPolarity = 'reinforcing' | 'balancing' | 'unknown';

export type LoopInfo = {
  /** Entity ids in cyclic order — `cycle[i] → cycle[(i+1) % n]`, last → first. */
  cycle: string[];
  /** Edge ids traversed, aligned with `cycle` (one per hop, including the wrap). */
  edgeIds: string[];
  polarity: LoopPolarity;
  /** The loop-closing edge (last entity → first entity) — i.e. the back-edge. */
  closingEdgeId: string | null;
};

/** +1 for positive / unset (the default sufficiency reading), -1 for negative,
 *  0 for an explicit `zero` ("no-effect") edge. */
const weightSign = (edge: Edge): number =>
  edge.weight === 'negative' ? -1 : edge.weight === 'zero' ? 0 : 1;

/**
 * Classify every simple cycle in the doc. A single `zero` edge in a loop makes
 * the product zero → `unknown` (we can't classify a loop with a severed link),
 * as does a cycle whose hops we can't resolve to edges (shouldn't happen for a
 * real cycle, but we degrade gracefully rather than guess).
 */
// WeakMap-cached on `doc.edges` (matching `findCycles`): loop polarity is a
// pure function of the edge topology + per-edge weights, both of which live on
// the edges map. Called from both the loop-polarity validator and
// `useGraphEdgeEmission`, so the cache spares the repeat allocation/walk.
const loopPolarityCache = new WeakMap<TPDocument['edges'], LoopInfo[]>();

export const loopsWithPolarity = (doc: TPDocument): LoopInfo[] => {
  const cached = loopPolarityCache.get(doc.edges);
  if (cached) return cached;
  const out: LoopInfo[] = [];
  for (const cycle of findCycles(doc)) {
    const n = cycle.length;
    if (n === 0) continue;
    const edgeIds: string[] = [];
    let product = 1;
    let resolvable = true;
    for (let i = 0; i < n; i++) {
      const from = cycle[i]!;
      const to = cycle[(i + 1) % n]!;
      // First match is the only match — the store's duplicate-edge guard
      // prevents two edges sharing one source→target pair.
      const edge = outgoingEdges(doc, from).find((e) => e.targetId === to);
      if (!edge) {
        resolvable = false;
        break;
      }
      edgeIds.push(edge.id);
      product *= weightSign(edge);
    }
    let polarity: LoopPolarity;
    if (!resolvable || product === 0) polarity = 'unknown';
    else polarity = product > 0 ? 'reinforcing' : 'balancing';
    out.push({
      cycle,
      edgeIds,
      polarity,
      closingEdgeId: edgeIds.length === n ? (edgeIds[n - 1] ?? null) : null,
    });
  }
  loopPolarityCache.set(doc.edges, out);
  return out;
};
