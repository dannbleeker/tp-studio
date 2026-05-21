/**
 * Entity-level mutations: add / update / delete plus per-entity feature
 * fields (collapse, position, ordering, etc.), bulk delete that scrubs
 * downstream edges/groups, swap of two entities' content, and the
 * assumption-on-edge helpers (which create new assumption entities and
 * attach them to existing edges — primary mutation is on the entities
 * map plus the edge's `assumptionIds`).
 *
 * Session 135 — split from one 621-line file into four focused
 * factories under `entities/`. The slice presented to Zustand
 * (`createEntitiesSlice`) is still a flat object so `useDocumentStore`
 * selectors stay unchanged. The split exists for read-at-a-glance
 * reasons: core CRUD, assumptions, attributes, and evidence each get
 * their own file, and each cluster's no-op guards / coalesce keys
 * sit next to the action that uses them.
 */

import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { makeApplyDocChange } from './docMutate';
import { type AssumptionActions, createAssumptionActions } from './entities/assumptions';
import { type AttributeActions, createAttributeActions } from './entities/attributes';
import { createEntityCrudActions, type EntityCrudActions } from './entities/entityCrud';
import { createEvidenceActions, type EvidenceActions } from './entities/evidence';

export type EntitiesSlice = EntityCrudActions &
  AssumptionActions &
  AttributeActions &
  EvidenceActions;

export const createEntitiesSlice: StateCreator<RootStore, [], [], EntitiesSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);
  const deps = { get, set, applyDocChange };
  return {
    ...createEntityCrudActions(deps),
    ...createAssumptionActions(deps),
    ...createAttributeActions(deps),
    ...createEvidenceActions(deps),
  };
};
