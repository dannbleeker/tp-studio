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
