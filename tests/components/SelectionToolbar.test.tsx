/**
 * Session 95 — SelectionToolbar component tests.
 *
 * Slice-level behaviour (which verbs apply per branch) lives in
 * `tests/domain/selectionVerbs.test.ts` — this file pins the
 * **component contract**:
 *   1. Hidden when there's no selection / pane right-click.
 *   2. Renders one button per verb when a selection produces a
 *      non-empty verb list.
 *   3. Hidden when the user has disabled `showSelectionToolbar`.
 *   4. Hidden while the palette or a modal is open.
 *   5. Clicking a verb's button invokes the palette command
 *      (via `dispatchVerb`).
 *
 * `getSelectionViewportRect()` reads from React Flow's instance,
 * which isn't mounted in jsdom. The tests stub `services/canvasRef`
 * so the toolbar receives a non-null rect when we want one. The
 * positioning math (top/left/flipBelow) is exercised here only via
 * the "renders when rect is non-null" path; pixel-exact positioning
 * gets coverage in the Playwright e2e.
 */
import { SelectionToolbar } from '@/components/canvas/SelectionToolbar';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

// Stub `getSelectionViewportRect` to return a deterministic rect.
// React Flow's instance isn't initialised in jsdom, so the real
// implementation returns null and the toolbar would never appear.
vi.mock('@/services/canvasRef', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/canvasRef')>('@/services/canvasRef');
  return {
    ...actual,
    getSelectionViewportRect: vi.fn(() => new DOMRect(100, 100, 200, 80)),
  };
});

const renderWithProvider = (node: ReactElement) =>
  render(<ReactFlowProvider>{node}</ReactFlowProvider>);

beforeEach(() => {
  resetStoreForTest();
});
afterEach(cleanup);

const advanceFrame = async () => {
  // The toolbar reads its rect inside a requestAnimationFrame. The
  // testing-library `act` wrapper doesn't drive rAF; we flush
  // manually so the post-effect render lands before assertions.
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
};

describe('SelectionToolbar', () => {
  it('renders nothing when no selection (branch = none)', async () => {
    const { container } = renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    expect(container.querySelector('[data-component="selection-toolbar"]')).toBeNull();
  });

  it('renders the toolbar with verb buttons when a single entity is selected', async () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    const root = screen.getByRole('toolbar', { name: /selection actions/i });
    expect(root).toBeTruthy();
    // single-entity branch surfaces add-successor + add-predecessor +
    // confirm-delete-selection. The button labels are aria-label from
    // verb.label, so we look those up.
    expect(screen.getByRole('button', { name: /^add child$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^add parent$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeTruthy();
  });

  it('renders edge verbs when a single edge is selected', async () => {
    const { edge } = seedConnectedPair();
    act(() => useDocumentStore.getState().selectEdges([edge.id]));
    renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    expect(screen.getByRole('button', { name: /reverse direction/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /splice entity into edge/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /delete edge/i })).toBeTruthy();
  });

  it('hides itself when showSelectionToolbar is false', async () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    act(() => useDocumentStore.getState().setShowSelectionToolbar(false));
    const { container } = renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    expect(container.querySelector('[data-component="selection-toolbar"]')).toBeNull();
  });

  it('hides itself when the palette is open', async () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    act(() => useDocumentStore.getState().openPalette());
    const { container } = renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    expect(container.querySelector('[data-component="selection-toolbar"]')).toBeNull();
  });

  it('hides itself when a modal (Settings) is open', async () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    act(() => useDocumentStore.getState().openSettings());
    const { container } = renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    expect(container.querySelector('[data-component="selection-toolbar"]')).toBeNull();
  });

  it('clicking the Add child verb runs the add-successor palette command', async () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    const before = Object.keys(useDocumentStore.getState().doc.entities).length;
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^add child$/i }));
    });
    const after = Object.keys(useDocumentStore.getState().doc.entities).length;
    expect(after).toBe(before + 1);
  });

  it("verb tooltip carries the command's keyboard shortcut when one exists", async () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    renderWithProvider(<SelectionToolbar />);
    await advanceFrame();
    // The Delete verb references confirm-delete-selection, which is
    // bound to Delete / Backspace via the shortcut registry. The
    // tooltip should mention the keys.
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    const title = deleteBtn.getAttribute('title') ?? '';
    expect(title.toLowerCase()).toContain('delete');
  });
});
