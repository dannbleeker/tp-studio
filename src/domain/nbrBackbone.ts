import { entitiesOfBuiltin, outgoingEdges } from './graphCore';
import type { TPDocument } from './types';

/**
 * Session 199 (backlog E) — the Negative Branch Reservation "backbone": the
 * injection → … → UDE spine that a well-formed NBR walks (Scheinkopf; Cohen,
 * Handbook Ch. 24). Everything off that spine is a *side* branch. The **turning
 * point** is the first edge on the spine that carries a negative polarity —
 * where the chain flips from "so far so good" to "yes, but…".
 *
 * Pure + display-only: it drives readability (which edges are the spine, where it
 * turns negative), never validation. `null` when the doc isn't an NBR or has no
 * directed injection → UDE path yet.
 *
 * Uses the *longest* directed injection → UDE path — the branch's full story,
 * not a shortcut BFS (`findPath` is shortest + falls back to undirected, so it's
 * the wrong tool here). Cycle-safe via a visiting guard; NBRs are acyclic in
 * practice, so the memo is exact on the common case and merely terminates safely
 * otherwise.
 */
export type NbrBackbone = {
  backboneEdgeIds: ReadonlySet<string>;
  backboneEntityIds: ReadonlySet<string>;
  /** The first negative-weight edge on the spine, or null if it never turns. */
  turningPointEdgeId: string | null;
};

type Path = { edgeIds: string[]; entityIds: string[] };

// Cache on (entities, edges) references — entity types (injection/UDE) and edge
// topology/weight both feed the result, so both must invalidate it.
const cache = new WeakMap<
  TPDocument['entities'],
  WeakMap<TPDocument['edges'], NbrBackbone | null>
>();

const compute = (doc: TPDocument): NbrBackbone | null => {
  if (doc.diagramType !== 'nbr') return null;
  const injections = entitiesOfBuiltin(doc, 'injection');
  if (injections.length === 0) return null;
  const udeIds = new Set<string>(entitiesOfBuiltin(doc, 'ude').map((e) => e.id));
  if (udeIds.size === 0) return null;

  const memo = new Map<string, Path | null>();
  const visiting = new Set<string>();
  // Longest directed path from `nodeId` to any UDE (inclusive of both ends).
  const longestToUde = (nodeId: string): Path | null => {
    if (udeIds.has(nodeId)) return { edgeIds: [], entityIds: [nodeId] };
    const cached = memo.get(nodeId);
    if (cached !== undefined) return cached;
    if (visiting.has(nodeId)) return null; // cycle — bail on this branch
    visiting.add(nodeId);
    let best: Path | null = null;
    for (const e of outgoingEdges(doc, nodeId)) {
      const sub = longestToUde(e.targetId);
      if (sub && (best === null || sub.edgeIds.length + 1 > best.edgeIds.length)) {
        best = { edgeIds: [e.id, ...sub.edgeIds], entityIds: [nodeId, ...sub.entityIds] };
      }
    }
    visiting.delete(nodeId);
    memo.set(nodeId, best);
    return best;
  };

  // Pick the longest injection → UDE spine across all injections.
  let spine: Path | null = null;
  for (const inj of injections) {
    const p = longestToUde(inj.id);
    if (p && (spine === null || p.edgeIds.length > spine.edgeIds.length)) spine = p;
  }
  if (!spine || spine.edgeIds.length === 0) return null;

  const turningPointEdgeId =
    spine.edgeIds.find((id) => doc.edges[id]?.weight === 'negative') ?? null;

  return {
    backboneEdgeIds: new Set(spine.edgeIds),
    backboneEntityIds: new Set(spine.entityIds),
    turningPointEdgeId,
  };
};

export const nbrBackbone = (doc: TPDocument): NbrBackbone | null => {
  let byEdges = cache.get(doc.entities);
  if (!byEdges) {
    byEdges = new WeakMap();
    cache.set(doc.entities, byEdges);
  }
  const hit = byEdges.get(doc.edges);
  if (hit !== undefined) return hit;
  const result = compute(doc);
  byEdges.set(doc.edges, result);
  return result;
};
