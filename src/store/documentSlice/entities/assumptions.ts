/**
 * Assumption-on-edge actions. Two layered surfaces:
 *
 *   1. The legacy assumption-Entity (typed `'assumption'`, attached to
 *      an edge via `edge.assumptionIds[]`). Existing UI paths (TPNode
 *      rendering, sketchpad-style lists) still read from here.
 *   2. The Session 77 first-class `Assumption` record (status chip,
 *      injection links, resolved flag). Shares the same id as the
 *      assumption-Entity — overlapping ID space; see migration v6→v7
 *      for the rationale.
 *
 * Both shapes stay in sync via dual-writes in `setAssumptionText`.
 */

import { createEntity } from '@/domain/factory';
import type {
  Assumption,
  AssumptionKind,
  AssumptionStatus,
  Edge,
  Entity,
  EntityId,
} from '@/domain/types';
import { currentDoc } from '../../selectors';
import { touch } from '../docMutate';
import type { EntityFactoryDeps } from './shared';

export type AssumptionActions = {
  addAssumptionToEdge: (edgeId: string, title?: string) => Entity | null;
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
      const entity = createEntity({ type: 'assumption', title, annotationNumber });
      // Session 77: also mint a first-class Assumption record so the
      // EC AssumptionWell has a status chip + injection link from day
      // one. Shares the same id as the assumption-Entity (overlapping
      // ID space; see migration v6→v7 for the rationale).
      const now = Date.now();
      const assumption: Assumption = {
        id: entity.id as string,
        edgeId,
        text: title ?? '',
        status: 'unexamined',
        createdAt: now,
        updatedAt: now,
      };
      applyDocChange((prev) => {
        const e = prev.edges[edgeId];
        if (!e) return prev;
        const current = e.assumptionIds ?? [];
        const nextEdge: Edge = { ...e, assumptionIds: [...current, entity.id] };
        const nextAssumptions = { ...(prev.assumptions ?? {}), [assumption.id]: assumption };
        return touch({
          ...prev,
          entities: { ...prev.entities, [entity.id]: entity },
          edges: { ...prev.edges, [edgeId]: nextEdge },
          assumptions: nextAssumptions,
          nextAnnotationNumber: annotationNumber + 1,
        });
      });
      return entity;
    },

    attachAssumption: (edgeId, assumptionId) => {
      applyDocChange((prev) => {
        const edge = prev.edges[edgeId];
        const assumption = prev.entities[assumptionId];
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
        const filtered = edge.assumptionIds.filter((a) => a !== branded);
        // Session 117 — when filtered is empty, OMIT assumptionIds rather
        // than setting `assumptionIds: undefined`. Under
        // exactOptionalPropertyTypes the optional field rejects explicit
        // undefined. Destructured-rest is the cleanest emit-or-omit
        // pattern.
        const { assumptionIds: _drop, ...rest } = edge;
        const nextEdge: Edge = filtered.length ? { ...edge, assumptionIds: filtered } : rest;
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
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
        // No-op when the value is unchanged (treat absent === undefined).
        if ((cur.kind ?? undefined) === kind) return prev;
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
          // Dual-write: keep the legacy assumption-Entity's `title` in
          // sync so any UI path that reads it (TPNode, lists) stays
          // current.
          const ent = prev.entities[assumptionId];
          const nextEntities =
            ent && ent.type === 'assumption' && ent.title !== text
              ? { ...prev.entities, [assumptionId]: { ...ent, title: text, updatedAt: Date.now() } }
              : prev.entities;
          return touch({ ...prev, entities: nextEntities, assumptions: nextAssumptions });
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
