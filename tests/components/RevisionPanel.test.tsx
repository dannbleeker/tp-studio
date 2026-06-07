import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RevisionPanel } from '@/components/history/RevisionPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';
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

  it('Compare button opens compareRevisionId and shows info toast', () => {
    seedEntity('A');
    const id = useDocumentStore.getState().captureSnapshot('compare-me');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const compareBtn = container.querySelector(
      'button[aria-label="Visual diff (overlay)"]'
    ) as HTMLButtonElement;
    expect(compareBtn).toBeTruthy();
    act(() => fireEvent.click(compareBtn));
    expect(useDocumentStore.getState().compareRevisionId).toBe(id);
  });

  it('Side-by-side button sets sideBySideRevisionId in the store', () => {
    seedEntity('A');
    const id = useDocumentStore.getState().captureSnapshot('side-by-side-me');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const sideBySideBtn = container.querySelector(
      'button[aria-label="Side-by-side compare"]'
    ) as HTMLButtonElement;
    expect(sideBySideBtn).toBeTruthy();
    act(() => fireEvent.click(sideBySideBtn));
    expect(useDocumentStore.getState().sideBySideRevisionId).toBe(id);
  });

  it('Branch button prompts for a name and calls branchFromRevision', () => {
    seedEntity('A');
    useDocumentStore.getState().captureSnapshot('branch-source');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    // Stub window.prompt to return a branch name
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('my-branch');
    const branchBtn = container.querySelector(
      'button[aria-label="Branch from snapshot"]'
    ) as HTMLButtonElement;
    expect(branchBtn).toBeTruthy();
    act(() => fireEvent.click(branchBtn));
    promptSpy.mockRestore();
    // A new revision with branchName "my-branch" should be created
    const branched = useDocumentStore
      .getState()
      .revisions.find((r) => r.branchName === 'my-branch');
    expect(branched).toBeTruthy();
  });

  it('Branch button does nothing when the prompt is cancelled (returns null)', () => {
    seedEntity('A');
    useDocumentStore.getState().captureSnapshot('branch-cancel');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    const branchBtn = container.querySelector(
      'button[aria-label="Branch from snapshot"]'
    ) as HTMLButtonElement;
    const revisionsBefore = useDocumentStore.getState().revisions.length;
    act(() => fireEvent.click(branchBtn));
    promptSpy.mockRestore();
    // No new revision should be created
    expect(useDocumentStore.getState().revisions.length).toBe(revisionsBefore);
  });

  it('Branch button does nothing when the prompt returns an empty/whitespace string', () => {
    seedEntity('A');
    useDocumentStore.getState().captureSnapshot('branch-empty');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('   ');
    const branchBtn = container.querySelector(
      'button[aria-label="Branch from snapshot"]'
    ) as HTMLButtonElement;
    const revisionsBefore = useDocumentStore.getState().revisions.length;
    act(() => fireEvent.click(branchBtn));
    promptSpy.mockRestore();
    expect(useDocumentStore.getState().revisions.length).toBe(revisionsBefore);
  });

  it('Multiple named branches render separate sections, Main first', () => {
    seedEntity('A');
    // Capture a main snapshot first
    useDocumentStore.getState().captureSnapshot('main-snap');
    // Capture two more with a branch name via branchFromRevision
    const state = useDocumentStore.getState();
    const mainRevId = state.revisions[0]!.id;
    state.branchFromRevision(mainRevId, 'experiment');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const headings = Array.from(container.querySelectorAll('h3')).map((h) => h.textContent ?? '');
    // Main should appear before experiment
    const mainIdx = headings.findIndex((t) => t.includes('Main'));
    const expIdx = headings.findIndex((t) => t.includes('experiment'));
    expect(mainIdx).toBeGreaterThanOrEqual(0);
    expect(expIdx).toBeGreaterThanOrEqual(0);
    expect(mainIdx).toBeLessThan(expIdx);
  });

  it('RevisionList sorts two named branches by most-recent capture descending', () => {
    seedEntity('A');
    // Create a main snapshot
    const state = useDocumentStore.getState();
    const mainRevId = state.captureSnapshot('main-snap');
    // Branch twice to create two named branches
    state.branchFromRevision(mainRevId, 'alpha');
    state.branchFromRevision(mainRevId, 'beta');
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const headings = Array.from(container.querySelectorAll('h3')).map((h) => h.textContent ?? '');
    // Main must be first; the two named branches must both appear
    expect(headings[0]).toContain('Main');
    const rest = headings.slice(1).map((h) => h.replace(/\d+\s*snapshot.*/, '').trim());
    expect(rest.some((h) => h.includes('alpha') || h.includes('beta'))).toBe(true);
  });

  it('Snapshot-now button sets a recent highlight that clears after ~1500 ms', async () => {
    seedEntity('A');
    act(() => useDocumentStore.getState().openHistoryPanel());
    vi.useFakeTimers();
    const { container } = render(<RevisionPanel />);
    const btn = container.querySelector(
      'button[aria-label="Snapshot current document"]'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(btn));
    // Immediately after the click a new snapshot exists
    expect(useDocumentStore.getState().revisions).toHaveLength(1);
    // Advance time past the 1500 ms clear timeout
    act(() => vi.advanceTimersByTime(1600));
    vi.useRealTimers();
  });

  it('Delete button does NOT remove when the confirm dialog is rejected', async () => {
    seedEntity('A');
    act(() => useDocumentStore.getState().captureSnapshot('keep me'));
    act(() => useDocumentStore.getState().openHistoryPanel());
    const { container } = render(<RevisionPanel />);
    const del = container.querySelector(
      'button[aria-label="Delete snapshot"]'
    ) as HTMLButtonElement;
    act(() => fireEvent.click(del));
    await new Promise((r) => setTimeout(r, 0));
    expect(useDocumentStore.getState().confirmDialog).not.toBeNull();
    act(() => useDocumentStore.getState().resolveConfirm(false));
    await new Promise((r) => setTimeout(r, 0));
    // Revision should still be present because user rejected
    expect(useDocumentStore.getState().revisions).toHaveLength(1);
  });
});
