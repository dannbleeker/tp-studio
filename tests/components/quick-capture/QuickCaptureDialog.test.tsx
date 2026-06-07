/**
 * Behaviour-asserting tests for QuickCaptureDialog.
 *
 * Covers:
 *   - Dialog hidden / visible gate (quickCaptureOpen flag).
 *   - Live preview: total count updates as user types.
 *   - Submit via Cmd+Enter keyboard shortcut.
 *   - Submit via the "Create N entities" button.
 *   - Empty-input guard: shows info toast and creates nothing.
 *   - Browse-lock guard: locked doc blocks submit and shows toast.
 *   - Attach-to-selection: roots attach to a single selected entity.
 *   - Float mode: nothing selected → roots float (no anchor edge).
 *   - Multi-selection does NOT attach (float path).
 *   - Reset on re-open: textarea is cleared when the dialog re-opens.
 *   - Cancel button closes the dialog without creating anything.
 *   - Singular / plural label in footer button.
 *   - Preview shows "Nothing to preview yet" placeholder on empty input.
 *   - Deep nesting reflected in preview tree.
 */

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QuickCaptureDialog } from '@/components/quick-capture/QuickCaptureDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../../helpers/seedDoc';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const s = () => useDocumentStore.getState();
const doc = () => currentDoc(s());
const allEntities = () => Object.values(doc().entities);
const allEdges = () => Object.values(doc().edges);

/** Open the dialog then render the component. Returns RTL queries. */
function openDialog() {
  act(() => s().openQuickCapture());
  return render(<QuickCaptureDialog />);
}

