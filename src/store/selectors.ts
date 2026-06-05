/**
 * Store-level selectors.
 *
 * Session 137 / multi-doc tabs Batch 1 — see
 * `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * `currentDoc(state)` is the active-document seam. It still returns `state.doc`:
 * multi-doc tabs (Session 138) shipped by SWAPPING `state.doc` on a tab switch,
 * not via the originally-planned `state.docs[state.activeDocId]` flip — so the
 * data model never changed and this stays a thin alias. Store-internal callers
 * (slice actions, `applyDocChange`, history / revisions) still route through the
 * seam, so if a future model ever keeps all open docs resident, swapping this one
 * body is the only edit — not a wide mechanical refactor. Some component-tree
 * consumers read `s.doc` directly; harmless while the two are identical.
 *
 * Adding a new selector here: prefer the function-call shape over a
 * field alias so the eventual multi-doc form (`state.docs[state.activeDocId].x`)
 * fits without changing call sites.
 */

import type { TPDocument } from '@/domain/types';
import type { RootStore } from './types';

/**
 * The currently-active document.
 *
 * Today returns `state.doc`. Post-multi-doc-flip will return
 * `state.docs[state.activeDocId]`. Callers should not assume which
 * variant is live — that's the seam this selector exists for.
 *
 * Note: this is a thin alias function, not a memoised selector. The
 * value is whatever `state.doc` points at; React-Flow / Zustand
 * subscribers don't need memoisation here because the reference
 * stability of `state.doc` is already maintained by `applyDocChange`'s
 * no-op short-circuit (`next === prev` returns without writing).
 */
export const currentDoc = (state: Pick<RootStore, 'doc'>): TPDocument => state.doc;
