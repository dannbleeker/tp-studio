/**
 * Store-level selectors.
 *
 * Session 137 / multi-doc tabs Batch 1 — see
 * `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * Today this module exports a single selector, `currentDoc(state)`, which
 * is an alias for `state.doc`. Behaviour is unchanged.
 *
 * The reason this seam exists *before* multi-doc tabs ship: Phase 2 of
 * the plan introduces `state.docs: Record<DocumentId, TPDocument>` +
 * `state.activeDocId: DocumentId`. At that point `currentDoc(state)`
 * becomes `state.docs[state.activeDocId]`. Store-internal callers
 * (slice actions, `applyDocChange`, history / revisions) route through
 * this selector now so the data-model flip in Phase 2 is a one-line
 * edit on the selector body rather than a 200-site mechanical refactor.
 *
 * Component-tree consumers (Canvas, Inspector, dialogs, palette
 * commands) keep reading `s.doc` directly for now — they migrate in
 * Phase 4 once the data model has been flipped behind the alias. The
 * derived-alias strategy is what lets us phase the rollout without
 * breaking the test suite at any intermediate step.
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
