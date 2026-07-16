import { entitiesOfType, incomingEdges } from './graph';
import { interferenceImpact } from './interference';
import type { Entity, TPDocument } from './types';

/**
 * Pareto ranking of an Interference Diagram's interferences by the time/impact
 * each steals — the "focus on the vital few" deliverable an ID exists to
 * produce (Sproull & Nelson, *Epiphanized*, App. 4). This is rank-by-magnitude
 * LOGIC surfaced as an ordered list (mirroring the CRT Core Driver finder), NOT
 * a chart — TP Studio draws diagrams, it doesn't render statistics plots.
 *
 * Every interference is returned (even those with no impact estimate, which sort
 * to the bottom at 0) so the readout also surfaces which ones still need a
 * number. Interferences with an impact set rank first, descending, with
 * annotation number breaking ties for stable display.
 */
export type InterferenceRankItem = {
  entity: Entity;
  /** The `id-impact` magnitude, or 0 when unset. */
  minutes: number;
  /** Share of the total impact across all interferences (0..1); 0 when the total is 0. */
  pctOfTotal: number;
  /** The paired intermediate-objective id (an `IO → interference` edge), if any. */
  pairedIoId: string | undefined;
};

const cache = new WeakMap<TPDocument, InterferenceRankItem[]>();

/**
 * Cached wrapper — pure in `doc`; the ranking command and the CSV exporter both
 * call it. Keyed on the doc reference, so a repeat call on an unchanged doc is
 * O(1) (same contract as `findCoreDrivers`).
 */
export const rankInterferences = (doc: TPDocument): InterferenceRankItem[] => {
  const cached = cache.get(doc);
  if (cached) return cached;
  const result = computeRanking(doc);
  cache.set(doc, result);
  return result;
};

const computeRanking = (doc: TPDocument): InterferenceRankItem[] => {
  if (doc.diagramType !== 'id') return [];
  const interferences = entitiesOfType(doc, 'obstacle');
  if (interferences.length === 0) return [];

  const withMinutes = interferences.map((entity) => ({
    entity,
    minutes: interferenceImpact(entity) ?? 0,
  }));
  const total = withMinutes.reduce((sum, x) => sum + x.minutes, 0);

  const items: InterferenceRankItem[] = withMinutes.map(({ entity, minutes }) => ({
    entity,
    minutes,
    pctOfTotal: total > 0 ? minutes / total : 0,
    // Paired IO: an incoming edge from an intermediateObjective (IO → interference).
    pairedIoId: incomingEdges(doc, entity.id)
      .map((e) => e.sourceId)
      .find((sid) => doc.entities[sid]?.type === 'intermediateObjective'),
  }));

  items.sort((a, b) => {
    if (b.minutes !== a.minutes) return b.minutes - a.minutes;
    return a.entity.annotationNumber - b.entity.annotationNumber;
  });
  return items;
};

/**
 * Whole-number percentages for a ranked list that sum to exactly 100 — the
 * largest-remainder (Hare) method: floor every share, then hand the leftover
 * points to the largest fractional parts.
 *
 * Rounding each row independently drifts: the shipped constraint-exploitation
 * pattern (90/60/45/30/30 = 255) rounds to 35+24+18+12+12 = **101%**. A Pareto
 * sheet whose column doesn't add up undercuts the very conversation it exists to
 * settle, so both the CSV and the ranking toast read their percentages here.
 *
 * Returns one entry per item, in the items' order. All-zero when nothing carries
 * an impact (there is no total to apportion), matching `pctOfTotal`'s 0 fallback.
 */
export const wholePercents = (items: readonly InterferenceRankItem[]): number[] => {
  const total = items.reduce((sum, i) => sum + i.minutes, 0);
  if (total <= 0) return items.map(() => 0);
  const exact = items.map((i) => (i.minutes / total) * 100);
  const out = exact.map((v) => Math.floor(v));
  let leftover = 100 - out.reduce((sum, v) => sum + v, 0);
  // Largest fractional part wins the next point; ties break by rank order so the
  // result is deterministic (and the bigger interference keeps the higher share).
  const byFrac = exact
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.idx - b.idx);
  for (const { idx } of byFrac) {
    if (leftover <= 0) break;
    out[idx] = (out[idx] ?? 0) + 1;
    leftover--;
  }
  return out;
};
