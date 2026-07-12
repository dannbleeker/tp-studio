import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityInspector } from '@/components/inspector/EntityInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 198 (backlog F) — the Goal-Tree tier picker + the injection Six Success
 * Criteria checklist.
 */
beforeEach(() => {
  resetStoreForTest();
  window.localStorage.clear();
  // Both live in collapsible sections; open them so the controls mount.
  window.localStorage.setItem('tp-inspector-section:advanced', '1');
  window.localStorage.setItem('tp-inspector-section:six-criteria', '1');
});
afterEach(cleanup);

const seed = (diagram: 'goalTree' | 'frt' | 'st', type: string) => {
  const s = useDocumentStore.getState();
  s.newDocument(diagram);
  return s.addEntity({ type: type as never, title: 'X' });
};

describe('Goal-Tree tier picker (F2)', () => {
  it('writes the tier on a Goal Tree node and round-trips through the store', () => {
    const e = seed('goalTree', 'criticalSuccessFactor');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const grid = container.querySelector('[data-component="goaltree-tier"]') as HTMLElement;
    expect(grid).toBeTruthy();
    fireEvent.click(within(grid).getByText('Functional'));
    expect(useDocumentStore.getState().doc.entities[e.id]?.tier).toBe('functional');
  });

  it('is not offered on a non-Goal-Tree diagram', () => {
    const e = seed('frt', 'injection');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(container.querySelector('[data-component="goaltree-tier"]')).toBeNull();
  });
});

describe('Six Success Criteria (F3)', () => {
  it('checking a criterion on an FRT injection stores a boolean attribute', () => {
    const e = seed('frt', 'injection');
    const { getByLabelText } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    fireEvent.click(getByLabelText('Excellent'));
    expect(useDocumentStore.getState().doc.entities[e.id]?.attributes?.['sc-excellent']).toEqual({
      kind: 'bool',
      value: true,
    });
  });

  it('is not shown on an S&T injection (a tactic card)', () => {
    const e = seed('st', 'injection');
    const { queryByLabelText } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(queryByLabelText('Excellent')).toBeNull();
  });
});
