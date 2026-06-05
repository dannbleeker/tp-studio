import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommentThread } from '@/components/comments/CommentThread';
import type { Comment } from '@/domain/types';

/**
 * Session 177 — direct render tests for CommentThread (and its nested
 * CommentItem / ReplyBox). The CommentsPanel suite covers the wired-up
 * happy path; this drives the thread component in isolation with spy
 * callbacks so the reply / edit-in-place / delete / resolve / jump
 * interactions — the bulk of the file — are exercised.
 */

afterEach(cleanup);

const comment = (over: Partial<Comment> = {}): Comment => ({
  id: 'c1',
  anchor: { kind: 'document' },
  body: 'Is this the root cause?',
  author: 'Dann',
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
  ...over,
});

const handlers = () => ({
  onJump: vi.fn(),
  onReply: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onResolve: vi.fn(),
});

describe('CommentThread', () => {
  it('renders the comment body, author, and anchor label', () => {
    const { getByText } = render(
      <CommentThread
        top={comment()}
        replies={[]}
        anchorText="Root cause"
        anchorMissing={false}
        {...handlers()}
      />
    );
    expect(getByText('Is this the root cause?')).toBeTruthy();
    expect(getByText('Dann')).toBeTruthy();
    expect(getByText('Root cause')).toBeTruthy();
  });

  it('calls onJump when the anchor chip is clicked', () => {
    const h = handlers();
    const { getByText } = render(
      <CommentThread
        top={comment()}
        replies={[]}
        anchorText="Root cause"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Root cause').closest('button') as HTMLButtonElement);
    expect(h.onJump).toHaveBeenCalledTimes(1);
  });

  it('disables the anchor chip (and never jumps) when the anchor is missing', () => {
    const h = handlers();
    const { getByText } = render(
      <CommentThread
        top={comment()}
        replies={[]}
        anchorText="(deleted)"
        anchorMissing
        {...h}
      />
    );
    const btn = getByText('(deleted)').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(h.onJump).not.toHaveBeenCalled();
  });

  it('opens a reply box and submits the reply on Cmd/Ctrl+Enter', () => {
    const h = handlers();
    const { getByText, getByPlaceholderText } = render(
      <CommentThread
        top={comment({ id: 'top1' })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Reply').closest('button') as HTMLButtonElement);
    const box = getByPlaceholderText(/Reply…/);
    fireEvent.change(box, { target: { value: 'I agree' } });
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true });
    expect(h.onReply).toHaveBeenCalledWith('top1', 'I agree');
  });

  it('cancels the reply box on Escape without calling onReply', () => {
    const h = handlers();
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = render(
      <CommentThread
        top={comment({ id: 'top1' })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Reply').closest('button') as HTMLButtonElement);
    const box = getByPlaceholderText(/Reply…/);
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(queryByPlaceholderText(/Reply…/)).toBeNull();
    expect(h.onReply).not.toHaveBeenCalled();
  });

  it('calls onResolve(id, true) from the Resolve action', () => {
    const h = handlers();
    const { getByText } = render(
      <CommentThread
        top={comment({ id: 'top1' })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Resolve').closest('button') as HTMLButtonElement);
    expect(h.onResolve).toHaveBeenCalledWith('top1', true);
  });

  it('shows Reopen and calls onResolve(id, false) for a resolved thread', () => {
    const h = handlers();
    const { getByText } = render(
      <CommentThread
        top={comment({ id: 'top1', resolved: true })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Reopen').closest('button') as HTMLButtonElement);
    expect(h.onResolve).toHaveBeenCalledWith('top1', false);
  });

  it('edits a comment in place and calls onEdit with the trimmed body', () => {
    const h = handlers();
    const { getByText, getByRole } = render(
      <CommentThread
        top={comment({ id: 'top1', body: 'old' })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Edit'));
    const textarea = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  new body  ' } });
    fireEvent.click(getByText('Save').closest('button') as HTMLButtonElement);
    expect(h.onEdit).toHaveBeenCalledWith('top1', 'new body');
  });

  it('cancels an in-place edit without calling onEdit', () => {
    const h = handlers();
    const { getByText, queryByRole } = render(
      <CommentThread
        top={comment({ id: 'top1', body: 'old' })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Edit'));
    fireEvent.click(getByText('Cancel').closest('button') as HTMLButtonElement);
    expect(queryByRole('textbox')).toBeNull();
    expect(h.onEdit).not.toHaveBeenCalled();
  });

  it('calls onDelete when Delete is clicked', () => {
    const h = handlers();
    const { getByText } = render(
      <CommentThread
        top={comment({ id: 'top1' })}
        replies={[]}
        anchorText="A"
        anchorMissing={false}
        {...h}
      />
    );
    fireEvent.click(getByText('Delete'));
    expect(h.onDelete).toHaveBeenCalledWith('top1');
  });

  it('renders one-level-deep replies under the top comment', () => {
    const reply = comment({ id: 'r1', body: 'a threaded reply', parentId: 'top1', author: 'Bo' });
    const { getByText } = render(
      <CommentThread
        top={comment({ id: 'top1' })}
        replies={[reply]}
        anchorText="A"
        anchorMissing={false}
        {...handlers()}
      />
    );
    expect(getByText('a threaded reply')).toBeTruthy();
    expect(getByText('Bo')).toBeTruthy();
  });
});
