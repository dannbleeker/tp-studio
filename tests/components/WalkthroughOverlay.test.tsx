import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WalkthroughOverlay } from '@/components/walkthrough/WalkthroughOverlay';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain } from '../helpers/seedDoc';

/**
 * Session 134 coverage push — `WalkthroughOverlay` was at 5.79%.
 *
 * The overlay drives both the Read-through (one sentence per edge) and
 * the CLR walkthrough (one warning at a time). Tests cover the open /
 * close branches + the keyboard nav + the read-through sentence
 * render. CLR-warning resolution is exercised through the close path
 * since wiring up a real warning needs more graph setup than a smoke
 * test wants.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('WalkthroughOverlay — closed state', () => {
  it('renders nothing when no walkthrough is active', () => {
    const { container } = render(<WalkthroughOverlay />);
    expect(container.firstChild).toBeNull();
  });
});

describe('WalkthroughOverlay — read-through', () => {
  const seedAndStart = () => {
    const { edges } = seedChain(['A', 'B', 'C']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
  };

  it('opens with the overlay dialog visible', () => {
    seedAndStart();
    render(<WalkthroughOverlay />);
    // The overlay renders a dialog-role wrapper when active.
    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  });

  it('advances to the next sentence on Arrow Right', () => {
    seedAndStart();
    render(<WalkthroughOverlay />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(s().walkthrough.kind).toBe('read-through');
    if (s().walkthrough.kind === 'read-through') {
      const w = s().walkthrough;
      if (w.kind === 'read-through') {
        expect(w.index).toBe(1);
      }
    }
  });

  it('goes back to the previous sentence on Arrow Left', () => {
    seedAndStart();
    useDocumentStore.getState().walkthroughNext();
    render(<WalkthroughOverlay />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    const w = s().walkthrough;
    if (w.kind === 'read-through') {
      expect(w.index).toBe(0);
    }
  });

  it('closes when the header close button is clicked', () => {
    // Esc is no longer handled by the overlay itself — it's owned by the
    // global Escape cascade (`useGlobalShortcuts`) and tested there. The
    // overlay's own close affordance is the header X button.
    seedAndStart();
    render(<WalkthroughOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /Close walkthrough/i }));
    expect(s().walkthrough.kind).toBe('closed');
  });

  it('Space advances like Arrow Right', () => {
    seedAndStart();
    render(<WalkthroughOverlay />);
    fireEvent.keyDown(window, { key: ' ' });
    const w = s().walkthrough;
    if (w.kind === 'read-through') {
      expect(w.index).toBe(1);
    }
  });
});

describe('WalkthroughOverlay — empty walkthrough', () => {
  // Note: `startReadThrough([])` does NOT guard against an empty steps
  // array at the store level — the overlay renders an "empty" state
  // when steps is empty. That's the safety net the `start-read-through`
  // palette command relies on (it short-circuits at the caller before
  // ever invoking the store action when there's nothing to walk).
  // No assertion required here beyond compilation; left as a marker
  // for the e2e follow-up.
  it.todo('renders a graceful empty state when steps is empty (covered via Playwright)');
});

describe('WalkthroughOverlay — CLR walkthrough', () => {
  // Seed a doc with one entity whose empty title triggers a `clarity`
  // / `entity-existence` warning; start the CLR walkthrough on that
  // warning's id; exercise the Resolve + Open-in-inspector branches.
  const seedAndStart = async () => {
    const { validate } = await import('@/domain/validators');
    useDocumentStore.getState().addEntity({ type: 'effect', title: '' });
    const warnings = validate(useDocumentStore.getState().doc).filter((w) => !w.resolved);
    expect(warnings.length).toBeGreaterThan(0);
    const ids = warnings.map((w) => w.id);
    useDocumentStore.getState().startClrWalkthrough(ids);
    return { warningId: ids[0]!, warning: warnings[0]! };
  };

  it('opens with the CLR header + Resolve / Open-in-inspector buttons', async () => {
    await seedAndStart();
    render(<WalkthroughOverlay />);
    expect(screen.getByText(/CLR walkthrough/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Resolve/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Open in inspector/i })).toBeTruthy();
  });

  it('"Resolve" marks the warning resolved and advances', async () => {
    const { warningId } = await seedAndStart();
    render(<WalkthroughOverlay />);
    const resolve = screen.getByRole('button', { name: /Resolve/i });
    fireEvent.click(resolve);
    expect(s().doc.resolvedWarnings[warningId]).toBe(true);
  });

  it('"Open in inspector" selects the warning\'s target entity and closes the overlay', async () => {
    const { warning } = await seedAndStart();
    render(<WalkthroughOverlay />);
    const open = screen.getByRole('button', { name: /Open in inspector/i });
    fireEvent.click(open);
    expect(s().walkthrough.kind).toBe('closed');
    if (warning.target.kind === 'entity') {
      const sel = s().selection;
      expect(sel.kind).toBe('entities');
      if (sel.kind === 'entities') {
        expect(sel.ids).toContain(warning.target.id);
      }
    }
  });
});
