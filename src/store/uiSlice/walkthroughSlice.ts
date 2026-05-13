import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';

/**
 * Walkthrough overlays — guided pass through a document. Two flavors share
 * the same state shape because they both step through an ordered list of
 * targets with a single current index:
 *
 *   - **`'read-through'`** — visits each edge in topological causal order
 *     and renders the canonical sentence ("[Effect] because [Cause]" or
 *     "In order to obtain [Effect], [Cause] must hold"). Forces the user
 *     (or audience) to verbalize every causal step.
 *   - **`'clr-walkthrough'`** — visits each open CLR warning and prompts
 *     the user to address / skip / resolve. Distinct from the on-demand
 *     WarningsList in the Inspector: the wizard insists you look at every
 *     one in turn.
 *
 * Closed-state representation: `kind: 'closed'`. Opening the overlay sets
 * `index: 0` and stamps the ordered ids list at start time so subsequent
 * edits to the doc don't shift the walkthrough's position. Esc / Done
 * close.
 */

export type WalkthroughKind = 'read-through' | 'clr-walkthrough';

export type WalkthroughState =
  | { kind: 'closed' }
  | {
      kind: WalkthroughKind;
      index: number;
      /** For read-through: edge ids in topological order.
       *  For clr-walkthrough: warning ids in `validate()` order. */
      targetIds: string[];
    };

export type WalkthroughSlice = {
  walkthrough: WalkthroughState;
  startReadThrough: (edgeIds: string[]) => void;
  startClrWalkthrough: (warningIds: string[]) => void;
  walkthroughNext: () => void;
  walkthroughPrev: () => void;
  closeWalkthrough: () => void;
};

export type WalkthroughDataKeys = 'walkthrough';

export const walkthroughDefaults = (): Pick<WalkthroughSlice, WalkthroughDataKeys> => ({
  walkthrough: { kind: 'closed' },
});

export const createWalkthroughSlice: StateCreator<RootStore, [], [], WalkthroughSlice> = (
  set,
  get
) => ({
  walkthrough: { kind: 'closed' },
  startReadThrough: (edgeIds) =>
    set({
      walkthrough: { kind: 'read-through', index: 0, targetIds: edgeIds },
    }),
  startClrWalkthrough: (warningIds) =>
    set({
      walkthrough: { kind: 'clr-walkthrough', index: 0, targetIds: warningIds },
    }),
  walkthroughNext: () => {
    const w = get().walkthrough;
    if (w.kind === 'closed') return;
    if (w.index >= w.targetIds.length - 1) {
      set({ walkthrough: { kind: 'closed' } });
      return;
    }
    set({ walkthrough: { ...w, index: w.index + 1 } });
  },
  walkthroughPrev: () => {
    const w = get().walkthrough;
    if (w.kind === 'closed') return;
    if (w.index <= 0) return;
    set({ walkthrough: { ...w, index: w.index - 1 } });
  },
  closeWalkthrough: () => set({ walkthrough: { kind: 'closed' } }),
});
