/**
 * B7 — user-defined attributes on entities. Two ops: set one key (with
 * a kind+value pair) and remove one key. The "no-op when current
 * value matches" guard preserves the no-mutation contract that
 * `applyDocChange` relies on for history coalescing.
 */

import type { AttrValue, Entity } from '@/domain/types';
import { touch } from '../docMutate';
import type { EntityFactoryDeps } from './shared';

export type AttributeActions = {
  setEntityAttribute: (id: string, key: string, value: AttrValue) => void;
  removeEntityAttribute: (id: string, key: string) => void;
};

export function createAttributeActions({ applyDocChange }: EntityFactoryDeps): AttributeActions {
  return {
    setEntityAttribute: (id, key, value) => {
      applyDocChange((prev) => {
        const cur = prev.entities[id];
        if (!cur) return prev;
        const existing = cur.attributes?.[key];
        // No-op guard: same kind + same value primitive → don't churn
        // history. This is the contract `applyDocChange` relies on.
        if (existing && existing.kind === value.kind && existing.value === value.value) {
          return prev;
        }
        const nextAttrs: Record<string, AttrValue> = { ...(cur.attributes ?? {}), [key]: value };
        const nextEntity: Entity = {
          ...cur,
          attributes: nextAttrs,
          updatedAt: Date.now(),
        };
        return touch({ ...prev, entities: { ...prev.entities, [id]: nextEntity } });
      });
    },

    removeEntityAttribute: (id, key) => {
      applyDocChange((prev) => {
        const cur = prev.entities[id];
        if (!cur?.attributes || !(key in cur.attributes)) return prev;
        const { [key]: _drop, ...rest } = cur.attributes;
        // Empty map collapses to omitting the field (rather than
        // `attributes: undefined`) so the entity doesn't carry a
        // useless `attributes: {}` after the last key is removed AND
        // exactOptionalPropertyTypes' "no explicit undefined" rule is
        // satisfied.
        const { attributes: _dropAttr, ...curRest } = cur;
        const nextEntity: Entity =
          Object.keys(rest).length > 0
            ? { ...cur, attributes: rest, updatedAt: Date.now() }
            : { ...curRest, updatedAt: Date.now() };
        return touch({ ...prev, entities: { ...prev.entities, [id]: nextEntity } });
      });
    },
  };
}
