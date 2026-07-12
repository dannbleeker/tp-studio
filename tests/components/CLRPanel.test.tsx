import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLRPanel } from '@/components/inspector/CLRPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeDoc, makeEdge, makeEntity } from '../domain/helpers';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/** Seed a CRT with open reservations in all three tiers: clarity (a question
 *  title), existence (a blank / disconnected entity), sufficiency (a UDE with a
 *  single ungrouped cause → additional-cause). */
const seedMultiTier = () => {
  const q = makeEntity({ type: 'effect', title: 'Is it broken?' });
  const cause = makeEntity({ type: 'effect', title: 'Slow shipping' });
  const ude = makeEntity({ type: 'ude', title: 'Customer churn' });
  const blank = makeEntity({ type: 'effect', title: '' });
  useDocumentStore
    .getState()
    .setDocument(makeDoc([q, cause, ude, blank], [makeEdge(cause.id, ude.id)], 'crt'));
};

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

describe('CLRPanel — progressive gating (A4, opt-in)', () => {
  it('gates later tiers behind earlier ones only after Focus mode is toggled on', () => {
    seedMultiTier();
    render(<CLRPanel />);
    // Default (gating off): every tier header is shown, no "clears after" copy.
    expect(screen.queryByText(/clears after/)).toBeNull();
    // Turn Focus mode on → Existence + Sufficiency collapse behind Clarity.
    fireEvent.click(screen.getByTitle(/Focus mode/));
    expect(screen.getAllByText(/clears after Clarity/).length).toBeGreaterThan(0);
  });

  it('expands a gated tier on click (never truly hidden)', () => {
    seedMultiTier();
    render(<CLRPanel />);
    fireEvent.click(screen.getByTitle(/Focus mode/));
    // The Existence tier is gated — click its collapsed row to expand it.
    const gatedRow = screen.getAllByText(/clears after Clarity/)[0]!;
    fireEvent.click(gatedRow);
    // Once expanded, existence-tier reservation messages surface.
    expect(screen.getAllByText(/disconnected from the graph|no title/i).length).toBeGreaterThan(0);
  });
});
