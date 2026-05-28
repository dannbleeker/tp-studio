/**
 * Session 134 / spec major gap #6 — first-class evidence items on
 * entities. Three ops: append, patch one field (with coalesce key per
 * row+field set), remove. The optional fields (`url`, `validatedAt`,
 * `validatedBy`) are emit-or-omit on write so an entity's persisted
 * shape doesn't grow `field: undefined` keys.
 */

import { newEvidenceId } from '@/domain/ids';
import type { Entity, EvidenceItem, Patch } from '@/domain/types';
import { currentDoc } from '../../selectors';
import type { RootStore } from '../../types';
import { touch } from '../docMutate';
import type { EntityFactoryDeps } from './shared';

export type EvidenceActions = {
  addEvidence: (entityId: string, partial?: Partial<Omit<EvidenceItem, 'id'>>) => string | null;
  updateEvidence: (
    entityId: string,
    evidenceId: string,
    patch: Patch<Omit<EvidenceItem, 'id' | 'createdAt'>>
  ) => void;
  removeEvidence: (entityId: string, evidenceId: string) => void;
};

export function createEvidenceActions({ get, applyDocChange }: EntityFactoryDeps): EvidenceActions {
  return {
    addEvidence: (entityId, partial) => {
      const cur = readEntity(get, entityId);
      if (!cur) return null;
      const now = Date.now();
      const item: EvidenceItem = {
        id: newEvidenceId(),
        description: partial?.description ?? '',
        source: partial?.source ?? 'observed',
        strength: partial?.strength ?? 'moderate',
        ...(partial?.url && partial.url.length > 0 ? { url: partial.url } : {}),
        ...(typeof partial?.validatedAt === 'number' ? { validatedAt: partial.validatedAt } : {}),
        ...(partial?.validatedBy && partial.validatedBy.length > 0
          ? { validatedBy: partial.validatedBy }
          : {}),
        createdAt: now,
        updatedAt: now,
      };
      applyDocChange((prev) => {
        const entity = prev.entities[entityId];
        if (!entity) return prev;
        const nextList: EvidenceItem[] = [...(entity.evidence ?? []), item];
        const nextEntity: Entity = {
          ...entity,
          evidence: nextList,
          updatedAt: now,
        };
        return touch({ ...prev, entities: { ...prev.entities, [entityId]: nextEntity } });
      });
      return item.id;
    },

    updateEvidence: (entityId, evidenceId, patch) => {
      const patchKeys = Object.keys(patch).sort().join(',');
      applyDocChange(
        (prev) => {
          const entity = prev.entities[entityId];
          if (!entity?.evidence) return prev;
          const idx = entity.evidence.findIndex((e) => e.id === evidenceId);
          if (idx === -1) return prev;
          const existing = entity.evidence[idx];
          if (!existing) return prev;

          // Resolve the next value for each field. The "key present in
          // patch + value undefined" idiom means "clear this optional
          // field"; "key absent" means "leave it alone". We can't
          // collapse these to a single ternary because under
          // exactOptionalPropertyTypes, optional fields cannot carry
          // `undefined` as a value — they must be omitted entirely.
          const nextDescription =
            'description' in patch && patch.description !== undefined
              ? patch.description
              : existing.description;
          const nextSource =
            'source' in patch && patch.source !== undefined ? patch.source : existing.source;
          const nextStrength =
            'strength' in patch && patch.strength !== undefined
              ? patch.strength
              : existing.strength;
          const nextUrl = 'url' in patch ? patch.url : existing.url;
          const nextValidatedAt = 'validatedAt' in patch ? patch.validatedAt : existing.validatedAt;
          const nextValidatedBy = 'validatedBy' in patch ? patch.validatedBy : existing.validatedBy;

          // No-op when every resolved field already equals the existing
          // value — preserves the doc reference so `applyDocChange`'s
          // short-circuit avoids a history entry.
          const same =
            nextDescription === existing.description &&
            nextSource === existing.source &&
            nextStrength === existing.strength &&
            nextUrl === existing.url &&
            nextValidatedAt === existing.validatedAt &&
            nextValidatedBy === existing.validatedBy;
          if (same) return prev;

          // Emit-or-omit for optional fields. Empty string / undefined
          // → omit; otherwise keep the value.
          const cleaned: EvidenceItem = {
            id: existing.id,
            description: nextDescription,
            source: nextSource,
            strength: nextStrength,
            ...(nextUrl && nextUrl.length > 0 ? { url: nextUrl } : {}),
            ...(typeof nextValidatedAt === 'number' ? { validatedAt: nextValidatedAt } : {}),
            ...(nextValidatedBy && nextValidatedBy.length > 0
              ? { validatedBy: nextValidatedBy }
              : {}),
            createdAt: existing.createdAt,
            updatedAt: Date.now(),
          };
          const nextList: EvidenceItem[] = entity.evidence.map((e, i) => (i === idx ? cleaned : e));
          const nextEntity: Entity = {
            ...entity,
            evidence: nextList,
            updatedAt: Date.now(),
          };
          return touch({ ...prev, entities: { ...prev.entities, [entityId]: nextEntity } });
        },
        { coalesceKey: `evidence:${entityId}:${evidenceId}:${patchKeys}` }
      );
    },

    removeEvidence: (entityId, evidenceId) => {
      applyDocChange((prev) => {
        const entity = prev.entities[entityId];
        if (!entity?.evidence) return prev;
        const next = entity.evidence.filter((e) => e.id !== evidenceId);
        if (next.length === entity.evidence.length) return prev;
        // Empty array collapses to omitting the field — mirrors the
        // `attributes` field's emit-or-omit rule.
        const { evidence: _drop, ...rest } = entity;
        const nextEntity: Entity =
          next.length > 0
            ? { ...entity, evidence: next, updatedAt: Date.now() }
            : { ...rest, updatedAt: Date.now() };
        return touch({ ...prev, entities: { ...prev.entities, [entityId]: nextEntity } });
      });
    },
  };
}

/**
 * Tiny helper: read one entity off the live store without forcing the
 * caller to type out `currentDoc(get()).entities[id]`. Returns
 * `undefined` when the entity is missing. Used by `addEvidence` to
 * bail before minting the new item's id if the entity has been
 * deleted out from under the caller.
 */
const readEntity = (get: () => RootStore, entityId: string): Entity | undefined =>
  currentDoc(get()).entities[entityId];
