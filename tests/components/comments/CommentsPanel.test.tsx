import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CommentsPanel } from '@/components/comments/CommentsPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

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
});
