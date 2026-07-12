import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityInspector } from '@/components/inspector/EntityInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 198 (backlog E) — the "ongoing objective" flag on a PRT / Goal-Tree
 * objective (Newbold, "What is Done?"). Toggles a continuous-work marker.
 */
beforeEach(() => {
  resetStoreForTest();
  window.localStorage.clear();
  window.localStorage.setItem('tp-inspector-section:advanced', '1'); // the toggle lives in Advanced
});
afterEach(cleanup);

const seed = (diagram: 'prt' | 'crt', type: string) => {
  const s = useDocumentStore.getState();
  s.newDocument(diagram);
  return s.addEntity({ type: type as never, title: 'X' });
};

describe('Ongoing objective toggle (E1)', () => {
  it('marks a PRT intermediate objective as ongoing', () => {
    const e = seed('prt', 'intermediateObjective');
    const { getByRole } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    fireEvent.click(getByRole('checkbox', { name: /continuous work/i }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.ongoing).toBe(true);
  });

  it('is not offered on an entity type that is not an objective', () => {
    const e = seed('crt', 'effect');
    const { queryByRole } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    expect(queryByRole('checkbox', { name: /continuous work/i })).toBeNull();
  });
});
