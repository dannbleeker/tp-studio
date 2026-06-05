import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommentComposer } from '@/components/comments/CommentComposer';
import type { CommentAnchor } from '@/domain/types';

/**
 * Session 177 — direct render tests for the CommentComposer. The
 * CommentsPanel suite covers the entity-anchored happy path; this drives
 * the component in isolation to reach the bits the panel test skips: the
 * "whole diagram instead" toggle, Cmd/Ctrl+Enter submit, the document-only
 * variant (no checkbox), and the empty-body guard.
 */

afterEach(cleanup);

const anchorDesc = { text: 'Root cause', missing: false };
const entityAnchor = { kind: 'entity', entityId: 'e1' } as CommentAnchor;

const renderComposer = (over: {
  anchor?: CommentAnchor;
  authorName?: string;
  onAuthorNameChange?: (name: string) => void;
  onSubmit?: (anchor: CommentAnchor, body: string) => void;
}) =>
  render(
    <CommentComposer
      anchor={over.anchor ?? entityAnchor}
      anchorDesc={anchorDesc}
      authorName={over.authorName ?? 'Dann'}
      onAuthorNameChange={over.onAuthorNameChange ?? vi.fn()}
      onSubmit={over.onSubmit ?? vi.fn()}
    />
  );

describe('CommentComposer', () => {
  it('shows the anchor target and the current author name', () => {
    const { getByText, getByLabelText } = renderComposer({ authorName: 'Dann' });
    expect(getByText('Root cause')).toBeTruthy();
    expect((getByLabelText('Your name for comments') as HTMLInputElement).value).toBe('Dann');
  });

  it('calls onAuthorNameChange as the name field is edited', () => {
    const onAuthorNameChange = vi.fn();
    const { getByLabelText } = renderComposer({ authorName: '', onAuthorNameChange });
    fireEvent.change(getByLabelText('Your name for comments'), { target: { value: 'Bo' } });
    expect(onAuthorNameChange).toHaveBeenCalledWith('Bo');
  });

  it('submits with the selection anchor and clears the textarea', () => {
    const onSubmit = vi.fn();
    const { getByText, getByPlaceholderText } = renderComposer({ onSubmit });
    const ta = getByPlaceholderText(/Add a review comment/) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'My note' } });
    fireEvent.click(getByText('Comment').closest('button') as HTMLButtonElement);
    expect(onSubmit).toHaveBeenCalledWith(entityAnchor, 'My note');
    expect(ta.value).toBe('');
  });

  it('files against the whole diagram when the checkbox is ticked', () => {
    const onSubmit = vi.fn();
    const { getByText, getByPlaceholderText, getByRole } = renderComposer({ onSubmit });
    fireEvent.click(getByRole('checkbox'));
    expect(getByText('Whole diagram')).toBeTruthy();
    const ta = getByPlaceholderText(/Add a review comment/);
    fireEvent.change(ta, { target: { value: 'general note' } });
    fireEvent.click(getByText('Comment').closest('button') as HTMLButtonElement);
    expect(onSubmit).toHaveBeenCalledWith({ kind: 'document' }, 'general note');
  });

  it('submits on Cmd/Ctrl+Enter', () => {
    const onSubmit = vi.fn();
    const { getByPlaceholderText } = renderComposer({ onSubmit });
    const ta = getByPlaceholderText(/Add a review comment/);
    fireEvent.change(ta, { target: { value: 'quick' } });
    fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledWith(entityAnchor, 'quick');
  });

  it('omits the whole-diagram checkbox when already document-anchored', () => {
    const { queryByRole } = renderComposer({ anchor: { kind: 'document' } });
    expect(queryByRole('checkbox')).toBeNull();
  });

  it('keeps the submit button disabled for an empty or whitespace body', () => {
    const onSubmit = vi.fn();
    const { getByText, getByPlaceholderText } = renderComposer({ authorName: '', onSubmit });
    const btn = getByText('Comment').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.change(getByPlaceholderText(/Add a review comment/), { target: { value: '   ' } });
    expect(btn.disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
