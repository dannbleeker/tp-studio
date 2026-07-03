import { useEffect, useRef } from 'react';
import { resolveCloudState } from '@/domain/cloudResolution';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * Session 195 easter egg — the cloud that actually evaporates.
 *
 * Watches the active EC doc and, on the rising edge of "the conflict arrow
 * just got broken by an implemented injection" (`resolveCloudState`), plays
 * the one-shot evaporation effect on the two Want boxes + a congratulatory
 * toast. Earned, not triggered: it fires only when the user completes the
 * method properly, which is the whole joke.
 *
 * Rising-edge contract:
 *   - The first observation of a doc (mount OR tab switch — baseline keyed by
 *     doc id) records state without firing, so re-opening an already-broken
 *     cloud replays nothing and no persisted "celebrated" flag is needed.
 *   - Un-implementing then re-implementing the injection re-arms the effect.
 */
export const useCloudEvaporation = (doc: TPDocument): void => {
  const baseline = useRef<{ docId: string; resolved: boolean } | null>(null);

  useEffect(() => {
    const state = resolveCloudState(doc);
    const prev = baseline.current;
    baseline.current = { docId: doc.id, resolved: state.resolved };
    if (!prev || prev.docId !== doc.id) return;
    if (!state.resolved || prev.resolved) return;
    const s = useDocumentStore.getState();
    s.triggerCloudEvaporation(state.wantIds);
    s.showToast('success', 'You evaporated the cloud. Goldratt would be proud.');
  }, [doc]);
};
