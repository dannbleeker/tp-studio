/**
 * Edge-level mutations, composed from four focused factories under `edges/`
 * (Session 191 — split from one 561-line file, mirroring `entitiesSlice` +
 * `entities/`): connect / lifecycle, AND/OR/XOR junctors, splice gestures, and
 * polarity + attributes. The slice presented to Zustand stays ONE flat object,
 * so `useDocumentStore` selectors are unchanged.
 *
 * `addAssumptionToEdge` lives in `entitiesSlice` because its primary mutation
 * creates a new entity; the assumption-id list on the edge is a follower update.
 */

import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { makeApplyDocChange } from './docMutate';
import { createEdgeAttributeActions, type EdgeAttributeActions } from './edges/attributes';
import { type ConnectActions, createConnectActions } from './edges/connect';
import { createJunctorActions, type JunctorActions } from './edges/junctor';
import { createSpliceActions, type SpliceActions } from './edges/splice';

export type { JunctorKind } from './edges/junctor';

export type EdgesSlice = ConnectActions & JunctorActions & SpliceActions & EdgeAttributeActions;

export const createEdgesSlice: StateCreator<RootStore, [], [], EdgesSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);
  const deps = { get, set, applyDocChange };
  return {
    ...createConnectActions(deps),
    ...createJunctorActions(deps),
    ...createSpliceActions(deps),
    ...createEdgeAttributeActions(deps),
  };
};
