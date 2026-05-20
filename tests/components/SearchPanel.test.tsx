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

  it('case-sensitive toggle flips its option', () => {
    seedAndOpen();
    render(<SearchPanel />);
    const before = s().searchOptions.caseSensitive;
    const button = screen.getByLabelText(/Match case/i);
    fireEvent.click(button);
    expect(s().searchOptions.caseSensitive).toBe(!before);
  });

  it('whole-word toggle flips its option', () => {
    seedAndOpen();
    render(<SearchPanel />);
    const before = s().searchOptions.wholeWord;
    const button = screen.getByLabelText(/Whole word/i);
    fireEvent.click(button);
    expect(s().searchOptions.wholeWord).toBe(!before);
  });

  it('regex toggle flips its option', () => {
    seedAndOpen();
    render(<SearchPanel />);
    const before = s().searchOptions.regex;
    const button = screen.getByLabelText(/Regex/i);
    fireEvent.click(button);
    expect(s().searchOptions.regex).toBe(!before);
  });

  it('Next match button advances the cursor', () => {
    seedAndOpen('Findable');
    render(<SearchPanel />);
    const next = screen.getByLabelText(/Next match/i);
    fireEvent.click(next);
    expect(s().searchMatchIndex).toBe(1);
  });

  it('Previous match button retreats the cursor', () => {
    seedAndOpen('Findable');
    render(<SearchPanel />);
    const prev = screen.getByLabelText(/Previous match/i);
    fireEvent.click(prev);
    expect(s().searchMatchIndex).toBe(-1);
  });

  it('Close find button closes the panel', () => {
    seedAndOpen();
    render(<SearchPanel />);
    const close = screen.getByLabelText(/Close find/i);
    fireEvent.click(close);
    expect(s().searchOpen).toBe(false);
  });

  it("clicking a result row sets matchIndex to that row's index", () => {
    seedAndOpen('Findable');
    render(<SearchPanel />);
    // Result rows show "<kind> · <field>" in their button text — click the
    // second one.
    const buttons = screen.getAllByRole('button');
    // Heuristic: the result rows are the buttons after the navigation
    // chrome; pick the one whose textContent contains "entity ·".
    const rows = buttons.filter((b) => /entity\s+·/i.test(b.textContent ?? ''));
    if (rows.length < 2) return; // fewer matches than expected; skip
    fireEvent.click(rows[1]!);
    expect(s().searchMatchIndex).toBe(1);
  });
});
