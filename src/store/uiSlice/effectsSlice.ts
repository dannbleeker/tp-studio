import type { StateCreator } from 'zustand';
import type { EntityId } from '@/domain/types';
import type { RootStore } from '../types';

/**
 * Transient one-shot canvas effects — state that exists only for the length
 * of an animation. First (and so far only) resident: the cloud-evaporation
 * celebration (Session 195 easter egg). Kept out of `dialogsSlice` because
 * nothing here is modal-ish; kept out of the doc slices because nothing here
 * persists or belongs to history.
 */
export type EffectsSlice = {
  /** Entity ids currently playing the evaporation animation, or `null` when
   *  idle. TPNode reads membership to attach the CSS animation class. */
  evaporatingEntityIds: EntityId[] | null;
  /** Kick off the evaporation effect on the given entities and auto-clear
   *  once the CSS animation has comfortably finished. Re-triggering while
   *  active restarts the window (last timer wins on clear). */
  triggerCloudEvaporation: (ids: EntityId[]) => void;
};

export type EffectsDataKeys = 'evaporatingEntityIds';

export const effectsDefaults = (): Pick<EffectsSlice, EffectsDataKeys> => ({
  evaporatingEntityIds: null,
});

/**
 * Slightly longer than the CSS `tp-evaporate` duration (2400ms at default
 * --anim-speed) so the class is removed only after the animation settles.
 * Under reduced motion the animation collapses to 0ms and the class is a
 * visual no-op for its lifetime, so the longer JS window is harmless.
 */
const EVAPORATION_CLEAR_MS = 2800;

export const createEffectsSlice: StateCreator<RootStore, [], [], EffectsSlice> = (set, get) => ({
  evaporatingEntityIds: null,

  triggerCloudEvaporation: (ids) => {
    if (ids.length === 0) return;
    set({ evaporatingEntityIds: ids });
    const started = ids;
    setTimeout(() => {
      // Only clear our own trigger — a re-trigger replaced the array
      // reference and owns its own timer.
      if (get().evaporatingEntityIds === started) set({ evaporatingEntityIds: null });
    }, EVAPORATION_CLEAR_MS);
  },
});
