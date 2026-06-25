/**
 * Cross-document linking (TP completeness #2 — U-Shape) + the guided spawns
 * that create a linked partner document. Split out of `docMetaSlice.ts` so the
 * reciprocal-link bookkeeping reads in one place.
 *
 * Links are reference metadata — deliberately NOT pushed to undo history (cf.
 * `markSystemScopeNudgeShown`), so these actions write `docs` / persist directly
 * rather than going through `applyDocChange`.
 */

import { saveDocToLocalStorage } from '@/domain/persistence';
import type { DocumentId, Entity, EntityId, EntityLink, TPDocument } from '@/domain/types';
import { buildCoreCloudSeed, buildInjectionFRTSeed } from '@/domain/uShape';
import { setActiveDoc } from '../../activeDoc';
import { touch } from '../docMutate';
import type { DocMetaFactoryDeps } from './shared';

export type CrossDocLinkActions = {
  /**
   * Phase 2a (TP completeness #2 — U-Shape linkage) — link the currently
   * selected entity (active tab) to `targetEntityId` in another open tab
   * `targetDocId`. Writes a **reciprocal** link on both entities (the partner
   * carries the mirror) and persists both docs. No-op unless exactly one entity
   * is selected and the target is a *different* open tab. Links are reference
   * metadata — deliberately not pushed to undo history.
   */
  linkSelectedEntityTo: (targetDocId: DocumentId, targetEntityId: EntityId) => void;
  /** Phase 2a — remove `link` from entity `sourceEntityId` (active doc) and its
   *  mirror from the target entity when that tab is open. */
  unlinkEntity: (sourceEntityId: EntityId, link: EntityLink) => void;
  /** Phase 2b — guided helper: spawn a Core Cloud (EC, `cloudType:'core'`) from
   *  the selected entity, opened in a new tab and reciprocally linked back. */
  createCoreCloudFromSelection: () => void;
  /** Phase 2b — guided helper: carry the selected entity into a new FRT as an
   *  injection, opened in a new tab and reciprocally linked back. */
  carryInjectionToFRT: () => void;
};

/** Phase 2a — set an entity's cross-doc `links`, dropping the field entirely
 *  when the list is empty so an unlinked entity round-trips without it. */
const withLinks = (entity: Entity, links: EntityLink[]): Entity => {
  if (links.length > 0) return { ...entity, links };
  const { links: _drop, ...rest } = entity;
  return rest;
};

