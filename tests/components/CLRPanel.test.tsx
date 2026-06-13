import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLRPanel } from '@/components/inspector/CLRPanel';
import { resetStoreForTest } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * CLRPanel is the tree-level Logic-check audit (the CLR differentiator promoted
 * to first class). Its counts/tiers are exercised via the store elsewhere; here
 * we pin the always-present header chrome — the one-line explainer that teaches
 * what the panel does, and the open/resolved counts.
 */
describe('CLRPanel header', () => {
  it('is a labelled Logic-check region', () => {
    render(<CLRPanel />);
    expect(screen.getByRole('complementary', { name: 'Logic check' })).toBeTruthy();
  });

  it('always surfaces the one-line CLR explainer (taught in place)', () => {
    render(<CLRPanel />);
    // "walk them tier by tier" is unique to the explainer (the body's
    // all-clear copy also names the CLR, so match the explainer's own tail).
    expect(screen.getByText(/walk them tier by tier/)).toBeTruthy();
  });

  it('shows the open-reservation count in the header', () => {
    render(<CLRPanel />);
    expect(screen.getByText(/to review/)).toBeTruthy();
  });
});
