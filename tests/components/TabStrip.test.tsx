/**
 * Multi-doc tabs Phase 5, Batch 5.2 — TabStrip component contract.
 *
 * Drives the store's tab engine (5.1) through the UI: one chip per open
 * tab, the active one flagged, click-to-switch, close-X, and the `+`
 * new-tab button. Layout / visual polish is verified manually + in e2e;
 * this pins the functional + a11y contract.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TabStrip } from '@/components/toolbar/TabStrip';
import { createDocument } from '@/domain/factory';
import type { TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();
const docNamed = (title: string): TPDocument => ({ ...createDocument('frt'), title });

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});
afterEach(cleanup);

describe('Batch 5.2 — TabStrip', () => {
  it('renders one tab per open document and flags the active one', () => {
    act(() => {
      s().setTitle('Alpha');
    });
    render(<TabStrip />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true');

    act(() => {
      s().openTab(docNamed('Beta'));
    });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('false');
  });

  it('clicking a tab switches to it', () => {
    act(() => {
      s().setTitle('Alpha');
    });
    const beta = docNamed('Beta');
    act(() => {
      s().openTab(beta); // active = Beta
    });
    render(<TabStrip />);

    act(() => {
      fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }));
    });
    expect(s().activeDocId).not.toBe(beta.id);
    expect(screen.getByRole('tab', { name: 'Alpha' }).getAttribute('aria-selected')).toBe('true');
  });

  it('the + button opens a new tab', () => {
    render(<TabStrip />);
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(s().tabOrder).toHaveLength(2);
  });

  it('close removes a tab — and there is no close affordance with one tab open', () => {
    render(<TabStrip />);
    // Sole tab → no close button.
    expect(screen.queryByRole('button', { name: /^Close / })).toBeNull();

    const beta = docNamed('Beta');
    act(() => {
      s().openTab(beta);
    });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close Beta' }));
    });
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(s().tabOrder).not.toContain(beta.id);
  });

  it('exposes a labelled tablist for assistive tech', () => {
    render(<TabStrip />);
    expect(screen.getByRole('tablist', { name: 'Open documents' })).toBeTruthy();
  });
});
