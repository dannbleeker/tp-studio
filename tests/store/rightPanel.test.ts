import { beforeEach, describe, expect, it } from 'vitest';
import type { EntityId } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * The right-edge slot is shared by History + Comments + the Inspector.
 * `openRightPanel` (dialogsSlice) is the single source of truth for the
 * mutual-exclusion + selection-clearing rules; these pin the contract so a
 * future third panel can't quietly break it.
 */
beforeEach(resetStoreForTest);

const st = () => useDocumentStore.getState();

describe('right-edge panel slot', () => {
  it('History and Comments are mutually exclusive', () => {
    st().openHistoryPanel();
    expect(st().historyPanelOpen).toBe(true);
    expect(st().commentsPanelOpen).toBe(false);

    // Opening Comments closes History…
    st().openCommentsPanel();
    expect(st().commentsPanelOpen).toBe(true);
    expect(st().historyPanelOpen).toBe(false);

    // …and opening History closes Comments.
    st().openHistoryPanel();
    expect(st().historyPanelOpen).toBe(true);
    expect(st().commentsPanelOpen).toBe(false);
  });

  it('opening History clears the selection (Inspector yields the column)', () => {
    useDocumentStore.setState({ selection: { kind: 'entities', ids: ['x' as EntityId] } });
    st().openHistoryPanel();
    expect(st().selection).toEqual({ kind: 'none' });
  });

  it('opening Comments preserves the selection (composer anchors to it)', () => {
    useDocumentStore.setState({ selection: { kind: 'entities', ids: ['y' as EntityId] } });
    st().openCommentsPanel();
    expect(st().selection).toEqual({ kind: 'entities', ids: ['y'] });
  });

  it('toggle closes the open panel and clears the pending comment anchor', () => {
    st().startCommentAt({ kind: 'point', x: 1, y: 2 });
    expect(st().commentsPanelOpen).toBe(true);
    expect(st().pendingCommentAnchor).not.toBeNull();

    st().toggleCommentsPanel();
    expect(st().commentsPanelOpen).toBe(false);
    expect(st().pendingCommentAnchor).toBeNull();
  });
});
