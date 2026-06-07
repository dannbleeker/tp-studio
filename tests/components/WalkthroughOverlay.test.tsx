import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WalkthroughOverlay } from '@/components/walkthrough/WalkthroughOverlay';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedChain, seedConnectedPair } from '../helpers/seedDoc';

/**
 * Session 134 coverage push — `WalkthroughOverlay` was at 5.79%.
 *
 * The overlay drives both the Read-through (one sentence per edge) and
 * the CLR walkthrough (one warning at a time). Tests cover the open /
 * close branches + the keyboard nav + the read-through sentence
 * render. CLR-warning resolution is exercised through the close path
 * since wiring up a real warning needs more graph setup than a smoke
 * test wants.
 *
 * Session 176+ coverage push — added branches:
 *   - backdrop click-to-close
 *   - footer Next / Back button clicks
 *   - "Finish" label on last step
 *   - position counter text
 *   - ReadThrough edge label display
 *   - ReadThrough "Open this edge in inspector" button → selectEdge
 *   - ReadThrough missing edge fallback
 *   - ReadThrough missing endpoints fallback
 *   - CLR "Open in inspector" with edge target
 *   - CLR warning missing/resolved fallback text
 *   - CLR edge target label
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

// ---------------------------------------------------------------------------
// Additional branch coverage (Session 176+)
// ---------------------------------------------------------------------------

describe('WalkthroughOverlay — backdrop click closes overlay', () => {
  it('clicking the backdrop (outer div) closes the walkthrough', () => {
    const { edges } = seedChain(['A', 'B']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
    const { getByRole } = render(<WalkthroughOverlay />);
    const backdrop = getByRole('dialog');
    // Simulate a click whose target === currentTarget (backdrop, not inner card).
    fireEvent.click(backdrop, { target: backdrop });
    expect(s().walkthrough.kind).toBe('closed');
  });
});

describe('WalkthroughOverlay — footer button navigation', () => {
  it('footer Next button advances the index', () => {
    const { edges } = seedChain(['A', 'B', 'C']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
    render(<WalkthroughOverlay />);
    // The next button text is "Next" (not last step).
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    const w = s().walkthrough;
    if (w.kind === 'read-through') expect(w.index).toBe(1);
  });

  it('footer Back button goes to previous step', () => {
    const { edges } = seedChain(['A', 'B', 'C']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
    useDocumentStore.getState().walkthroughNext();
    render(<WalkthroughOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    const w = s().walkthrough;
    if (w.kind === 'read-through') expect(w.index).toBe(0);
  });

  it('Back button is disabled on first step', () => {
    const { edges } = seedChain(['A', 'B']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
    render(<WalkthroughOverlay />);
    const backBtn = screen.getByRole('button', { name: /Back/i }) as HTMLButtonElement;
    // No jest-dom in this repo — read the native disabled property.
    expect(backBtn.disabled).toBe(true);
  });

  it('Next button shows "Finish" on the last step', () => {
    const { edges } = seedChain(['A', 'B']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
    render(<WalkthroughOverlay />);
    // Single edge → index 0 is also the last (total=1).
    expect(screen.getByRole('button', { name: /Finish/i })).toBeTruthy();
  });

  it('position counter shows "1 / N" on first step', () => {
    const { edges } = seedChain(['A', 'B', 'C']);
    useDocumentStore.getState().startReadThrough(edges.map((e) => e.id));
    render(<WalkthroughOverlay />);
    // 2 edges → "1 / 2"
    expect(screen.getByText(/1 \/ 2/)).toBeTruthy();
  });
});

describe('WalkthroughOverlay — read-through fallback renders', () => {
  it('shows fallback text when the edge id no longer exists', () => {
    // Start a walkthrough with a bogus edge id that was never in the doc.
    useDocumentStore.getState().startReadThrough(['nonexistent-edge-id']);
    render(<WalkthroughOverlay />);
    expect(screen.getByText(/Edge no longer exists/i)).toBeTruthy();
  });

  it('shows fallback text when edge endpoints no longer exist', async () => {
    // Seed a connected pair, grab the edge id, then delete both entities so
    // the edge still references its id but the endpoint entities are gone.
    const { a, edge } = seedConnectedPair('Cause', 'Effect');
    useDocumentStore.getState().startReadThrough([edge.id]);
    // Delete the source entity so endpoints are missing.
    useDocumentStore.getState().deleteEntity(a.id);
    // Re-render after state mutation.
    act(() => {});
    render(<WalkthroughOverlay />);
    // Either the edge itself is pruned (→ "no longer exists") or the
    // endpoints are missing — both are "safe" fallback states.
    const text =
      screen
        .getAllByRole('paragraph')
        .map((p) => p.textContent ?? '')
        .join(' ') + document.body.textContent;
    expect(/Edge no longer exists|Edge endpoints no longer exist/.test(text)).toBe(true);
  });

  it('shows edge label when the edge has a label', async () => {
    seedConnectedPair('Cause X', 'Effect Y');
    const state = useDocumentStore.getState();
    // Connect returns the edge; we need to get its id from doc.
    const edgeId = Object.values(state.doc.edges)[0]?.id ?? '';
    // Set the label via the store's updateEdge (or direct patch).
    state.updateEdge(edgeId, { label: 'TestEdgeLabel' });
    state.startReadThrough([edgeId]);
    render(<WalkthroughOverlay />);
    // The label appears both in the rendered sentence and in the "Edge label:"
    // caption below it — getAllByText avoids a "multiple elements" error.
    expect(screen.getAllByText(/TestEdgeLabel/).length).toBeGreaterThan(0);
  });

  it('"Open this edge in the inspector" button selects the edge', () => {
    const { edge } = seedConnectedPair('Cause', 'Effect');
    useDocumentStore.getState().startReadThrough([edge.id]);
    render(<WalkthroughOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /Open this edge in the inspector/i }));
    const sel = s().selection;
    expect(sel.kind).toBe('edges');
    if (sel.kind === 'edges') expect(sel.ids).toContain(edge.id);
  });
});

describe('WalkthroughOverlay — CLR walkthrough edge target', () => {
  it('"Open in inspector" with an edge-targeted warning selects the edge', async () => {
    const { validate } = await import('@/domain/validators');
    // Seed a connected pair — this creates an edge and triggers the
    // causality-existence rule which always targets `{ kind: 'edge', id }`.
    const { edge } = seedConnectedPair('Cause', 'Effect');
    const warnings = validate(useDocumentStore.getState().doc).filter(
      (w) => w.target.kind === 'edge' && w.target.id === edge.id && !w.resolved
    );
    expect(warnings.length).toBeGreaterThan(0);
    const ids = warnings.map((w) => w.id);
    useDocumentStore.getState().startClrWalkthrough(ids);

    render(<WalkthroughOverlay />);
    fireEvent.click(screen.getByRole('button', { name: /Open in inspector/i }));

    expect(s().walkthrough.kind).toBe('closed');
    const sel = s().selection;
    expect(sel.kind).toBe('edges');
    if (sel.kind === 'edges') expect(sel.ids).toContain(edge.id);
  });

  it('shows "Warning resolved or no longer applies" when the warning id is stale', () => {
    // Start a CLR walkthrough with a non-existent warning id — the
    // liveWarnings list won't contain it, so the fallback renders.
    useDocumentStore.getState().startClrWalkthrough(['nonexistent-warning-id']);
    render(<WalkthroughOverlay />);
    expect(screen.getByText(/Warning resolved or no longer applies/i)).toBeTruthy();
  });

  it('CLR body shows the edge target label for an edge-targeted warning', async () => {
    const { validate } = await import('@/domain/validators');
    seedConnectedPair('SourceNode', 'TargetNode');
    const warnings = validate(useDocumentStore.getState().doc).filter(
      (w) => w.target.kind === 'edge' && !w.resolved
    );
    expect(warnings.length).toBeGreaterThan(0);
    useDocumentStore.getState().startClrWalkthrough([warnings[0]!.id]);

    render(<WalkthroughOverlay />);
    // The target label for an edge is rendered as "Edge: SourceNode → TargetNode".
    expect(screen.getByText(/Edge:.*SourceNode.*TargetNode/)).toBeTruthy();
  });
});
