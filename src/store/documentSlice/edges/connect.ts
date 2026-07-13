/**
 * Edge connect / lifecycle: create, update, delete, reverse, reconnect, plus
 * the NBR "trim this branch" helper. Split out of `edgesSlice.ts`.
 */

import { createEdge, createEntity } from '@/domain/factory';
import { hasEdge, pruneAssumptions, pruneComments, pruneSingletonJunctors } from '@/domain/graph';
import type { Edge, Entity, Patch } from '@/domain/types';
import { edgePatch, prunedSpread, touch } from '../docMutate';
import type { EdgesFactoryDeps } from './shared';

/**
 * Session 199 (backlog E) — one row of the Prerequisite-Tree Obstacle/Objective
 * intake table. Each row mints an obstacle + the Intermediate Objective that
 * overcomes it. `showStopper` and `blockingFactor` are optional metadata homed
 * on the obstacle (a boolean attribute + the description) — no schema change.
 */
export type ObstacleIoRow = {
  obstacle: string;
  io: string;
  showStopper?: boolean;
  blockingFactor?: string;
};

export type ConnectActions = {
  connect: (sourceId: string, targetId: string) => Edge | null;
  /** Session 199 (backlog E) — batched intake: mint an obstacle + IO + the
   *  `IO → obstacle` necessity edge for every non-blank row, in ONE undo step.
   *  When the PRT has a single apex `goal`, each new obstacle is also wired to it
   *  (necessity) so the pairs aren't left unrooted. Blank rows are skipped;
   *  returns the created entities (selected), or `[]` if nothing was minted. */
  addObstacleIoRows: (rows: ObstacleIoRow[]) => Entity[];
  /** Phase 3 #4 (TP completeness — NBR trimming) — "Trim this branch": mint a
   *  *trimming injection* and connect it to `effectId` with a NEGATIVE-weight
   *  edge (the injection works against the undesirable effect), in one undoable
   *  step. Returns the new injection (selected, ready to name), or null if the
   *  effect entity is gone. */
  trimBranch: (effectId: string) => Entity | null;
  updateEdge: (id: string, patch: Patch<Omit<Edge, 'id'>>) => void;
  deleteEdge: (id: string) => void;
  /** A6: swap an edge's source and target. Useful when a user has built the
   *  arrow in the wrong direction (mis-attributing cause to effect). */
  reverseEdge: (id: string) => void;
  /** Re-target an existing edge — drag one endpoint onto a different entity
   *  (React Flow reconnection). Mirrors `connect`'s guards (self-loop /
   *  duplicate / endpoints-exist; cycles stay allowed) and is undoable. A
   *  *target* move drops the edge's junctor membership (junctors are
   *  per-target). Returns the updated edge, or `null` if rejected / a no-op. */
  reconnectEdge: (edgeId: string, sourceId: string, targetId: string) => Edge | null;
};

/** Drop all three junctor-group memberships from an edge (immutably). Used when
 *  an edge's TARGET is re-pointed: a junctor groups the causes converging on
 *  ONE target, so moving the target removes the edge from that convergence. */
const withoutJunctorGroups = (e: Edge): Edge => {
  // `andMode` (the A3 AND flavour) is dropped alongside the group fields — it's
  // meaningless once the edge leaves its AND group (e.g. on re-target).
  const { andGroupId: _a, orGroupId: _o, xorGroupId: _x, andMode: _m, ...rest } = e;
  return rest;
};

