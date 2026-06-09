/**
 * Render tests for `TPAssumptionNode` — the dedicated canvas card for a
 * record-canonical assumption. It takes only `{ id, data }` off React Flow's
 * NodeProps and uses no RF hooks, so it renders standalone with RTL.
 *
 * Covered:
 *   - renders the "Assumption" header, the record text, and the #N badge
 *   - double-click begins editing (textarea appears) and commits via
 *     setAssumptionText on blur; no commit when the text is unchanged
 *   - an open-comment count renders the comment badge
 *   - empty text shows the "double-click to edit" placeholder
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TPAssumptionNode as TPAssumptionNodeType } from '@/components/canvas/edges/flow-types';
import { TPAssumptionNode } from '@/components/canvas/nodes/TPAssumptionNode';
import type { Assumption } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

vi.mock('@/services/browseLock', () => ({ guardWriteOrToast: vi.fn(() => true) }));

const rec = (over: Partial<Assumption> = {}): Assumption => ({
  id: 'asm1',
  edgeId: 'e1',
  text: 'Because the budget holds',
  status: 'unexamined',
  annotationNumber: 7,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const renderNode = (data: TPAssumptionNodeType['data'], id = 'asm1') =>
  render(<TPAssumptionNode {...({ id, data } as unknown as NodeProps<TPAssumptionNodeType>)} />);

beforeEach(() => {
  resetStoreForTest();
  // The store actions are stable references, so a `vi.spyOn` on one persists
  // across tests; clear call history up-front so each test's assertions are
  // about its own calls only.
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TPAssumptionNode', () => {
  it('renders the Assumption header, the record text, and the #N badge', () => {
    renderNode({ assumption: rec() });
    expect(screen.getByText('Assumption')).toBeTruthy();
    expect(screen.getByText('Because the budget holds')).toBeTruthy();
    expect(screen.getByLabelText('Annotation number 7')).toBeTruthy();
  });

  it('double-click begins editing and commits changed text via setAssumptionText', () => {
    const spy = vi.spyOn(useDocumentStore.getState(), 'setAssumptionText');
    const { container } = renderNode({ assumption: rec() });
    const card = container.querySelector('[data-component="tp-assumption-node"]')!;
    fireEvent.doubleClick(card);
    const textarea = screen.getByPlaceholderText('State the assumption…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Because demand is steady' } });
    fireEvent.blur(textarea);
    expect(spy).toHaveBeenCalledWith('asm1', 'Because demand is steady');
  });

  it('does not commit when the text is unchanged', () => {
    const spy = vi.spyOn(useDocumentStore.getState(), 'setAssumptionText');
    const { container } = renderNode({ assumption: rec({ text: 'unchanged' }) });
    fireEvent.doubleClick(container.querySelector('[data-component="tp-assumption-node"]')!);
    const textarea = screen.getByPlaceholderText('State the assumption…');
    fireEvent.blur(textarea);
    expect(spy).not.toHaveBeenCalled();
  });

  it('renders the open-comment badge when there are unresolved comments', () => {
    renderNode({ assumption: rec(), openCommentCount: 3 });
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('3 open comments — open the Comments panel')).toBeTruthy();
  });

  it('shows the placeholder hint when the assumption has no text', () => {
    renderNode({ assumption: rec({ text: '' }) });
    expect(screen.getByText('Untitled — double-click to edit')).toBeTruthy();
  });
});
