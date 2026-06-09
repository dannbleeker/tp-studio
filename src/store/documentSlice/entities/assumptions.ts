/**
 * Assumption-on-edge actions. Record-canonical (v10): an assumption is a pure
 * `Assumption` record in `doc.assumptions` (text, status, kind, injection links,
 * resolved flag), keyed by id and attached to its host edge via `record.edgeId`.
 * It is NOT a `doc.entities` entity — the canvas card is synthesized from the
 * record (see `useGraphNodeEmission`), and `edge.assumptionIds[]` survives only
 * as a legacy per-edge membership index until a later phase removes it.
 *
 * `createEntity` is still called in `addAssumptionToEdge`, but ONLY to mint a
 * fresh collision-free id; the entity object itself is discarded.
 */

import { pruneAssumptions, pruneComments } from '@/domain/graph';
import { newEntityId } from '@/domain/ids';
import type { Assumption, AssumptionKind, AssumptionStatus, Edge, EntityId } from '@/domain/types';
import { currentDoc } from '../../selectors';
import { prunedSpread, touch } from '../docMutate';
import type { EntityFactoryDeps } from './shared';

export type AssumptionActions = {
  addAssumptionToEdge: (edgeId: string, title?: string) => Assumption | null;
  attachAssumption: (edgeId: string, assumptionId: string) => void;
  detachAssumption: (edgeId: string, assumptionId: string) => void;
  setAssumptionStatus: (assumptionId: string, status: AssumptionStatus) => void;
  /** S&T sub-typing (Session 135). Pass `undefined` to clear the kind
   *  back to "untyped". No-ops when the value is already current. */
  setAssumptionKind: (assumptionId: string, kind: AssumptionKind | undefined) => void;
  setAssumptionText: (assumptionId: string, text: string) => void;
  setAssumptionResolved: (assumptionId: string, resolved: boolean) => void;
  linkInjectionToAssumption: (assumptionId: string, injectionId: string) => void;
  unlinkInjectionFromAssumption: (assumptionId: string, injectionId: string) => void;
};

