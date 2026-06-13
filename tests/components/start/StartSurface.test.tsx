import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LogicPill } from '@/components/start/LogicPill';
import { StartPage } from '@/components/start/StartPage';
import { StartSidebar } from '@/components/start/StartSidebar';
import { useSavedTrees } from '@/components/start/useSavedTrees';
import { createDocument } from '@/domain/factory';
import { validate } from '@/domain/validators';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

beforeEach(() => {
  // The Start library reads localStorage (saved trees); clear it so a prior
  // test's openTab'd bodies don't leak into the next one's counts.
  localStorage.clear();
  resetStoreForTest();
});
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

describe('useSavedTrees', () => {
  it('openWarnings equals validate(doc) filtered to unresolved — can never drift from the editor', () => {
    act(() => {
      // A lone effect with no UDE trips CRT build-quality reservations.
      useDocumentStore.getState().addEntity({ type: 'effect', title: 'orphan' });
    });
    const { result } = renderHook(() => useSavedTrees());
    const doc = currentDoc(useDocumentStore.getState());
    const expected = validate(doc).filter((w) => !w.resolved).length;
    expect(result.current.find((t) => t.id === doc.id)?.openWarnings).toBe(expected);
  });

  it('a closed tab stays in the library (reopenable), not deleted', () => {
    let closedId = '';
    act(() => {
      const ec = createDocument('ec');
      closedId = ec.id;
      useDocumentStore.getState().openTab(ec); // saves ec's body, makes it active
      useDocumentStore.getState().closeTab(ec.id); // close → body kept since Session 184
    });
    const { result } = renderHook(() => useSavedTrees());
    const closed = result.current.find((t) => t.id === closedId);
    expect(closed).toBeTruthy();
    expect(closed?.isOpen).toBe(false);
  });

  it('openSavedDoc reopens a closed tree from storage', () => {
    const ec = createDocument('ec');
    act(() => {
      useDocumentStore.getState().openTab(ec);
      useDocumentStore.getState().closeTab(ec.id);
    });
    expect(useDocumentStore.getState().docs[ec.id]).toBeUndefined();
    act(() => useDocumentStore.getState().openSavedDoc(ec.id));
    expect(useDocumentStore.getState().docs[ec.id]).toBeTruthy();
  });

  it('deleting a tree from Start stays on Start (does not exit to the editor)', () => {
    const ec = createDocument('ec');
    act(() => {
      useDocumentStore.getState().openTab(ec); // open it (this exits Start)
      useDocumentStore.getState().openStart(); // back to the Start surface
    });
    expect(useDocumentStore.getState().startSection).toBe('start');
    act(() => useDocumentStore.getState().deleteSavedDoc(ec.id));
    expect(useDocumentStore.getState().startSection).toBe('start');
  });
});

describe('StartSidebar', () => {
  it('badges reflect the saved library, computed from the store (not literals)', () => {
    act(() => useDocumentStore.getState().openTab(createDocument('ec')));
    const { result } = renderHook(() => useSavedTrees());
    const expectedAll = result.current.length;
    const expectedNeeds = result.current.filter((t) => t.openWarnings > 0).length;

    const { container } = render(<StartSidebar />);
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
