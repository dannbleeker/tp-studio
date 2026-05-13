import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('walkthroughSlice', () => {
  it('starts read-through with the supplied edge id list at index 0', () => {
    useDocumentStore.getState().startReadThrough(['e1', 'e2', 'e3']);
    expect(useDocumentStore.getState().walkthrough).toEqual({
      kind: 'read-through',
      index: 0,
      targetIds: ['e1', 'e2', 'e3'],
    });
  });

  it('starts CLR walkthrough with warning ids', () => {
    useDocumentStore.getState().startClrWalkthrough(['w1', 'w2']);
    const w = useDocumentStore.getState().walkthrough;
    expect(w.kind).toBe('clr-walkthrough');
    if (w.kind === 'clr-walkthrough') expect(w.targetIds).toEqual(['w1', 'w2']);
  });

  it('walkthroughNext advances the index', () => {
    const s = useDocumentStore.getState();
    s.startReadThrough(['a', 'b', 'c']);
    s.walkthroughNext();
    const w = useDocumentStore.getState().walkthrough;
    if (w.kind === 'read-through') expect(w.index).toBe(1);
  });

  it('walkthroughNext on the last index closes the walkthrough', () => {
    const s = useDocumentStore.getState();
    s.startReadThrough(['a', 'b']);
    s.walkthroughNext();
    s.walkthroughNext();
    expect(useDocumentStore.getState().walkthrough).toEqual({ kind: 'closed' });
  });

  it('walkthroughPrev decrements but clamps at 0', () => {
    const s = useDocumentStore.getState();
    s.startReadThrough(['a', 'b', 'c']);
    s.walkthroughNext();
    s.walkthroughNext();
    s.walkthroughPrev();
    const w = useDocumentStore.getState().walkthrough;
    if (w.kind === 'read-through') expect(w.index).toBe(1);
    s.walkthroughPrev();
    s.walkthroughPrev();
    // Clamp — still index 0, not negative.
    const w2 = useDocumentStore.getState().walkthrough;
    if (w2.kind === 'read-through') expect(w2.index).toBe(0);
  });

  it('closeWalkthrough resets to closed regardless of state', () => {
    const s = useDocumentStore.getState();
    s.startReadThrough(['a']);
    s.closeWalkthrough();
    expect(useDocumentStore.getState().walkthrough).toEqual({ kind: 'closed' });
  });
});
