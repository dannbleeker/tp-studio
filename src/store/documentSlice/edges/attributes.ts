/**
 * Edge polarity (weight) + user-defined edge attributes. Split out of
 * `edgesSlice.ts`.
 */

import type { AttrValue, Edge, EdgeWeight } from '@/domain/types';
import { touch } from '../docMutate';
import type { EdgesFactoryDeps } from './shared';

export type EdgeAttributeActions = {
  /** Bundle 8 / FL-ED1 — set or clear the polarity tag on an edge. */
  setEdgeWeight: (edgeId: string, weight: EdgeWeight | undefined) => void;
  /** B1 — user-defined edge attributes (mirror of `setEntityAttribute`). */
  setEdgeAttribute: (edgeId: string, key: string, value: AttrValue) => void;
  removeEdgeAttribute: (edgeId: string, key: string) => void;
};

export function createEdgeAttributeActions({
  applyDocChange,
}: EdgesFactoryDeps): EdgeAttributeActions {
  return {
    setEdgeWeight: (edgeId, weight) => {
      applyDocChange((prev) => {
        const cur = prev.edges[edgeId];
        if (!cur) return prev;
        // Absent optional field reads as `undefined`, so `===` treats
        // absent === undefined (no-op when unchanged / clearing a never-set).
        if (cur.weight === weight) return prev;
        if (weight === undefined) {
          const { weight: _drop, ...rest } = cur;
          return touch({ ...prev, edges: { ...prev.edges, [edgeId]: rest as Edge } });
        }
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: { ...cur, weight } } });
      });
    },

    setEdgeAttribute: (edgeId, key, value) => {
      applyDocChange((prev) => {
        const cur = prev.edges[edgeId];
        if (!cur) return prev;
        const existing = cur.attributes?.[key];
        if (existing && existing.kind === value.kind && existing.value === value.value) {
          return prev;
        }
        const nextAttrs: Record<string, AttrValue> = { ...(cur.attributes ?? {}), [key]: value };
        const nextEdge: Edge = { ...cur, attributes: nextAttrs };
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },

    removeEdgeAttribute: (edgeId, key) => {
      applyDocChange((prev) => {
        const cur = prev.edges[edgeId];
        if (!cur?.attributes || !(key in cur.attributes)) return prev;
        const { [key]: _drop, ...rest } = cur.attributes;
        // Emit-or-omit pattern (same as removeEntityAttribute in
        // entitiesSlice): when the map empties we drop the attributes
        // field rather than setting it to undefined, since
        // exactOptionalPropertyTypes rejects explicit undefined on the
        // optional `Edge.attributes` field.
        const { attributes: _dropAttr, ...curRest } = cur;
        const nextEdge: Edge =
          Object.keys(rest).length > 0 ? { ...cur, attributes: rest } : curRest;
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },
  };
}