export function createConnectActions({
  get,
  set,
  applyDocChange,
}: EdgesFactoryDeps): ConnectActions {
  return {
    connect: (sourceId, targetId) => {
      if (sourceId === targetId) return null;
      const { doc } = get();
      const source = doc.entities[sourceId];
      const target = doc.entities[targetId];
      if (!source || !target) return null;
      // Session 136 — note-endpoints used to be silently refused here
      // (FL-ET7 philosophy: notes sit outside the causal graph). Per
      // Dann's usage feedback, that block is lifted: a user can now
      // drag a connection into / out of a note. The visual treatment
      // diverges (note-touching edges paint dotted + thinner; see
      // `TPEdge.tsx`) so the user reads them as annotation links,
      // not as causal edges. The validators + propagation engine
      // already treat notes as non-causal (`isNonCausal()`), so the
      // edge's existence has no effect on CLR / state derivation.
      if (hasEdge(doc, sourceId, targetId)) return null;
      const edge = createEdge({ sourceId, targetId });
      applyDocChange((prev) => touch({ ...prev, edges: { ...prev.edges, [edge.id]: edge } }));
      return edge;
    },

    trimBranch: (effectId) => {
      const { doc } = get();
      const effect = doc.entities[effectId];
      if (!effect) return null;
      const injection = createEntity({
        type: 'injection',
        title: 'Trimming injection — what would break this branch?',
        annotationNumber: doc.nextAnnotationNumber,
      });
      // injection (cause) → effect, with NEGATIVE weight: the injection works
      // against the undesirable effect. One applyDocChange = one undo step.
      const edge: Edge = {
        ...createEdge({ sourceId: injection.id, targetId: effectId }),
        weight: 'negative',
      };
      applyDocChange((prev) =>
        touch({
          ...prev,
          entities: { ...prev.entities, [injection.id]: injection },
          edges: { ...prev.edges, [edge.id]: edge },
          nextAnnotationNumber: prev.nextAnnotationNumber + 1,
        })
      );
      get().selectEntity(injection.id);
      return injection;
    },

    addObstacleIoRows: (rows) => {
      const clean = rows
        .map((r) => ({
          obstacle: r.obstacle.trim(),
          io: r.io.trim(),
          showStopper: r.showStopper === true,
          blockingFactor: r.blockingFactor?.trim() ?? '',
        }))
        // A row needs at least one of the two texts to be worth minting.
        .filter((r) => r.obstacle !== '' || r.io !== '');
      if (clean.length === 0) return [];

      const { doc } = get();
      // Root each obstacle to the apex goal only when there's exactly one — with
      // zero or several goals the right parent is ambiguous, so leave them free.
      const goals = Object.values(doc.entities).filter((e) => e.type === 'goal');
      const apexGoalId = goals.length === 1 ? goals[0]?.id : undefined;

      let ann = doc.nextAnnotationNumber;
      const newEntities: Record<string, Entity> = {};
      const newEdges: Record<string, Edge> = {};
      const createdEntities: Entity[] = [];

      for (const r of clean) {
        const baseObstacle = createEntity({
          type: 'obstacle',
          title: r.obstacle,
          annotationNumber: ann++,
        });
        // show-stopper → boolean attribute; blocking-factor → description. Both
        // omitted when empty (emit-or-omit; no `undefined`/`false` persisted).
        const obstacle: Entity = {
          ...baseObstacle,
          ...(r.showStopper
            ? {
                attributes: {
                  ...baseObstacle.attributes,
                  showStopper: { kind: 'bool', value: true },
                },
              }
            : {}),
          ...(r.blockingFactor !== '' ? { description: r.blockingFactor } : {}),
        };
        const io = createEntity({
          type: 'intermediateObjective',
          title: r.io,
          annotationNumber: ann++,
        });
        newEntities[obstacle.id] = obstacle;
        newEntities[io.id] = io;
        createdEntities.push(obstacle, io);

        // IO → obstacle (necessity): the objective overcomes the obstacle.
        const ioEdge: Edge = {
          ...createEdge({ sourceId: io.id, targetId: obstacle.id }),
          kind: 'necessity',
        };
        newEdges[ioEdge.id] = ioEdge;

        if (apexGoalId) {
          // obstacle → goal (necessity): removing the obstacle is required for the goal.
          const goalEdge: Edge = {
            ...createEdge({ sourceId: obstacle.id, targetId: apexGoalId }),
            kind: 'necessity',
          };
          newEdges[goalEdge.id] = goalEdge;
        }
      }

      // ONE applyDocChange = ONE undo step for the whole table.
      applyDocChange((prev) =>
        touch({
          ...prev,
          entities: { ...prev.entities, ...newEntities },
          edges: { ...prev.edges, ...newEdges },
          nextAnnotationNumber: ann,
        })
      );
      get().selectEntities(createdEntities.map((e) => e.id));
      return createdEntities;
    },

    updateEdge: (id, patch) => {
      applyDocChange((prev) => edgePatch(prev, id, patch));
    },

    deleteEdge: (id) => {
      applyDocChange((prev) => {
        if (!prev.edges[id]) return prev;
        const { [id]: _removed, ...rest } = prev.edges;
        // Deleting one member of a junctor group can leave it with a single
        // input — a logically vacuous "AND of one". Collapse such a group back
        // to a plain direct edge.
        const edges = pruneSingletonJunctors(rest);
        // Drop assumptions that annotated the now-removed edge (otherwise the
        // record dangles with an edgeId that resolves to nothing).
        const assumptions = pruneAssumptions(prev.assumptions, edges, prev.entities);
        // Pass the freshly-pruned assumptions so a comment anchored to an
        // assumption that just orphaned is dropped in lockstep (else it dangles).
        const comments = pruneComments(prev.comments, edges, prev.entities, assumptions);
        return touch({
          ...prev,
          edges,
          ...prunedSpread(prev, { assumptions, comments }),
        });
      });
      set({ selection: { kind: 'none' } });
    },

    reverseEdge: (id) => {
      applyDocChange((prev) => {
        const current = prev.edges[id];
        if (!current) return prev;
        // Refuse to reverse if the flipped direction would duplicate an
        // existing edge — that would create two parallel edges between the
        // same endpoints, which we don't model.
        if (hasEdge(prev, current.targetId, current.sourceId)) return prev;
        // A reversal re-points the target (the old source becomes the new
        // target), so a junctor-grouped edge would break the group's
        // same-target invariant. Strip its junctor membership (mirrors
        // reconnectEdge's target-move handling) and prune any group left with a
        // single member back to a plain edge.
        const flipped = withoutJunctorGroups({
          ...current,
          sourceId: current.targetId,
          targetId: current.sourceId,
        });
        const edges = pruneSingletonJunctors({ ...prev.edges, [id]: flipped });
        return touch({ ...prev, edges });
      });
    },

    reconnectEdge: (edgeId, sourceId, targetId) => {
      if (sourceId === targetId) return null; // self-loop
      const { doc } = get();
      const current = doc.edges[edgeId];
      if (!current) return null;
      const src = doc.entities[sourceId];
      const tgt = doc.entities[targetId];
      if (!src || !tgt) return null;
      // No-op if neither endpoint actually moved.
      if (current.sourceId === sourceId && current.targetId === targetId) return null;
      // Refuse a move that would duplicate an existing edge between the same
      // ordered pair — we don't model parallel edges. `hasEdge` ignores ids;
      // the no-op guard above means it can never match `current` itself.
      if (hasEdge(doc, sourceId, targetId)) return null;

      // Use the entities' branded ids (verified present above) rather than the
      // raw string params, so the `Edge` stays correctly typed.
      const moved: Edge = { ...current, sourceId: src.id, targetId: tgt.id };
      // A target move takes the edge out of any junctor it belonged to (the
      // group is the set of causes converging on the OLD target). A source-only
      // move keeps the target — and the membership — intact.
      const next: Edge = current.targetId !== targetId ? withoutJunctorGroups(moved) : moved;

      applyDocChange((prev) =>
        prev.edges[edgeId] ? touch({ ...prev, edges: { ...prev.edges, [edgeId]: next } }) : prev
      );
      return next;
    },
  };
}
