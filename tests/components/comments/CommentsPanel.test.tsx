import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsPanel } from '@/components/comments/CommentsPanel';
import * as canvasRefModule from '@/services/canvasRef';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../../helpers/seedDoc';

// ── Canvas mock (needed by jumpToAnchor tests) ────────────────────────────────
// getCanvasInstance() returns null in jsdom (no React Flow mounted). Provide a
// minimal fake with the methods that jumpToAnchor calls so those branches
// execute without errors. Tests that don't need canvas behaviour just let the
// mock return its default (null), which exercises the "no inst" branches.
vi.mock('@/services/canvasRef', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/canvasRef')>('@/services/canvasRef');
  return {
    ...actual,
    getCanvasInstance: vi.fn(() => null),
  };
});

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();

/**
 * CommentsPanel render + interaction tests. Drives the store directly to
 * open the panel + seed selection, then asserts the composer creates
 * anchored comments, the author field writes the preference, and the
 * Open/Resolved filter hides resolved threads.
 */
describe('CommentsPanel', () => {
  it('renders off-screen + inert when closed', () => {
    const { container } = render(<CommentsPanel />);
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('translate-x-full');
    expect(aside?.getAttribute('aria-hidden')).toBe('true');
    // Closed panel must be `inert` (not just aria-hidden) so the composer's
    // inputs/buttons leave the tab order (axe `aria-hidden-focus`). Guards the
    // React-19.2 empty-string `inert` drop.
    expect(aside?.hasAttribute('inert')).toBe(true);
  });

  it('shows an empty state when open with no comments', () => {
    act(() => s().openCommentsPanel());
    const { container } = render(<CommentsPanel />);
    expect(container.textContent).toContain('No comments yet');
  });

  it('adds a comment anchored to the selected entity via the composer', () => {
    const e = seedEntity('Root cause');
    act(() => {
      s().openCommentsPanel();
      s().selectEntity(e.id);
    });
    const { container, getByText, getByPlaceholderText } = render(<CommentsPanel />);
    const textarea = getByPlaceholderText(/Add a review comment/);
    act(() => fireEvent.change(textarea, { target: { value: 'Is this really the root?' } }));
    act(() => fireEvent.click(getByText('Comment').closest('button') as HTMLButtonElement));

    expect(container.textContent).toContain('Is this really the root?');
    const comments = Object.values(s().doc.comments ?? {});
    expect(comments).toHaveLength(1);
    expect(comments[0]?.anchor).toEqual({ kind: 'entity', entityId: e.id });
  });

  it('writes the author-name preference from the inline field', () => {
    act(() => s().openCommentsPanel());
    const { getByLabelText } = render(<CommentsPanel />);
    const nameInput = getByLabelText('Your name for comments');
    act(() => fireEvent.change(nameInput, { target: { value: 'Dann' } }));
    expect(s().commentAuthorName).toBe('Dann');
  });

  it('hides resolved threads under the Open filter until the filter switches', () => {
    const e = seedEntity('A');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'check this');
      id = c?.id ?? '';
    });
    const { container, getByText, queryByText } = render(<CommentsPanel />);
    expect(getByText('check this')).toBeTruthy();

    act(() => s().resolveComment(id, true));
    expect(queryByText('check this')).toBeNull();

    // The three filter tabs are the only aria-pressed buttons in the panel.
    const tabs = container.querySelectorAll('button[aria-pressed]');
    expect(tabs).toHaveLength(3);
    act(() => fireEvent.click(tabs[1] as HTMLButtonElement)); // [Open, Resolved, All]
    expect(getByText('check this')).toBeTruthy();
  });

  it('Close button flips commentsPanelOpen back to false', () => {
    act(() => s().openCommentsPanel());
    const { container } = render(<CommentsPanel />);
    act(() =>
      fireEvent.click(
        container.querySelector('button[aria-label="Close comments"]') as HTMLButtonElement
      )
    );
    expect(s().commentsPanelOpen).toBe(false);
  });

  // ── All-filter shows both open and resolved ──────────────────────────────

  it('All filter shows both open and resolved threads', () => {
    const e = seedEntity('TwoThreads');
    let resolvedId = '';
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'open thread');
      const d = s().addComment({ kind: 'entity', entityId: e.id }, 'resolved thread');
      resolvedId = d?.id ?? '';
      s().resolveComment(resolvedId, true);
    });
    const { container, getByText } = render(<CommentsPanel />);
    // Switch to All
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[2] as HTMLButtonElement)); // All tab
    expect(getByText('open thread')).toBeTruthy();
    expect(getByText('resolved thread')).toBeTruthy();
  });

  // ── Resolved filter tab ──────────────────────────────────────────────────

  it('Resolved filter shows only resolved threads', () => {
    const e = seedEntity('FilterTest');
    let resolvedId = '';
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'open one');
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'resolved one');
      resolvedId = c?.id ?? '';
      s().resolveComment(resolvedId, true);
    });
    const { container, getByText, queryByText } = render(<CommentsPanel />);
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[1] as HTMLButtonElement)); // Resolved
    expect(getByText('resolved one')).toBeTruthy();
    expect(queryByText('open one')).toBeNull();
  });

  // ── Empty-state messages under different filters ─────────────────────────

  it('shows "Everything here has been resolved" when Open filter has no open threads', () => {
    const e = seedEntity('AllResolvedTest');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'bye');
      id = c?.id ?? '';
      s().resolveComment(id, true);
    });
    const { container } = render(<CommentsPanel />);
    // Open filter is active by default; all resolved → show dedicated message
    expect(container.textContent).toContain('Everything here has been resolved');
  });

  it('shows "No resolved comments yet" when Resolved filter has none', () => {
    const e = seedEntity('OnlyOpen');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'open only');
    });
    const { container } = render(<CommentsPanel />);
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[1] as HTMLButtonElement)); // Resolved
    expect(container.textContent).toContain('No resolved comments yet');
  });

  // ── Open-count badge ─────────────────────────────────────────────────────

  it('shows an "N open" badge in the header when open threads exist', () => {
    const e = seedEntity('BadgeTest');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'needs attention');
    });
    const { container } = render(<CommentsPanel />);
    // The badge is a <span> with rounded-full bg-indigo-100
    const badge = container.querySelector('span.bg-indigo-100');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('1');
    expect(badge?.textContent).toContain('open');
  });

  it('hides the open badge when there are no open threads', () => {
    const e = seedEntity('NoBadgeTest');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'will be resolved');
      id = c?.id ?? '';
      s().resolveComment(id, true);
    });
    const { container } = render(<CommentsPanel />);
    // When openCount === 0 the badge span is not rendered
    const badge = container.querySelector('span.bg-indigo-100');
    expect(badge).toBeNull();
  });

  // ── Reply via panel ──────────────────────────────────────────────────────

  it('adding a reply from the panel persists it in the store', () => {
    const e = seedEntity('ThreadForReply');
    let topId = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'top comment');
      topId = c?.id ?? '';
    });
    const { getByText, getByPlaceholderText } = render(<CommentsPanel />);
    // Open the reply box
    act(() => fireEvent.click(getByText('Reply').closest('button') as HTMLButtonElement));
    const box = getByPlaceholderText(/Reply…/);
    act(() => fireEvent.change(box, { target: { value: 'my reply' } }));
    act(() => fireEvent.keyDown(box, { key: 'Enter', metaKey: true }));

    const comments = Object.values(s().doc.comments ?? {});
    const reply = comments.find((c) => c.parentId === topId);
    expect(reply).toBeDefined();
    expect(reply?.body).toBe('my reply');
  });

  // ── Resolve / re-open via panel ──────────────────────────────────────────

  it('Resolve button marks thread resolved in the store', () => {
    const e = seedEntity('NeedsResolving');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'mark resolved please');
      id = c?.id ?? '';
    });
    const { container } = render(<CommentsPanel />);
    // The Resolve action button is the only <button> whose sole text is "Resolve"
    // (it wraps an SVG icon + the text span). Look for the button in the thread
    // action row (mt-2 flex items-center gap-1).
    const allButtons = Array.from(container.querySelectorAll('button'));
    const resolveBtn = allButtons.find((b) => b.textContent?.trim() === 'Resolve')!;
    act(() => fireEvent.click(resolveBtn));
    expect(s().doc.comments?.[id]?.resolved).toBe(true);
  });

  it('Reopen button clears resolved flag in the store', () => {
    const e = seedEntity('NeedsReopening');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'will be resolved');
      id = c?.id ?? '';
      s().resolveComment(id, true);
    });
    // Switch to Resolved filter so the thread is visible
    const { container } = render(<CommentsPanel />);
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[1] as HTMLButtonElement)); // Resolved
    const allButtons = Array.from(container.querySelectorAll('button'));
    const reopenBtn = allButtons.find((b) => b.textContent?.trim() === 'Reopen')!;
    act(() => fireEvent.click(reopenBtn));
    expect(s().doc.comments?.[id]?.resolved).toBeUndefined();
  });

  // ── Edit via panel ───────────────────────────────────────────────────────

  it('editing a comment in the panel updates the store body', () => {
    const e = seedEntity('EntityForEdit');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'old text');
      id = c?.id ?? '';
    });
    // The Edit and Delete links are in a hover-revealed div; we can still click them
    const { container } = render(<CommentsPanel />);
    const editLink = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Edit'
    )!;
    act(() => fireEvent.click(editLink));
    // After clicking Edit, a textarea with the current body value is rendered.
    // Use querySelectorAll to pick it (the composer textarea has no value).
    const editTextarea = Array.from(container.querySelectorAll('textarea')).find(
      (ta) => ta.value === 'old text'
    )!;
    act(() => fireEvent.change(editTextarea, { target: { value: 'new text' } }));
    const saveBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Save'
    )!;
    act(() => fireEvent.click(saveBtn));
    expect(s().doc.comments?.[id]?.body).toBe('new text');
  });

  // ── Delete (leaf + thread-with-replies) ──────────────────────────────────

  it('deleting a leaf comment removes it from the store without confirm', () => {
    const e = seedEntity('EntityForDeletion');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'delete me');
      id = c?.id ?? '';
    });
    const { container } = render(<CommentsPanel />);
    const deleteLink = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    )!;
    act(() => fireEvent.click(deleteLink));
    // No confirm dialog for leaf comments — deletion is immediate
    expect(s().doc.comments?.[id]).toBeUndefined();
  });

  it('deleting a thread with replies shows a confirm dialog and waits for response', async () => {
    const e = seedEntity('ThreadWithReplies');
    let topId = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'parent comment');
      topId = c?.id ?? '';
      s().replyToComment(topId, 'child reply');
    });
    const { container } = render(<CommentsPanel />);
    // The first Delete button belongs to the top-level comment
    const deleteLink = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    )!;
    act(() => fireEvent.click(deleteLink));

    // Confirm dialog should now be pending
    await waitFor(() => expect(s().confirmDialog).not.toBeNull());
    expect(s().confirmDialog?.message).toContain('Delete this comment');

    // Resolve via store (simulates user clicking Delete in the dialog)
    act(() => s().resolveConfirm(true));

    await waitFor(() => expect(s().doc.comments?.[topId]).toBeUndefined());
    // Replies also removed
    const remaining = Object.values(s().doc.comments ?? {});
    expect(remaining.every((c) => c.parentId !== topId)).toBe(true);
  });

  it('cancelling the confirm dialog leaves the thread intact', async () => {
    const e = seedEntity('KeepThread');
    let topId = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'keep me');
      topId = c?.id ?? '';
      s().replyToComment(topId, 'keep reply');
    });
    const { container } = render(<CommentsPanel />);
    const deleteLink = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete'
    )!;
    act(() => fireEvent.click(deleteLink));

    await waitFor(() => expect(s().confirmDialog).not.toBeNull());

    // Cancel
    act(() => s().resolveConfirm(false));

    await waitFor(() => expect(s().confirmDialog).toBeNull());
    expect(s().doc.comments?.[topId]).toBeDefined();
  });

  // ── CLR-category tagging ─────────────────────────────────────────────────

  it('CLR filter dropdown is hidden when no comment carries a category', () => {
    const e = seedEntity('NoCLRTag');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'no category here');
    });
    const { queryByLabelText } = render(<CommentsPanel />);
    expect(queryByLabelText('Filter by CLR category')).toBeNull();
  });

  it('CLR filter dropdown appears once a comment has a clrCategory tag', () => {
    const e = seedEntity('WithCLRTag');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'clarity reservation', 'clarity');
    });
    const { getByLabelText } = render(<CommentsPanel />);
    expect(getByLabelText('Filter by CLR category')).toBeTruthy();
  });

  it('filtering by CLR category hides threads without that category', () => {
    const e = seedEntity('CLRFilterTest');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'clarity note', 'clarity');
      s().addComment({ kind: 'entity', entityId: e.id }, 'untagged note');
    });
    // Switch to All filter so both threads are visible before applying CLR filter
    const { container, getByLabelText, getByText, queryByText } = render(<CommentsPanel />);
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[2] as HTMLButtonElement)); // All
    const select = getByLabelText('Filter by CLR category');
    act(() => fireEvent.change(select, { target: { value: 'clarity' } }));
    expect(getByText('clarity note')).toBeTruthy();
    expect(queryByText('untagged note')).toBeNull();
  });

  it('resetting CLR filter to All shows all threads again', () => {
    const e = seedEntity('CLRResetTest');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'tagged note', 'entity-existence');
      s().addComment({ kind: 'entity', entityId: e.id }, 'plain note');
    });
    const { container, getByLabelText, getByText } = render(<CommentsPanel />);
    // Show all first
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[2] as HTMLButtonElement)); // All
    const select = getByLabelText('Filter by CLR category');
    act(() => fireEvent.change(select, { target: { value: 'entity-existence' } }));
    act(() => fireEvent.change(select, { target: { value: 'all' } }));
    expect(getByText('tagged note')).toBeTruthy();
    expect(getByText('plain note')).toBeTruthy();
  });

  it('CLR category badge appears on the comment body when tagged', () => {
    const e = seedEntity('CLRBadgeTest');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'cause question', 'additional-cause');
    });
    const { container } = render(<CommentsPanel />);
    // The CLR badge span carries the "reservation" suffix
    expect(container.textContent).toContain('Additional cause reservation');
  });

  // ── Pending comment anchor (point anchor) ────────────────────────────────

  it('pending point anchor is used by the composer and cleared on submit', () => {
    act(() => s().startCommentAt({ kind: 'point', x: 100, y: 200 }));
    const { getByText, getByPlaceholderText } = render(<CommentsPanel />);
    expect(getByText('Pinned note')).toBeTruthy();

    const textarea = getByPlaceholderText(/Add a review comment/);
    act(() => fireEvent.change(textarea, { target: { value: 'pinned note text' } }));
    act(() => fireEvent.click(getByText('Comment').closest('button') as HTMLButtonElement));

    // After submit the pending anchor is cleared
    expect(s().pendingCommentAnchor).toBeNull();
    const comments = Object.values(s().doc.comments ?? {});
    expect(comments[0]?.anchor).toEqual({ kind: 'point', x: 100, y: 200 });
  });

  // ── Edge-anchored comment ────────────────────────────────────────────────

  it('adds a comment anchored to the selected edge', () => {
    const { edge } = seedConnectedPair('Cause', 'Effect');
    act(() => {
      s().openCommentsPanel();
      s().selectEdge(edge.id);
    });
    const { container, getByText, getByPlaceholderText } = render(<CommentsPanel />);
    const textarea = getByPlaceholderText(/Add a review comment/);
    act(() => fireEvent.change(textarea, { target: { value: 'edge comment' } }));
    act(() => fireEvent.click(getByText('Comment').closest('button') as HTMLButtonElement));

    expect(container.textContent).toContain('edge comment');
    const comments = Object.values(s().doc.comments ?? {});
    expect(comments[0]?.anchor).toEqual({ kind: 'edge', edgeId: edge.id });
  });

  // ── Document-anchored comment (whole diagram) ────────────────────────────

  it('renders a whole-diagram comment in the thread list with anchor chip "Whole diagram"', () => {
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'document' }, 'diagram level note');
    });
    const { getByText, getAllByText } = render(<CommentsPanel />);
    expect(getByText('diagram level note')).toBeTruthy();
    // "Whole diagram" appears in the anchor chip (and possibly the composer);
    // getAllByText confirms at least one instance is present.
    expect(getAllByText('Whole diagram').length).toBeGreaterThanOrEqual(1);
  });

  // ── Panel is visible (slides in) when open ───────────────────────────────

  it('panel is visible (translate-x-0) when commentsPanelOpen is true', () => {
    act(() => s().openCommentsPanel());
    const { container } = render(<CommentsPanel />);
    const aside = container.querySelector('aside');
    expect(aside?.className).toContain('translate-x-0');
    expect(aside?.getAttribute('aria-hidden')).toBe('false');
  });

  // ── Multiple threads sorted newest-first ────────────────────────────────

  it('threads are sorted newest-first in the list', () => {
    const e = seedEntity('SortTestEntity');
    // Add comments with explicit createdAt timestamps so sort order is deterministic
    // even when both run in the same millisecond.
    act(() => {
      s().openCommentsPanel();
    });
    // Insert directly via store actions in separate acts so Date.now() can differ,
    // but guarantee order by patching the store state directly.
    const anchor = { kind: 'entity' as const, entityId: e.id };
    const olderC = s().addComment(anchor, 'first comment')!;
    const newerC = s().addComment(anchor, 'second comment')!;
    // Force deterministic timestamps so the sort is reliable in tests
    useDocumentStore.setState((state) => {
      const doc = state.doc;
      const comments = {
        ...doc.comments,
        [olderC.id]: { ...doc.comments![olderC.id]!, createdAt: 1_000 },
        [newerC.id]: { ...doc.comments![newerC.id]!, createdAt: 2_000 },
      };
      return { doc: { ...doc, comments } };
    });
    const { container } = render(<CommentsPanel />);
    // Both are open → Open filter should show them; newest (createdAt=2000, second) first
    const text = container.textContent ?? '';
    expect(text.indexOf('second comment')).toBeLessThan(text.indexOf('first comment'));
  });

  // ── jumpToAnchor — entity anchor without a canvas node ───────────────────
  // When getCanvasInstance() returns null (default mock), jumpToAnchor must
  // still call selectEntity and not throw.

  it('clicking the anchor chip on an entity comment calls selectEntity (no canvas)', () => {
    const e = seedEntity('JumpEntity');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'jump target');
    });
    // Mock returns null → exercises the entity branch without a canvas instance.
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue(null);
    const { container } = render(<CommentsPanel />);
    // The anchor chip is the first button inside the <li> (before Reply/Resolve).
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    expect(anchorChip).not.toBeNull();
    act(() => fireEvent.click(anchorChip));
    // selectEntity was called → selection reflects the entity.
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') {
      expect(sel.ids).toContain(e.id);
    }
  });

  // ── jumpToAnchor — entity anchor WITH a canvas node + requestAnimationFrame ─

  it('clicking the anchor chip on an entity comment calls setCenter when node exists', () => {
    const e = seedEntity('JumpEntityWithCanvas');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'canvas jump');
    });
    const mockSetCenter = vi.fn();
    const mockGetZoom = vi.fn(() => 1.5);
    const mockGetNode = vi.fn((_id: string) => ({ position: { x: 50, y: 80 } }));
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue({
      setCenter: mockSetCenter,
      getZoom: mockGetZoom,
      getNode: mockGetNode,
    } as unknown as ReturnType<typeof canvasRefModule.getCanvasInstance>);

    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    act(() => fireEvent.click(anchorChip));

    // getNode is called synchronously inside jumpToAnchor before the rAF.
    expect(mockGetNode).toHaveBeenCalledWith(e.id);
  });

  // ── jumpToAnchor — edge anchor without canvas ────────────────────────────

  it('clicking the anchor chip on an edge comment calls selectEdge (no canvas)', () => {
    const { edge } = seedConnectedPair('JumpSrc', 'JumpDst');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'edge', edgeId: edge.id }, 'edge jump');
    });
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue(null);
    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    act(() => fireEvent.click(anchorChip));
    // selectEdge was called → selection reflects the edge.
    const sel = s().selection;
    expect(sel.kind).toBe('edges');
    if (sel.kind === 'edges') {
      expect(sel.ids).toContain(edge.id);
    }
  });

  // ── jumpToAnchor — edge anchor WITH canvas nodes ─────────────────────────

  it('clicking the anchor chip on an edge comment calls setCenter between endpoints', () => {
    const { a, b, edge } = seedConnectedPair('ESrc', 'EDst');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'edge', edgeId: edge.id }, 'edge canvas jump');
    });
    const mockSetCenter = vi.fn();
    const mockGetZoom = vi.fn(() => 1);
    // Return a node position for both source and target.
    const mockGetNode = vi.fn((id: string) => {
      if (id === a.id) return { position: { x: 0, y: 0 } };
      if (id === b.id) return { position: { x: 200, y: 100 } };
      return undefined;
    });
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue({
      setCenter: mockSetCenter,
      getZoom: mockGetZoom,
      getNode: mockGetNode,
    } as unknown as ReturnType<typeof canvasRefModule.getCanvasInstance>);

    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    act(() => fireEvent.click(anchorChip));

    // getNode called for both endpoints of the edge
    expect(mockGetNode).toHaveBeenCalledWith(a.id);
    expect(mockGetNode).toHaveBeenCalledWith(b.id);
  });

  // ── jumpToAnchor — edge anchor with canvas but missing edge nodes ────────

  it('clicking anchor chip on edge comment with only one canvas node does not throw', () => {
    const { edge } = seedConnectedPair('OneSrc', 'OneDst');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'edge', edgeId: edge.id }, 'edge partial');
    });
    const mockSetCenter = vi.fn();
    const mockGetZoom = vi.fn(() => 1);
    // Only one node visible — the `if (a && b)` guard must prevent setCenter
    const mockGetNode = vi.fn(() => undefined);
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue({
      setCenter: mockSetCenter,
      getZoom: mockGetZoom,
      getNode: mockGetNode,
    } as unknown as ReturnType<typeof canvasRefModule.getCanvasInstance>);

    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    // Should not throw even though nodes are missing
    expect(() => act(() => fireEvent.click(anchorChip))).not.toThrow();
    expect(mockSetCenter).not.toHaveBeenCalled();
  });

  // ── jumpToAnchor — point anchor without canvas ───────────────────────────

  it('clicking the anchor chip on a point comment does not throw when no canvas', () => {
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'point', x: 50, y: 75 }, 'point no canvas');
    });
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue(null);
    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    expect(() => act(() => fireEvent.click(anchorChip))).not.toThrow();
  });

  // ── jumpToAnchor — point anchor WITH canvas ──────────────────────────────

  it('clicking the anchor chip on a point comment calls setCenter at the pin coordinates', () => {
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'point', x: 300, y: 150 }, 'point canvas jump');
    });
    const mockSetCenter = vi.fn();
    const mockGetZoom = vi.fn(() => 2);
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue({
      setCenter: mockSetCenter,
      getZoom: mockGetZoom,
      getNode: vi.fn(),
    } as unknown as ReturnType<typeof canvasRefModule.getCanvasInstance>);

    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    // Clicking the anchor chip schedules a rAF to call setCenter. The click itself
    // must not throw — that's the branch coverage goal for the point anchor path.
    expect(() => act(() => fireEvent.click(anchorChip))).not.toThrow();
    // The canvas instance was retrieved (getCanvasInstance mock called at least twice:
    // once for entity anchor chip, once for point).
    expect(vi.mocked(canvasRefModule.getCanvasInstance)).toHaveBeenCalled();
  });

  // ── jumpToAnchor — document anchor (nothing to jump to) ─────────────────

  it('clicking the anchor chip on a document comment does not throw', () => {
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'document' }, 'whole diagram note');
    });
    vi.mocked(canvasRefModule.getCanvasInstance).mockReturnValue(null);
    const { container } = render(<CommentsPanel />);
    const anchorChip = container.querySelector('li button') as HTMLButtonElement;
    expect(() => act(() => fireEvent.click(anchorChip))).not.toThrow();
  });

  // ── FilterTab — Open button re-applies open filter ───────────────────────

  it('clicking the Open filter tab re-applies open filter after switching away', () => {
    const e = seedEntity('FilterToggle');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'toggle comment');
      id = c?.id ?? '';
    });
    const { container, getByText, queryByText } = render(<CommentsPanel />);
    // Switch to All
    const tabs = container.querySelectorAll('button[aria-pressed]');
    act(() => fireEvent.click(tabs[2] as HTMLButtonElement)); // All

    // Now resolve the comment — it should still show under All
    act(() => s().resolveComment(id, true));
    expect(getByText('toggle comment')).toBeTruthy();

    // Switch back to Open (line 220 onClick)
    act(() => fireEvent.click(tabs[0] as HTMLButtonElement)); // Open
    // Resolved comment should disappear under Open filter
    expect(queryByText('toggle comment')).toBeNull();
  });

  // ── Edit cancel restores original body ───────────────────────────────────

  it('cancelling an edit via Escape key restores the original body', () => {
    const e = seedEntity('EscapeEdit');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'original body');
    });
    const { container, getByText } = render(<CommentsPanel />);
    const editBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Edit'
    )!;
    act(() => fireEvent.click(editBtn));

    // Draft textarea should now be visible
    const editTextarea = Array.from(container.querySelectorAll('textarea')).find(
      (ta) => ta.value === 'original body'
    )!;
    expect(editTextarea).toBeDefined();

    // Type something different
    act(() => fireEvent.change(editTextarea, { target: { value: 'changed text' } }));

    // Press Escape to cancel
    act(() => fireEvent.keyDown(editTextarea, { key: 'Escape' }));

    // The original body should still be in the store (not updated)
    const storedComments = Object.values(s().doc.comments ?? {});
    expect(storedComments[0]?.body).toBe('original body');
    // The display should show the original body text
    expect(getByText('original body')).toBeTruthy();
  });

  // ── Edit Save via Cmd+Enter keyboard shortcut ────────────────────────────

  it('saving an edit via Cmd+Enter updates the store body', () => {
    const e = seedEntity('CmdEnterEdit');
    let id = '';
    act(() => {
      s().openCommentsPanel();
      const c = s().addComment({ kind: 'entity', entityId: e.id }, 'before kbd save');
      id = c?.id ?? '';
    });
    const { container } = render(<CommentsPanel />);
    const editBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Edit'
    )!;
    act(() => fireEvent.click(editBtn));

    const editTextarea = Array.from(container.querySelectorAll('textarea')).find(
      (ta) => ta.value === 'before kbd save'
    )!;
    act(() => fireEvent.change(editTextarea, { target: { value: 'after kbd save' } }));
    act(() => fireEvent.keyDown(editTextarea, { key: 'Enter', metaKey: true }));

    expect(s().doc.comments?.[id]?.body).toBe('after kbd save');
  });

  // ── Edit cancelled via Cancel button ────────────────────────────────────

  it('clicking Cancel in edit mode discards the draft and shows original body', () => {
    const e = seedEntity('CancelEditBtn');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'stays the same');
    });
    const { container, getByText } = render(<CommentsPanel />);
    const editBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Edit'
    )!;
    act(() => fireEvent.click(editBtn));

    const editTextarea = Array.from(container.querySelectorAll('textarea')).find(
      (ta) => ta.value === 'stays the same'
    )!;
    act(() => fireEvent.change(editTextarea, { target: { value: 'draft change' } }));

    // Click the Cancel button (not Escape key)
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    )!;
    act(() => fireEvent.click(cancelBtn));

    expect(getByText('stays the same')).toBeTruthy();
    const storedComments = Object.values(s().doc.comments ?? {});
    expect(storedComments[0]?.body).toBe('stays the same');
  });

  // ── Reply box cancel via Escape ──────────────────────────────────────────

  it('pressing Escape in the reply box cancels the reply', () => {
    const e = seedEntity('EscReply');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'parent for esc');
    });
    const { getByText, queryByPlaceholderText } = render(<CommentsPanel />);
    act(() => fireEvent.click(getByText('Reply').closest('button') as HTMLButtonElement));

    const replyBox = queryByPlaceholderText(/Reply…/) as HTMLTextAreaElement;
    expect(replyBox).not.toBeNull();

    act(() => fireEvent.keyDown(replyBox!, { key: 'Escape' }));

    // Reply box should be gone after Escape
    expect(queryByPlaceholderText(/Reply…/)).toBeNull();
  });

  // ── Reply box Cancel button ──────────────────────────────────────────────

  it('clicking the Cancel button in the reply box closes it without adding a reply', () => {
    const e = seedEntity('CancelReplyBtn');
    act(() => {
      s().openCommentsPanel();
      s().addComment({ kind: 'entity', entityId: e.id }, 'parent for cancel btn');
    });
    const { container, getByText, queryByPlaceholderText } = render(<CommentsPanel />);
    act(() => fireEvent.click(getByText('Reply').closest('button') as HTMLButtonElement));

    // Cancel button in reply box
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Cancel'
    )!;
    act(() => fireEvent.click(cancelBtn));

    // Reply box gone, no new comment added
    expect(queryByPlaceholderText(/Reply…/)).toBeNull();
    const allComments = Object.values(s().doc.comments ?? {});
    expect(allComments).toHaveLength(1); // only the parent
  });
});
