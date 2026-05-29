/**
 * Multi-doc tabs Phase 5, Batch 5.2 — TabStrip component contract.
 *
 * Drives the store's tab engine (5.1) through the UI: one chip per open
 * tab, the active one flagged with `aria-current`, click-to-switch,
 * close-X, and the `+` new-tab button. The strip is a labelled
 * `role="group"` of buttons (NOT a strict ARIA tablist — a closeable-tab
 * strip can't satisfy `tablist`'s aria-required-children, which the axe
 * e2e enforces). Layout / visual polish is verified manually + in e2e.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TabStrip } from '@/components/toolbar/TabStrip';
import { createDocument } from '@/domain/factory';
import type { TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();
const docNamed = (title: string): TPDocument => ({ ...createDocument('frt'), title });
const tabCount = () => document.querySelectorAll('[data-component="tab"]').length;

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
    expect(tabCount()).toBe(1);
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-current')).toBe('true');

    act(() => {
      s().openTab(docNamed('Beta'));
    });
    expect(tabCount()).toBe(2);
    expect(screen.getByRole('button', { name: 'Beta' }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-current')).toBeNull();
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
      fireEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    });
    expect(s().activeDocId).not.toBe(beta.id);
    expect(screen.getByRole('button', { name: 'Alpha' }).getAttribute('aria-current')).toBe('true');
  });

  it('the + button opens a new tab', () => {
    render(<TabStrip />);
    expect(tabCount()).toBe(1);
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'New tab' }));
    });
    expect(tabCount()).toBe(2);
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
    expect(tabCount()).toBe(1);
    expect(s().tabOrder).not.toContain(beta.id);
  });

  it('exposes a labelled toolbar for assistive tech', () => {
    render(<TabStrip />);
    expect(screen.getByRole('toolbar', { name: 'Open documents' })).toBeTruthy();
  });
});
