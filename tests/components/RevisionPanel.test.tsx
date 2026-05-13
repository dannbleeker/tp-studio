import { RevisionPanel } from '@/components/history/RevisionPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * H1 — Revision panel render tests. Drives the store directly to set
 * panel open state + seed snapshots, then asserts the panel reflects
 * the live state and that its action buttons (snapshot now, restore,
 * delete, rename) fire the right store mutations.
 */

describe('RevisionPanel', () => {
  it('renders off-screen (translate-x-full) when historyPanelOpen is false', () => {
    const { container } = render(<RevisionPanel />);
    const aside = container.querySelector('aside')!;
    expect(aside.className).toContain('translate-x-full');
    expect(aside.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders on-screen and lists snapshots when open', () => {
    seedEntity('A');
    act(() => useDocumentStore.getState().captureSnapshot('baseline'));
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container, getByText } = render(<RevisionPanel />);
    const aside = container.querySelector('aside')!;
    expect(aside.className).not.toContain('translate-x-full');
    expect(getByText('baseline')).toBeTruthy();
  });

  it('shows an empty-state message when the doc has no snapshots', () => {
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    expect(container.textContent).toContain('No snapshots yet');
  });

  it('Snapshot-now button captures a new revision', () => {
    seedEntity('A');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    expect(useDocumentStore.getState().revisions).toHaveLength(0);
    const btn = container.querySelector(
      'button[aria-label="Snapshot current document"]'
    ) as HTMLButtonElement;
    expect(btn).toBeTruthy();
    act(() => fireEvent.click(btn));
    expect(useDocumentStore.getState().revisions).toHaveLength(1);
  });

  it('Close-history button flips historyPanelOpen back to false', () => {
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const closeBtn = container.querySelector(
      'button[aria-label="Close history"]'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(closeBtn));
    expect(useDocumentStore.getState().historyPanelOpen).toBe(false);
  });

  it('Restore button rolls the doc back to the snapshot', () => {
    seedEntity('A');
    act(() => useDocumentStore.getState().captureSnapshot('baseline'));
    seedEntity('B');
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(2);
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const restoreBtns = container.querySelectorAll('button[aria-label="Restore snapshot"]');
    expect(restoreBtns.length).toBeGreaterThan(0);
    act(() => fireEvent.click(restoreBtns[0]!));
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(1);
  });

  it('Delete button prompts and removes when confirmed', async () => {
    seedEntity('A');
    act(() => useDocumentStore.getState().captureSnapshot('drop me'));
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const del = container.querySelector(
      'button[aria-label="Delete snapshot"]'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(del));
    // The click opens an async confirm via the store. Wait one tick so
    // the `useDocumentStore.confirm()` Promise has resolved its state
    // update, then settle it with `true`.
    await new Promise((r) => setTimeout(r, 0));
    expect(useDocumentStore.getState().confirmDialog).not.toBeNull();
    act(() => useDocumentStore.getState().resolveConfirm(true));
    await new Promise((r) => setTimeout(r, 0));
    expect(useDocumentStore.getState().revisions).toHaveLength(0);
  });

  it('Rename pencil flips to an input and Enter commits the new label', () => {
    seedEntity('A');
    const id = useDocumentStore.getState().captureSnapshot('old');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const pencil = container.querySelector(
      'button[aria-label="Rename snapshot"]'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(pencil));
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => fireEvent.change(input, { target: { value: 'fresh' } }));
    act(() => fireEvent.keyDown(input, { key: 'Enter' }));
    expect(useDocumentStore.getState().revisions.find((r) => r.id === id)?.label).toBe('fresh');
  });
});
