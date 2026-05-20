import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SearchPanel } from '@/components/search/SearchPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push (round 2) — `SearchPanel` was at 40%.
 *
 * Smoke tests cover the closed-state short-circuit, the basic
 * filter render, the no-match count, Enter / Shift+Enter advance,
 * and the Escape close.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('SearchPanel — closed', () => {
  it('renders nothing when not open', () => {
    const { container } = render(<SearchPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SearchPanel — open', () => {
  const seedAndOpen = (query = '') => {
    seedEntity('Findable thing one');
    seedEntity('Findable thing two');
    seedEntity('Unrelated');
    const st = useDocumentStore.getState();
    st.openSearch();
    if (query) st.setSearchQuery(query);
  };

  it('mounts the input + match-count chrome when open', () => {
    seedAndOpen();
    render(<SearchPanel />);
    expect(screen.getByPlaceholderText(/Find in document/i)).toBeTruthy();
  });

  it('reports "No matches" with an empty query', () => {
    seedAndOpen();
    render(<SearchPanel />);
    expect(screen.getByText(/No matches/i)).toBeTruthy();
  });

  it('reports the match count when the query matches', () => {
    seedAndOpen('Findable');
    render(<SearchPanel />);
    // Two entities titled "Findable thing one" / "Findable thing two".
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
  });

  it('Escape inside the input closes the panel', () => {
    seedAndOpen();
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Find in document/i) as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(s().searchOpen).toBe(false);
  });

  it('Enter advances the match cursor', () => {
    seedAndOpen('Findable');
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Find in document/i) as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(s().searchMatchIndex).toBe(1);
  });

  it('Shift+Enter retreats the match cursor (wraps backwards)', () => {
    seedAndOpen('Findable');
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Find in document/i) as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    // matchIndex starts at 0; shift+enter goes to -1.
    expect(s().searchMatchIndex).toBe(-1);
  });

  it('typing updates the live query', () => {
    seedAndOpen();
    render(<SearchPanel />);
    const input = screen.getByPlaceholderText(/Find in document/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Findable' } });
    expect(s().searchQuery).toBe('Findable');
  });
});
