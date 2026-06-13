import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LogicPill } from '@/components/start/LogicPill';
import { StartPage } from '@/components/start/StartPage';
import { StartSidebar } from '@/components/start/StartSidebar';
import { useOpenTrees } from '@/components/start/useOpenTrees';
import { createDocument } from '@/domain/factory';
import { validate } from '@/domain/validators';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const nav = (c: HTMLElement) => Array.from(c.querySelectorAll('nav[aria-label="Sections"] button'));
const navItem = (c: HTMLElement, label: string) =>
  nav(c).find((b) => b.textContent?.includes(label)) as HTMLButtonElement | undefined;

describe('LogicPill', () => {
  it('shows "Logic clear" at zero and "N to review" otherwise', () => {
    const { rerender, container } = render(<LogicPill openWarnings={0} />);
    expect(container.textContent).toContain('Logic clear');
    rerender(<LogicPill openWarnings={3} />);
    expect(container.textContent).toContain('3 to review');
  });
});

describe('useOpenTrees', () => {
  it('openWarnings equals validate(doc) filtered to unresolved — can never drift from the editor', () => {
    act(() => {
      // A lone effect with no UDE trips CRT build-quality reservations.
      useDocumentStore.getState().addEntity({ type: 'effect', title: 'orphan' });
    });
    const { result } = renderHook(() => useOpenTrees());
    const doc = currentDoc(useDocumentStore.getState());
    const expected = validate(doc).filter((w) => !w.resolved).length;
    expect(result.current.find((t) => t.id === doc.id)?.openWarnings).toBe(expected);
  });
});

describe('StartSidebar', () => {
  it('badges are store-driven, not literals (All trees = open tabs; Needs review = trees with open reservations)', () => {
    act(() => {
      useDocumentStore.getState().openTab(createDocument('ec'));
      useDocumentStore.getState().addEntity({ type: 'effect', title: 'orphan' });
    });
    const { container } = render(<StartSidebar />);
    const state = useDocumentStore.getState();
    const expectedAll = state.tabOrder.length;
    const expectedNeeds = state.tabOrder.filter((id) => {
      const d = state.docs[id];
      return d ? validate(d).some((w) => !w.resolved) : false;
    }).length;

    expect(navItem(container, 'All trees')?.textContent).toContain(String(expectedAll));
    if (expectedNeeds > 0) {
      expect(navItem(container, 'Needs review')?.textContent).toContain(String(expectedNeeds));
    }
  });
});

describe('StartPage', () => {
  it('clicking a sidebar item switches the active section', () => {
    act(() => useDocumentStore.getState().openStart());
    const { container } = render(<StartPage />);
    const templates = navItem(container, 'Templates');
    expect(templates).toBeTruthy();
    act(() => fireEvent.click(templates as HTMLButtonElement));
    expect(useDocumentStore.getState().startSection).toBe('templates');
  });

  it('the ⌘K header button opens the command palette', () => {
    act(() => useDocumentStore.getState().openStart());
    const { container } = render(<StartPage />);
    const search = container.querySelector(
      'button[aria-label="Search or run a command"]'
    ) as HTMLButtonElement;
    expect(search).toBeTruthy();
    expect(useDocumentStore.getState().paletteOpen).toBe(false);
    act(() => fireEvent.click(search));
    expect(useDocumentStore.getState().paletteOpen).toBe(true);
  });
});
