import type { StateCreator } from 'zustand';
import type { EntityState } from '@/domain/types';
import type { RootStore } from '../types';

/**
 * Session 135 / spec major gap #4 Phase 1C — what-if speculation
 * overlay.
 *
 * Lets the user ask "what changes downstream if this assumption were
 * false?" without committing the change. The overlay is a map of
 * speculative entity states layered on top of the persisted manual
 * states; the propagation engine (`propagateStates(doc, overrides)`)
 * flows them through the graph so the canvas + inspector preview the
 * cascade. Nothing touches the doc until the user commits.
 *
 * State shape:
 *   - `speculationOverlay === null` — NOT speculating (the default).
 *   - `speculationOverlay === {}` — speculating, no overrides picked yet
 *     (the banner is up, the user is about to click entities).
 *   - `speculationOverlay === { id: state, … }` — active hypotheticals.
 *
 * The overlay is UI-only: not persisted to localStorage, not pushed to
 * the undo history, and reset by `resetStoreForTest`. Committing writes
 * the overrides into `entity.state` via the bulk `setEntityStates`
 * action (ONE undo step), then exits. Reverting just drops the overlay.
 */
export type SpeculationSlice = {
  /** `null` when not speculating; otherwise the active override map. */
  speculationOverlay: Record<string, EntityState> | null;
  /** Enter speculation mode with an empty overlay (no overrides yet). */
  beginSpeculation: () => void;
  /** Set (or replace) one entity's speculative state. Auto-enters
   *  speculation mode if not already in it. Passing `undefined` removes
   *  the entity's override (see `clearSpeculativeState`). */
  setSpeculativeState: (entityId: string, state: EntityState | undefined) => void;
  /** Remove one entity's override. Stays in speculation mode (the
   *  overlay can be empty). No-op when not speculating. */
  clearSpeculativeState: (entityId: string) => void;
  /** Exit speculation, discarding every override. */
  revertSpeculation: () => void;
  /** Write every override into the persisted `entity.state` (one undo
   *  step) and exit speculation. No-op when not speculating or the
   *  overlay is empty (just exits). */
  commitSpeculation: () => void;
};

export type SpeculationDataKeys = 'speculationOverlay';

export const speculationDefaults = (): Pick<SpeculationSlice, SpeculationDataKeys> => ({
  speculationOverlay: null,
});

export const createSpeculationSlice: StateCreator<RootStore, [], [], SpeculationSlice> = (
  set,
  get
) => ({
  speculationOverlay: null,

  beginSpeculation: () => {
    if (get().speculationOverlay !== null) return;
    set({ speculationOverlay: {} });
  },

  setSpeculativeState: (entityId, state) => {
    const cur = get().speculationOverlay ?? {};
    // Clearing via `undefined` routes through the same drop logic.
    if (state === undefined) {
      if (!(entityId in cur)) {
        // Nothing to clear — but still ensure we're in speculation mode
        // so the banner shows (the user explicitly invoked a state pick).
        if (get().speculationOverlay === null) set({ speculationOverlay: {} });
        return;
      }
      const { [entityId]: _drop, ...rest } = cur;
      set({ speculationOverlay: rest });
      return;
    }
    set({ speculationOverlay: { ...cur, [entityId]: state } });
  },

  clearSpeculativeState: (entityId) => {
    const cur = get().speculationOverlay;
    if (!cur || !(entityId in cur)) return;
    const { [entityId]: _drop, ...rest } = cur;
    set({ speculationOverlay: rest });
  },

  revertSpeculation: () => {
    if (get().speculationOverlay === null) return;
    set({ speculationOverlay: null });
  },

  commitSpeculation: () => {
    const overlay = get().speculationOverlay;
    if (overlay === null) return;
    const entries = Object.entries(overlay).map(([id, state]) => ({ id, state }));
    if (entries.length > 0) get().setEntityStates(entries);
    set({ speculationOverlay: null });
  },
});