export function createCrossDocLinkActions({ get, set }: DocMetaFactoryDeps): CrossDocLinkActions {
  // Phase 2b (U-Shape) — shared spawn: bake a reciprocal link onto the seed's
  // anchor entity, add the mirror to the source, persist the source, and open
  // the seed in a NEW tab (always — the whole point is both docs open + linked,
  // so this bypasses the `openDocsInNewTab` pref). Links are metadata → no
  // history entry (cf. `linkSelectedEntityTo`). Returns false if the source /
  // anchor entity is missing.
  const spawnLinkedFromSelection = (
    seed: { doc: TPDocument; anchorId: EntityId },
    sourceEntityId: EntityId
  ): boolean => {
    const state = get();
    const sourceDocId = state.activeDocId;
    const sourceEntity = state.doc.entities[sourceEntityId];
    const anchor = seed.doc.entities[seed.anchorId];
    if (!sourceEntity || !anchor) return false;
    const seedWithLink: TPDocument = {
      ...seed.doc,
      entities: {
        ...seed.doc.entities,
        [seed.anchorId]: { ...anchor, links: [{ docId: sourceDocId, entityId: sourceEntityId }] },
      },
    };
    const nextSource = touch({
      ...state.doc,
      entities: {
        ...state.doc.entities,
        [sourceEntityId]: {
          ...sourceEntity,
          links: [...(sourceEntity.links ?? []), { docId: seed.doc.id, entityId: seed.anchorId }],
        },
      },
    });
    set(setActiveDoc(state, nextSource));
    saveDocToLocalStorage(nextSource);
    get().openTab(seedWithLink);
    return true;
  };

  return {
    linkSelectedEntityTo: (targetDocId, targetEntityId) => {
      const state = get();
      const sel = state.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) return;
      const sourceEntityId = sel.ids[0];
      if (!sourceEntityId) return;
      const sourceDocId = state.activeDocId;
      if (targetDocId === sourceDocId) return; // cross-tab links only
      const sourceDoc = state.doc;
      const targetDoc = state.docs[targetDocId];
      if (!targetDoc) return;
      const sourceEntity = sourceDoc.entities[sourceEntityId];
      const targetEntity = targetDoc.entities[targetEntityId];
      if (!sourceEntity || !targetEntity) return;

      // Dedup — don't double-link the same pair.
      const already = (sourceEntity.links ?? []).some(
        (l) => l.docId === targetDocId && l.entityId === targetEntityId
      );
      if (already) {
        get().showToast('info', `Already linked to "${targetEntity.title || 'that entity'}".`);
        return;
      }

      const sourceLink: EntityLink = { docId: targetDocId, entityId: targetEntityId };
      const mirrorLink: EntityLink = { docId: sourceDocId, entityId: sourceEntityId };
      const nextSource = touch({
        ...sourceDoc,
        entities: {
          ...sourceDoc.entities,
          [sourceEntityId]: { ...sourceEntity, links: [...(sourceEntity.links ?? []), sourceLink] },
        },
      });
      const nextTarget = touch({
        ...targetDoc,
        entities: {
          ...targetDoc.entities,
          [targetEntityId]: { ...targetEntity, links: [...(targetEntity.links ?? []), mirrorLink] },
        },
      });

      // Reciprocal write: merge the background target into `docs` first so
      // `setActiveDoc` preserves it while replacing the active source doc. No
      // history entry on either side — links are metadata (cf.
      // `markSystemScopeNudgeShown`).
      set(
        setActiveDoc({ ...state, docs: { ...state.docs, [targetDocId]: nextTarget } }, nextSource)
      );
      saveDocToLocalStorage(nextSource);
      saveDocToLocalStorage(nextTarget);
      get().showToast(
        'success',
        `Linked to "${targetEntity.title || 'entity'}" in ${targetDoc.title}.`
      );
    },

    unlinkEntity: (sourceEntityId, link) => {
      const state = get();
      const sourceDoc = state.doc;
      const sourceEntity = sourceDoc.entities[sourceEntityId];
      if (!sourceEntity?.links) return;
      const remaining = sourceEntity.links.filter(
        (l) => !(l.docId === link.docId && l.entityId === link.entityId)
      );
      if (remaining.length === sourceEntity.links.length) return; // no such link
      const nextSource = touch({
        ...sourceDoc,
        entities: { ...sourceDoc.entities, [sourceEntityId]: withLinks(sourceEntity, remaining) },
      });

      // Drop the mirror from the target entity when its tab is open.
      let nextDocs = state.docs;
      const targetDoc = state.docs[link.docId];
      const targetEntity = targetDoc?.entities[link.entityId];
      if (targetDoc && targetEntity?.links) {
        const mirrorRemaining = targetEntity.links.filter(
          (l) => !(l.docId === state.activeDocId && l.entityId === sourceEntityId)
        );
        if (mirrorRemaining.length !== targetEntity.links.length) {
          const nextTarget = touch({
            ...targetDoc,
            entities: {
              ...targetDoc.entities,
              [link.entityId]: withLinks(targetEntity, mirrorRemaining),
            },
          });
          nextDocs = { ...state.docs, [link.docId]: nextTarget };
          saveDocToLocalStorage(nextTarget);
        }
      }
      set(setActiveDoc({ ...state, docs: nextDocs }, nextSource));
      saveDocToLocalStorage(nextSource);
    },

    createCoreCloudFromSelection: () => {
      const state = get();
      const sel = state.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        get().showToast('info', 'Select a single entity (your core problem) first.');
        return;
      }
      const sourceEntityId = sel.ids[0];
      if (!sourceEntityId) return;
      const sourceEntity = state.doc.entities[sourceEntityId];
      if (!sourceEntity) return;
      const problem = sourceEntity.title.trim() || 'this problem';
      if (spawnLinkedFromSelection(buildCoreCloudSeed(problem), sourceEntityId)) {
        get().showToast(
          'success',
          `Created a Core Cloud for "${problem}" — linked back to your tree.`
        );
      }
    },

    carryInjectionToFRT: () => {
      const state = get();
      const sel = state.selection;
      if (sel.kind !== 'entities' || sel.ids.length !== 1) {
        get().showToast('info', 'Select the entity to carry into an FRT first.');
        return;
      }
      const sourceEntityId = sel.ids[0];
      if (!sourceEntityId) return;
      const sourceEntity = state.doc.entities[sourceEntityId];
      if (!sourceEntity) return;
      const injection = sourceEntity.title.trim() || 'this injection';
      if (spawnLinkedFromSelection(buildInjectionFRTSeed(injection), sourceEntityId)) {
        get().showToast('success', `Carried "${injection}" into a new FRT — linked back.`);
      }
    },
  };
}
