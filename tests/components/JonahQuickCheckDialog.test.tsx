import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  JONAH_QUICK_CHECKS,
  JonahQuickCheckDialog,
} from '@/components/inspector/JonahQuickCheckDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();

describe('JonahQuickCheckDialog (A4)', () => {
  it('exposes exactly four quick-check questions', () => {
    expect(JONAH_QUICK_CHECKS).toHaveLength(4);
  });

  it('renders nothing until the store flag is set', () => {
    const { container } = render(<JonahQuickCheckDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('walks the four questions and Finish closes it', () => {
    s().openJonahQuickCheck();
    render(<JonahQuickCheckDialog />);
    expect(screen.getByText('Jonah quick-check')).toBeTruthy();
    expect(screen.getByText(/Question 1 of 4/)).toBeTruthy();
    // Step forward to the last question.
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText(/Question 4 of 4/)).toBeTruthy();
    // Finish closes the dialog (store flag flips back).
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(s().jonahQuickCheckOpen).toBe(false);
  });
});