export function createAssumptionActions({
  get,
  applyDocChange,
}: EntityFactoryDeps): AssumptionActions {
  return {
    addAssumptionToEdge: (edgeId, title) => {
      const doc = currentDoc(get());
      const edge = doc.edges[edgeId];
      if (!edge) return null;
      const annotationNumber = doc.nextAnnotationNumber;
      // Record-canonical (v10): the assumption lives ONLY in `doc.assumptions` —
      // mint a fresh id directly (it is not an entity).
      const id = newEntityId();
      const now = Date.now();
      const assumption: Assumption = {
        id: id as string,
        edgeId,
        text: title ?? '',
        status: 'unexamined',
        annotationNumber,
        createdAt: now,
        updatedAt: now,
      };
      applyDocChange((prev) => {
        const e = prev.edges[edgeId];
        if (!e) return prev;
        const current = e.assumptionIds ?? [];
        const nextEdge: Edge = { ...e, assumptionIds: [...current, id] };
        const nextAssumptions = { ...(prev.assumptions ?? {}), [assumption.id]: assumption };
        return touch({
          ...prev,
          edges: { ...prev.edges, [edgeId]: nextEdge },
          assumptions: nextAssumptions,
          nextAnnotationNumber: annotationNumber + 1,
        });
      });
      return assumption;
    },

    attachAssumption: (edgeId, assumptionId) => {
      applyDocChange((prev) => {
        const edge = prev.edges[edgeId];
        // Record-canonical (v10): resolve the assumption via its record, not a
        // (no-longer-existent) `doc.entities` entry.
        const assumption = prev.assumptions?.[assumptionId];
        if (!edge || !assumption) return prev;
        const branded = assumptionId as EntityId;
        const current = edge.assumptionIds ?? [];
        if (current.includes(branded)) return prev;
        const nextEdge: Edge = { ...edge, assumptionIds: [...current, branded] };
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },

    detachAssumption: (edgeId, assumptionId) => {
      applyDocChange((prev) => {
        const edge = prev.edges[edgeId];
        const branded = assumptionId as EntityId;
        if (!edge?.assumptionIds?.includes(branded)) return prev;
        // Remove from THIS edge's list. Session 117 — when the list goes empty,
        // OMIT assumptionIds rather than setting it `undefined` (exactOptional
        // rejects explicit undefined); destructured-rest is the emit-or-omit.
        const filtered = edge.assumptionIds.filter((a) => a !== branded);
        const { assumptionIds: _drop, ...edgeRest } = edge;
        const nextEdge: Edge = filtered.length ? { ...edge, assumptionIds: filtered } : edgeRest;
        const nextEdges = { ...prev.edges, [edgeId]: nextEdge };
        // An assumption lives on exactly one edge — the first-class record carries
        // a single edgeId and there is no re-attach UI. If it's still attached to
        // another edge (only reachable via `attachAssumption`), keep it; otherwise
        // remove it OUTRIGHT (the record + any comment anchored to it). The host
        // edge usually SURVIVES the detach (we only stripped it from the edge's
        // index), so host-edge-keyed `pruneAssumptions` can't catch this orphan —
        // drop the record by id explicitly, then prune to scrub the rest. Leaving
        // it would orphan a record that leaks into JSON export.
        const stillAttached = Object.values(nextEdges).some((e) =>
          e.assumptionIds?.includes(branded)
        );
        if (stillAttached) return touch({ ...prev, edges: nextEdges });
        const { [assumptionId]: _record, ...restAssumptions } = prev.assumptions ?? {};
        const assumptions = pruneAssumptions(restAssumptions, nextEdges, prev.entities);
        const comments = pruneComments(prev.comments, nextEdges, prev.entities, restAssumptions);
        return touch({
          ...prev,
          edges: nextEdges,
          ...prunedSpread(prev, { assumptions, comments }),
        });
      });
    },

    setAssumptionStatus: (assumptionId, status) => {
      applyDocChange((prev) => {
        const cur = prev.assumptions?.[assumptionId];
        if (!cur || cur.status === status) return prev;
        const next: Assumption = { ...cur, status, updatedAt: Date.now() };
        return touch({
          ...prev,
          assumptions: { ...(prev.assumptions ?? {}), [assumptionId]: next },
        });
      });
    },

    setAssumptionKind: (assumptionId, kind) => {
      applyDocChange((prev) => {
        const cur = prev.assumptions?.[assumptionId];
        if (!cur) return prev;
        // No-op when the value is unchanged. An absent optional field already
        // reads as `undefined`, so a plain `===` treats absent === undefined.
        if (cur.kind === kind) return prev;
        // Emit-or-omit: clearing the kind drops the field entirely
        // rather than storing `kind: undefined`, matching the rest of
        // the optional-field convention (and exactOptionalPropertyTypes).
        const { kind: _drop, ...rest } = cur;
        const next: Assumption = kind
          ? { ...cur, kind, updatedAt: Date.now() }
          : { ...rest, updatedAt: Date.now() };
        return touch({
          ...prev,
          assumptions: { ...(prev.assumptions ?? {}), [assumptionId]: next },
        });
      });
    },

    setAssumptionText: (assumptionId, text) => {
      applyDocChange(
        (prev) => {
          const cur = prev.assumptions?.[assumptionId];
          if (!cur || cur.text === text) return prev;
          const next: Assumption = { ...cur, text, updatedAt: Date.now() };
          const nextAssumptions = { ...(prev.assumptions ?? {}), [assumptionId]: next };
          // Record-canonical (v10): text lives only on the record now — no
          // assumption-Entity to dual-write.
          return touch({ ...prev, assumptions: nextAssumptions });
        },
        { coalesceKey: `assumption-text:${assumptionId}` }
      );
    },

    setAssumptionResolved: (assumptionId, resolved) => {
      applyDocChange((prev) => {
        const cur = prev.assumptions?.[assumptionId];
        if (!cur) return prev;
        const wasResolved = cur.resolved === true;
        if (wasResolved === resolved) return prev;
        const { resolved: _drop, ...rest } = cur;
        const next: Assumption = resolved
          ? { ...rest, resolved: true, updatedAt: Date.now() }
          : { ...rest, updatedAt: Date.now() };
        return touch({
          ...prev,
          assumptions: { ...(prev.assumptions ?? {}), [assumptionId]: next },
        });
      });
    },

    linkInjectionToAssumption: (assumptionId, injectionId) => {
      applyDocChange((prev) => {
        const cur = prev.assumptions?.[assumptionId];
        if (!cur) return prev;
        const list = cur.injectionIds ?? [];
        const branded = injectionId as EntityId;
        if (list.includes(branded)) return prev;
        const next: Assumption = {
          ...cur,
          injectionIds: [...list, branded],
          updatedAt: Date.now(),
        };
        return touch({
          ...prev,
          assumptions: { ...(prev.assumptions ?? {}), [assumptionId]: next },
        });
      });
    },

    unlinkInjectionFromAssumption: (assumptionId, injectionId) => {
      applyDocChange((prev) => {
        const cur = prev.assumptions?.[assumptionId];
        if (!cur?.injectionIds) return prev;
        const branded = injectionId as EntityId;
        if (!cur.injectionIds.includes(branded)) return prev;
        const filtered = cur.injectionIds.filter((id) => id !== branded);
        // See `detachAssumption` for the same emit-or-omit pattern.
        const { injectionIds: _drop, ...rest } = cur;
        const next: Assumption = {
          ...(filtered.length > 0 ? { ...cur, injectionIds: filtered } : rest),
          updatedAt: Date.now(),
        };
        return touch({
          ...prev,
          assumptions: { ...(prev.assumptions ?? {}), [assumptionId]: next },
        });
      });
    },
  };
}
