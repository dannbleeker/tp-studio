/**
 * Assumption-on-edge actions. Record-canonical: an assumption is a pure
 * `Assumption` record in `doc.assumptions` (text, status, kind, injection links,
 * resolved flag), keyed by id and attached to its host edge SOLELY via
 * `record.edgeId` — there is no `edge.assumptionIds` index any more, and an
 * assumption is not a `doc.entities` entity. Its canvas card renders from the
 * record (`TPAssumptionNode`); per-edge lookups go through `assumptionsForEdge`.
 */

import { pruneComments } from '@/domain/graph';
import { newEntityId } from '@/domain/ids';
import type { Assumption, AssumptionKind, AssumptionStatus, EntityId } from '@/domain/types';
import { currentDoc } from '../../selectors';
import { prunedSpread, touch } from '../docMutate';
import type { EntityFactoryDeps } from './shared';

export type AssumptionActions = {
  addAssumptionToEdge: (edgeId: string, title?: string) => Assumption | null;
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
        if (!prev.edges[edgeId]) return prev;
        const nextAssumptions = { ...(prev.assumptions ?? {}), [assumption.id]: assumption };
        return touch({
          ...prev,
          assumptions: nextAssumptions,
          nextAnnotationNumber: annotationNumber + 1,
        });
      });
      return assumption;
    },

    detachAssumption: (edgeId, assumptionId) => {
      applyDocChange((prev) => {
        const record = prev.assumptions?.[assumptionId];
        // An assumption lives on exactly one edge (its `record.edgeId`). "Detach"
        // is removal: drop the record outright + any comment anchored to it. Guard
        // on the host edge so a stale caller can't remove a different edge's record.
        if (!record || record.edgeId !== edgeId) return prev;
        const { [assumptionId]: _record, ...restAssumptions } = prev.assumptions ?? {};
        const comments = pruneComments(prev.comments, prev.edges, prev.entities, restAssumptions);
        return touch({
          ...prev,
          ...prunedSpread(prev, { assumptions: restAssumptions, comments }),
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
