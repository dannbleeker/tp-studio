import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EntityInspector } from '@/components/inspector/EntityInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 198 (backlog F) — the Goal-vs-Necessary-Condition inline definition
 * card. Shows for goal / criticalSuccessFactor / necessaryCondition entities on a
 * Goal Tree only.
 */
const NOTE = '[data-component="goaltree-type-note"]';

describe('EntityInspector — Goal Tree definitions note (F1)', () => {
  beforeEach(() => {
    resetStoreForTest();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  const renderFor = (diagram: 'goalTree' | 'crt', type: string) => {
    const s = useDocumentStore.getState();
    s.newDocument(diagram);
    const e = s.addEntity({ type: type as never, title: 'X' });
    return render(<EntityInspector entityId={e.id} warnings={[]} />).container;
  };

  it('shows the note for a Necessary Condition on a Goal Tree, with the "enough is fine" framing', () => {
    const c = renderFor('goalTree', 'necessaryCondition');
    const card = c.querySelector(NOTE);
    expect(card).toBeTruthy();
    expect(card?.textContent).toContain('enough is fine');
  });

  it('shows the note for a Goal ("more is better") and a Critical Success Factor', () => {
    expect(renderFor('goalTree', 'goal').querySelector(NOTE)?.textContent).toContain(
      'more is better'
    );
    expect(
      renderFor('goalTree', 'criticalSuccessFactor').querySelector(NOTE)?.textContent
    ).toContain('make-or-break');
  });

  it('does not show the note on a non-Goal-Tree diagram', () => {
    expect(renderFor('crt', 'effect').querySelector(NOTE)).toBeNull();
  });
});