/** Type into the textarea. */
function typeText(value: string) {
  const ta = screen.getByRole('textbox');
  act(() => {
    fireEvent.change(ta, { target: { value } });
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(resetStoreForTest);
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Visibility gating
// ---------------------------------------------------------------------------

describe('visibility', () => {
  it('renders nothing while quickCaptureOpen is false', () => {
    render(<QuickCaptureDialog />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders the textarea when quickCaptureOpen flips on', () => {
    openDialog();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('shows the "Quick Capture" heading when open', () => {
    openDialog();
    expect(screen.getByText('Quick Capture')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Live preview
// ---------------------------------------------------------------------------

describe('live preview', () => {
  it('shows "Nothing to preview yet" placeholder on empty input', () => {
    openDialog();
    expect(screen.getByText(/Nothing to preview yet/i)).toBeTruthy();
  });

  it('shows entity count in the preview header as user types', () => {
    openDialog();
    typeText('Alpha\nBravo\nCharlie');
    // "Preview (3 entities)" label
    expect(screen.getByText(/Preview \(3 entities\)/i)).toBeTruthy();
  });

  it('uses "entity" (singular) when count is 1', () => {
    openDialog();
    typeText('Single root');
    expect(screen.getByText(/Preview \(1 entity\)/i)).toBeTruthy();
  });

  it('renders the root titles in the preview list', () => {
    openDialog();
    typeText('Root One\nRoot Two');
    expect(screen.getByText('Root One')).toBeTruthy();
    expect(screen.getByText('Root Two')).toBeTruthy();
  });

  it('renders nested children in the preview tree', () => {
    openDialog();
    typeText('Parent\n  Child One\n  Child Two');
    expect(screen.getByText('Parent')).toBeTruthy();
    expect(screen.getByText('Child One')).toBeTruthy();
    expect(screen.getByText('Child Two')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Empty-input guard
// ---------------------------------------------------------------------------

describe('empty-input guard', () => {
  it('shows an info toast and creates nothing when text is empty', () => {
    openDialog();
    // textarea is empty; the submit button is disabled so trigger via keyboard
    const ta = screen.getByRole('textbox');
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    });

    // No entities or edges created
    expect(allEntities()).toHaveLength(0);
    expect(allEdges()).toHaveLength(0);

    // An info toast was shown
    const toasts = s().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts[0]?.kind).toBe('info');
    expect(toasts[0]?.message).toMatch(/Nothing to capture/i);
  });

  it('keeps the dialog open after an empty-input attempt', () => {
    openDialog();
    // Trigger submit on empty via keyboard (button is disabled on empty)
    const ta = screen.getByRole('textbox');
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    });
    // dialog still showing
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(s().quickCaptureOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Submit via button
// ---------------------------------------------------------------------------

describe('submit via button', () => {
  it('creates entities in the store and closes the dialog', () => {
    openDialog();
    typeText('Alpha\nBravo');

    const btn = screen.getByRole('button', { name: /Create 2 entities/i });
    act(() => fireEvent.click(btn));

    expect(allEntities()).toHaveLength(2);
    const titles = allEntities()
      .map((e) => e.title)
      .sort();
    expect(titles).toEqual(['Alpha', 'Bravo']);
    expect(s().quickCaptureOpen).toBe(false);
  });

  it('shows a success toast after submit', () => {
    openDialog();
    typeText('One\nTwo\nThree');
    act(() => fireEvent.click(screen.getByRole('button', { name: /Create 3 entities/i })));

    const toasts = s().toasts;
    const successToast = toasts.find((t) => t.kind === 'success');
    expect(successToast).toBeTruthy();
    expect(successToast?.message).toMatch(/Created 3 entit/i);
  });

  it('creates parent→child edges for an indented list', () => {
    openDialog();
    typeText('Parent\n  Child A\n  Child B');
    act(() => fireEvent.click(screen.getByRole('button', { name: /Create 3 entities/i })));

    expect(allEntities()).toHaveLength(3);
    expect(allEdges()).toHaveLength(2);

    const entityByTitle = Object.fromEntries(allEntities().map((e) => [e.title, e]));
    const parent = entityByTitle.Parent;
    const childA = entityByTitle['Child A'];
    const childB = entityByTitle['Child B'];
    expect(parent).toBeTruthy();
    expect(childA).toBeTruthy();
    expect(childB).toBeTruthy();

    const edges = allEdges();
    expect(edges.every((e) => e.sourceId === parent?.id)).toBe(true);
    expect(edges.map((e) => e.targetId).sort()).toEqual([childA?.id, childB?.id].sort());
  });

  it('uses "entity" (singular) in the button label when count is 1', () => {
    openDialog();
    typeText('Just one');
    expect(screen.getByRole('button', { name: /Create 1 entity$/i })).toBeTruthy();
  });

  it('uses "entities" (plural) in the button label when count > 1', () => {
    openDialog();
    typeText('One\nTwo');
    expect(screen.getByRole('button', { name: /Create 2 entities$/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Submit via Cmd+Enter / Ctrl+Enter
// ---------------------------------------------------------------------------

describe('submit via keyboard shortcut', () => {
  it('Ctrl+Enter submits the form and creates entities', () => {
    openDialog();
    typeText('Alpha\nBravo\nCharlie');

    const ta = screen.getByRole('textbox');
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    });

    expect(allEntities()).toHaveLength(3);
    expect(s().quickCaptureOpen).toBe(false);
  });

  it('Meta+Enter (Cmd) also submits', () => {
    openDialog();
    typeText('One\nTwo');

    const ta = screen.getByRole('textbox');
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter', metaKey: true });
    });

    expect(allEntities()).toHaveLength(2);
    expect(s().quickCaptureOpen).toBe(false);
  });

  it('plain Enter does NOT submit', () => {
    openDialog();
    typeText('One\nTwo');

    const ta = screen.getByRole('textbox');
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });

    // Dialog stays open, no entities created yet
    expect(s().quickCaptureOpen).toBe(true);
    expect(allEntities()).toHaveLength(0);
  });

  it('Ctrl+Enter on empty input shows toast but does not create entities', () => {
    openDialog();
    // no text typed

    const ta = screen.getByRole('textbox');
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter', ctrlKey: true });
    });

    expect(allEntities()).toHaveLength(0);
    expect(s().toasts.some((t) => t.kind === 'info' && /Nothing to capture/i.test(t.message))).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Attach-to-selection vs float
// ---------------------------------------------------------------------------

describe('attach-to-selection', () => {
  it('attaches roots to a single selected entity', () => {
    const anchor = seedEntity('Anchor', 'effect');
    act(() => s().selectEntity(anchor.id));

    openDialog();
    typeText('Root A\nRoot B');

    // The hint text should mention the anchor title
    expect(screen.getByText(/Roots will attach to/i)).toBeTruthy();
    // The entity title should appear somewhere in the descriptive paragraph
    const hint = screen.getByText(/Roots will attach to/i).closest('p') as HTMLElement;
    expect(within(hint).getByText('Anchor')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: /Create 2 entities/i })));

    // 1 anchor + 2 captured = 3 total
    expect(allEntities()).toHaveLength(3);

    // 2 attach edges from anchor → each root
    const edges = allEdges();
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.sourceId === anchor.id)).toBe(true);
  });

  it('shows float hint when nothing is selected', () => {
    openDialog();
    typeText('Floating root');
    expect(screen.getByText(/Roots will float/i)).toBeTruthy();
  });

  it('floats roots when nothing is selected (no anchor edges)', () => {
    openDialog();
    typeText('Root A\nRoot B');

    act(() => fireEvent.click(screen.getByRole('button', { name: /Create 2 entities/i })));

    expect(allEntities()).toHaveLength(2);
    expect(allEdges()).toHaveLength(0); // no attach edges
  });

  it('does NOT attach when multiple entities are selected (float path)', () => {
    const a = seedEntity('A', 'effect');
    const b = seedEntity('B', 'effect');
    act(() => s().selectEntities([a.id, b.id]));

    openDialog();
    typeText('Root X');
    // Should show float hint since multi-selection doesn't trigger attach
    expect(screen.getByText(/Roots will float/i)).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: /Create 1 entity/i })));

    // 2 seeded + 1 captured = 3; no anchor edges from either a or b
    expect(allEntities()).toHaveLength(3);
    const edges = allEdges();
    expect(edges).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Reset on re-open
// ---------------------------------------------------------------------------

describe('reset on re-open', () => {
  it('clears the textarea when the dialog is re-opened', () => {
    openDialog();
    typeText('Some content here');
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Some content here');

    // Close then re-open
    act(() => s().closeQuickCapture());
    act(() => s().openQuickCapture());

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Cancel button
// ---------------------------------------------------------------------------

describe('cancel button', () => {
  it('closes the dialog without creating anything', () => {
    openDialog();
    typeText('Alpha\nBravo');

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    act(() => fireEvent.click(cancelBtn));

    expect(s().quickCaptureOpen).toBe(false);
    expect(allEntities()).toHaveLength(0);
    expect(allEdges()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Browse-lock guard
// ---------------------------------------------------------------------------

describe('browse-lock guard', () => {
  it('blocks submit when browse lock is on and shows an info toast', () => {
    openDialog();
    typeText('Root A\nRoot B');

    // Enable browse lock
    act(() => s().setBrowseLocked(true));

    act(() => fireEvent.click(screen.getByRole('button', { name: /Create 2 entities/i })));

    // No entities should be created
    expect(allEntities()).toHaveLength(0);

    // An info toast about browse lock should appear
    const lockToast = s().toasts.find((t) => t.kind === 'info' && /Browse Lock/i.test(t.message));
    expect(lockToast).toBeTruthy();

    // Dialog stays open
    expect(s().quickCaptureOpen).toBe(true);
  });
});
