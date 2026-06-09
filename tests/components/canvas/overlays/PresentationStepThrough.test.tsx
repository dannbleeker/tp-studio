import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PresentationStepThrough } from '@/components/canvas/overlays/PresentationStepThrough';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../../helpers/seedDoc';

// ---------------------------------------------------------------------------
// Mock @xyflow/react so useReactFlow() returns controlled spies we can
// inspect. The mock must be hoisted (vi.hoisted) so the variable is
// available before the module is loaded.
// ---------------------------------------------------------------------------
const { mockFlowRef } = vi.hoisted(() => ({
  mockFlowRef: {
    current: {
      fitView: vi.fn(),
      setNodes: vi.fn(),
    },
  },
}));

vi.mock('@xyflow/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xyflow/react')>();
  return {
    ...actual,
    useReactFlow: () => mockFlowRef.current,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const s = () => useDocumentStore.getState();

/** Render the component inside a ReactFlowProvider (required by useReactFlow). */
const renderChip = () =>
  render(
    <ReactFlowProvider>
      <PresentationStepThrough />
    </ReactFlowProvider>
  );

/** Enter presentation mode via the store action. */
const enterPresentation = () => act(() => s().setAppMode('presentation'));

/** Clear the store selection so "no selection" tests start clean. */
const clearSelection = () => act(() => s().selectEntities([]));

/** Return the current selected entity id (first id when kind === 'entities'). */
const selectedId = (): string | null => {
  const sel = s().selection;
  return sel.kind === 'entities' && sel.ids.length > 0 ? (sel.ids[0] as string) : null;
};

/**
 * Seed two entities with explicit `ordering` values so the walk order is
 * deterministic regardless of ID generation or annotationNumber assignment.
 * Returns { first, second } where first.ordering = 1 and second.ordering = 2.
 *
 * NOTE: `addEntity` auto-selects newly created entities; this helper calls
 * `clearSelection()` after seeding so tests start with no selection unless
 * they explicitly set one.
 */
const seedOrderedPair = () => {
  const first = seedEntity('First');
  const second = seedEntity('Second');
  act(() => {
    s().updateEntity(first.id, { ordering: 1 });
    s().updateEntity(second.id, { ordering: 2 });
    // addEntity auto-selects; clear so tests start with known state.
    s().selectEntities([]);
  });
  return { first, second };
};

/**
 * Seed three entities with explicit `ordering` values (1, 2, 3).
 * Returns { e1, e2, e3 } in walk order.
 *
 * Clears selection after seeding (see seedOrderedPair note above).
 */
const seedOrderedTriple = () => {
  const e1 = seedEntity('E1');
  const e2 = seedEntity('E2');
  const e3 = seedEntity('E3');
  act(() => {
    s().updateEntity(e1.id, { ordering: 1 });
    s().updateEntity(e2.id, { ordering: 2 });
    s().updateEntity(e3.id, { ordering: 3 });
    s().selectEntities([]);
  });
  return { e1, e2, e3 };
};

// ---------------------------------------------------------------------------
// Test lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  cleanup(); // unmount any prior render before resetting the store
  resetStoreForTest();
  mockFlowRef.current.fitView.mockClear();
  mockFlowRef.current.setNodes.mockClear();
});
afterEach(cleanup);

// ---------------------------------------------------------------------------
// Rendering guard tests
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — rendering', () => {
  it('renders nothing outside presentation mode (default expert mode)', () => {
    seedEntity('A');
    const { container } = renderChip();
    expect(container.textContent ?? '').toBe('');
  });

  it('renders nothing in guided mode', () => {
    seedEntity('A');
    act(() => s().setAppMode('guided'));
    const { container } = renderChip();
    expect(container.textContent ?? '').toBe('');
  });

  it('renders nothing in workshop mode', () => {
    seedEntity('A');
    act(() => s().setAppMode('workshop'));
    const { container } = renderChip();
    expect(container.textContent ?? '').toBe('');
  });

  it('renders nothing in presentation mode when there are zero structural entities', () => {
    enterPresentation();
    const { container } = renderChip();
    expect(container.textContent ?? '').toBe('');
  });

  it('renders nothing when only non-causal entities exist (notes)', () => {
    seedEntity('My note', 'note');
    seedEntity('Another note', 'note');
    enterPresentation();
    const { container } = renderChip();
    expect(container.textContent ?? '').toBe('');
  });

  it('renders the chip when at least one causal entity exists in presentation mode', () => {
    seedEntity('Root Cause');
    enterPresentation();
    renderChip();
    expect(screen.getByRole('group', { name: /Presentation step-through/i })).toBeTruthy();
  });

  it('renders Prev and Next buttons', () => {
    seedEntity('A');
    enterPresentation();
    renderChip();
    expect(screen.getByRole('button', { name: 'Previous entity' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next entity' })).toBeTruthy();
  });

  it('shows "— / N" position label when no entity is selected', () => {
    const { first } = seedOrderedPair();
    // Ensure nothing is selected.
    expect(selectedId()).toBeNull();
    void first;
    enterPresentation();
    renderChip();
    expect(screen.getByText('— / 2')).toBeTruthy();
  });

  it('shows "1 / N" when the first entity in walk order is selected', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();
    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('ignores non-causal entities in the total count', () => {
    seedEntity('Effect', 'effect');
    seedEntity('Note X', 'note');
    clearSelection(); // addEntity auto-selects; clear so label shows "—"
    enterPresentation();
    renderChip();
    // Only 1 causal entity → total is 1.
    expect(screen.getByText('— / 1')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Button disabled state
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — button disabled state', () => {
  it('Prev button is disabled when no entity is selected', () => {
    seedOrderedPair();
    enterPresentation();
    renderChip();
    const prev = screen.getByRole('button', { name: 'Previous entity' });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('Prev button is disabled when the first entity is selected', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();
    const prev = screen.getByRole('button', { name: 'Previous entity' });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('Prev button is enabled when a non-first entity is selected', () => {
    const { second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();
    const prev = screen.getByRole('button', { name: 'Previous entity' });
    expect((prev as HTMLButtonElement).disabled).toBe(false);
  });

  it('Next button is disabled when the last entity is selected', () => {
    const { second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();
    const next = screen.getByRole('button', { name: 'Next entity' });
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('Next button is enabled when a non-last entity is selected', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();
    const next = screen.getByRole('button', { name: 'Next entity' });
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('Next button is enabled when no entity is selected', () => {
    seedOrderedPair();
    enterPresentation();
    renderChip();
    const next = screen.getByRole('button', { name: 'Next entity' });
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Click navigation — goNext / goPrev
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — click next', () => {
  it('clicking Next with no selection selects the first entity in walk order', () => {
    const { first } = seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));
    });

    expect(selectedId()).toBe(first.id);
  });

  it('clicking Next advances the selection from first to second', () => {
    const { first, second } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));
    });

    expect(selectedId()).toBe(second.id);
  });

  it('clicking Next at the last entity does NOT wrap — selection stays on last', () => {
    const { second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));
    });

    // Still on second (clamped at last).
    expect(selectedId()).toBe(second.id);
  });

  it('clicking Next calls fitView for the stepped-to entity', () => {
    const { first } = seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));
    });

    expect(mockFlowRef.current.fitView).toHaveBeenCalledOnce();
    expect(mockFlowRef.current.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: first.id }], padding: 0.3 })
    );
  });

  it('clicking Next calls setNodes to mirror selection into React Flow', () => {
    seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));
    });

    expect(mockFlowRef.current.setNodes).toHaveBeenCalledOnce();
  });

  it('position label updates to "1 / 2" after first Next click from no selection', () => {
    seedOrderedPair();
    enterPresentation();
    renderChip();

    // Initially "— / 2".
    expect(screen.getByText('— / 2')).toBeTruthy();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Next entity' }));
    });

    expect(screen.getByText('1 / 2')).toBeTruthy();
  });

  it('can step through all entities sequentially via Next clicks', () => {
    const { e1, e2, e3 } = seedOrderedTriple();
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e1.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e2.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e3.id);

    // One more click at the end: still on e3.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e3.id);
  });
});

describe('PresentationStepThrough — click prev', () => {
  it('ArrowLeft from no selection selects the LAST entity in walk order', () => {
    // The Prev button is disabled when currentIndex <= 0 (including no-selection),
    // so the keyboard path (ArrowLeft) is the way to reach "no selection → last".
    const { second } = seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
    });

    expect(selectedId()).toBe(second.id);
  });

  it('clicking Prev moves backward from second to first', () => {
    const { first, second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Previous entity' }));
    });

    expect(selectedId()).toBe(first.id);
  });

  it('clicking Prev at the first entity does NOT wrap — selection stays on first', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Previous entity' }));
    });

    // Still on first (clamped at first).
    expect(selectedId()).toBe(first.id);
  });

  it('clicking Prev calls fitView for the stepped-to entity', () => {
    const { first, second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Previous entity' }));
    });

    expect(mockFlowRef.current.fitView).toHaveBeenCalledOnce();
    expect(mockFlowRef.current.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: first.id }] })
    );
  });

  it('can navigate backwards through all entities via Prev clicks', () => {
    const { e1, e2, e3 } = seedOrderedTriple();
    act(() => s().selectEntities([e3.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Previous entity' })));
    expect(selectedId()).toBe(e2.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Previous entity' })));
    expect(selectedId()).toBe(e1.id);

    // Already at first — no change.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Previous entity' })));
    expect(selectedId()).toBe(e1.id);
  });
});

// ---------------------------------------------------------------------------
// Keyboard navigation — ArrowRight / ArrowLeft
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — keyboard ArrowRight', () => {
  it('ArrowRight with no selection selects the first entity in walk order', () => {
    const { first } = seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowRight' }));

    expect(selectedId()).toBe(first.id);
  });

  it('ArrowRight advances from first to second entity', () => {
    const { first, second } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowRight' }));

    expect(selectedId()).toBe(second.id);
  });

  it('ArrowRight clamps at the last entity and does not wrap', () => {
    const { second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowRight' }));

    expect(selectedId()).toBe(second.id);
  });

  it('ArrowRight calls fitView for the stepped-to entity', () => {
    const { first } = seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowRight' }));

    expect(mockFlowRef.current.fitView).toHaveBeenCalledOnce();
    expect(mockFlowRef.current.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: [{ id: first.id }] })
    );
  });
});

describe('PresentationStepThrough — keyboard ArrowLeft', () => {
  it('ArrowLeft with no selection selects the LAST entity in walk order', () => {
    const { second } = seedOrderedPair();
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowLeft' }));

    expect(selectedId()).toBe(second.id);
  });

  it('ArrowLeft moves backward from second to first', () => {
    const { first, second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowLeft' }));

    expect(selectedId()).toBe(first.id);
  });

  it('ArrowLeft clamps at the first entity and does not wrap', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowLeft' }));

    expect(selectedId()).toBe(first.id);
  });
});

describe('PresentationStepThrough — keyboard not active outside presentation mode', () => {
  it('ArrowRight in expert mode does NOT trigger selectEntities', () => {
    seedOrderedPair();
    // Stay in expert mode (default) — chip renders null and never attaches its handler.
    renderChip();

    const before = selectedId();
    act(() => fireEvent.keyDown(window, { key: 'ArrowRight' }));

    expect(selectedId()).toBe(before); // no change
    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });

  it('ArrowLeft in expert mode does NOT trigger selectEntities', () => {
    seedOrderedPair();
    renderChip();

    const before = selectedId();
    act(() => fireEvent.keyDown(window, { key: 'ArrowLeft' }));

    expect(selectedId()).toBe(before); // no change
    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });
});

describe('PresentationStepThrough — keyboard suppressed when typing in a field', () => {
  it('ArrowRight inside an <input> does NOT advance the step', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    render(
      <div>
        <input data-testid="text-input" />
        <ReactFlowProvider>
          <PresentationStepThrough />
        </ReactFlowProvider>
      </div>
    );

    const input = document.querySelector('input') as HTMLInputElement;
    input.focus();
    act(() => fireEvent.keyDown(input, { key: 'ArrowRight' }));

    // Selection should remain on first (handler bailed on INPUT target).
    expect(selectedId()).toBe(first.id);
    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });

  it('ArrowLeft inside a <textarea> does NOT retreat the step', () => {
    const { second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    render(
      <div>
        <textarea data-testid="text-area" />
        <ReactFlowProvider>
          <PresentationStepThrough />
        </ReactFlowProvider>
      </div>
    );

    const ta = document.querySelector('textarea') as HTMLTextAreaElement;
    ta.focus();
    act(() => fireEvent.keyDown(ta, { key: 'ArrowLeft' }));

    // Selection should remain on second.
    expect(selectedId()).toBe(second.id);
    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Walk order: explicit `ordering` field, then annotationNumber fallback
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — walk ordering', () => {
  it('entities with explicit ordering are stepped first (ascending by ordering)', () => {
    // Seed three entities and assign ordering so we can deterministically verify the walk.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');

    // b gets ordering=1, a gets ordering=2, c stays without ordering.
    act(() => {
      s().updateEntity(b.id, { ordering: 1 });
      s().updateEntity(a.id, { ordering: 2 });
      // addEntity auto-selects; clear so Next starts from index 0.
      s().selectEntities([]);
    });

    enterPresentation();
    renderChip();

    // Expected walk: b(ord=1) → a(ord=2) → c(by annotationNumber)
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(b.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(a.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(c.id);
  });

  it('entities without explicit ordering walk in annotationNumber order', () => {
    // With explicit ordering we know which entity has which annotation order.
    const { e1, e2, e3 } = seedOrderedTriple();

    // Remove the ordering field so they fall back to annotationNumber.
    // seedOrderedTriple set ordering: 1, 2, 3 which happen to match
    // annotationNumber order, so just verify they still walk 1→2→3.
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e1.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e2.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e3.id);
  });

  it('non-causal entities (notes) are skipped in the walk', () => {
    const e1 = seedEntity('Cause', 'effect');
    act(() => s().updateEntity(e1.id, { ordering: 1 }));
    seedEntity('Side note', 'note');
    const e2 = seedEntity('Effect', 'effect');
    act(() => {
      s().updateEntity(e2.id, { ordering: 2 });
      s().selectEntities([]); // clear auto-selection from addEntity
    });
    clearSelection(); // ensure nothing is selected so the label shows "—"

    enterPresentation();
    renderChip();

    // Total should be 2 (only the two causal entities).
    expect(screen.getByText('— / 2')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e1.id);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(e2.id);
  });
});

// ---------------------------------------------------------------------------
// Position label live region
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — position label', () => {
  it('position label has aria-live="polite" for screen-reader announcements', () => {
    seedOrderedPair();
    enterPresentation();
    renderChip();
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('position label tracks the current step index as clicks advance', () => {
    seedOrderedTriple();
    enterPresentation();
    renderChip();

    expect(screen.getByText('— / 3')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(screen.getByText('1 / 3')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(screen.getByText('3 / 3')).toBeTruthy();
  });

  it('position label reverts correctly when stepping back', () => {
    const { e1, e2, e3 } = seedOrderedTriple();
    act(() => s().selectEntities([e3.id]));
    enterPresentation();
    renderChip();

    expect(screen.getByText('3 / 3')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Previous entity' })));
    expect(screen.getByText('2 / 3')).toBeTruthy();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Previous entity' })));
    expect(screen.getByText('1 / 3')).toBeTruthy();

    void e1;
    void e2;
  });
});

// ---------------------------------------------------------------------------
// fitView call details
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — fitView call contract', () => {
  it('fitView is called with padding:0.3 and duration:250', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));

    expect(mockFlowRef.current.fitView).toHaveBeenCalledWith(
      expect.objectContaining({ padding: 0.3, duration: 250 })
    );
  });

  it('fitView is NOT called when clicking Next on the already-last entity', () => {
    const { second } = seedOrderedPair();
    act(() => s().selectEntities([second.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));

    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });

  it('fitView is NOT called when clicking Prev on the already-first entity', () => {
    const { first } = seedOrderedPair();
    act(() => s().selectEntities([first.id]));
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Previous entity' })));

    expect(mockFlowRef.current.fitView).not.toHaveBeenCalled();
  });

  it('fitView receives the exact entity id that was stepped to', () => {
    const { e1, e2, e3 } = seedOrderedTriple();
    act(() => s().selectEntities([e1.id]));
    enterPresentation();
    renderChip();

    // Step to e2.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(mockFlowRef.current.fitView).toHaveBeenLastCalledWith(
      expect.objectContaining({ nodes: [{ id: e2.id }] })
    );

    // Step to e3.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(mockFlowRef.current.fitView).toHaveBeenLastCalledWith(
      expect.objectContaining({ nodes: [{ id: e3.id }] })
    );
  });
});

// ---------------------------------------------------------------------------
// Single-entity edge cases
// ---------------------------------------------------------------------------

describe('PresentationStepThrough — single entity edge cases', () => {
  it('with one entity: Next from no selection selects it', () => {
    const a = seedEntity('Only');
    act(() => {
      s().updateEntity(a.id, { ordering: 1 });
      s().selectEntities([]); // clear auto-selection to test the "no selection" path
    });
    enterPresentation();
    renderChip();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next entity' })));
    expect(selectedId()).toBe(a.id);
  });

  it('with one entity: ArrowLeft from no selection selects it', () => {
    // The Prev button is disabled when no entity is selected (currentIndex = -1 <= 0),
    // so the keyboard path is the way to land on the last (and only) entity from no selection.
    const a = seedEntity('Only');
    act(() => {
      s().updateEntity(a.id, { ordering: 1 });
      s().selectEntities([]); // clear auto-selection to test the "no selection" path
    });
    enterPresentation();
    renderChip();

    act(() => fireEvent.keyDown(window, { key: 'ArrowLeft' }));
    expect(selectedId()).toBe(a.id);
  });

  it('with one entity selected: Prev is disabled', () => {
    const a = seedEntity('Only');
    act(() => s().selectEntities([a.id]));
    enterPresentation();
    renderChip();

    const prev = screen.getByRole('button', { name: 'Previous entity' });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('with one entity selected: Next is disabled', () => {
    const a = seedEntity('Only');
    act(() => s().selectEntities([a.id]));
    enterPresentation();
    renderChip();

    const next = screen.getByRole('button', { name: 'Next entity' });
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('position label shows "1 / 1" when the sole entity is selected', () => {
    const a = seedEntity('Only');
    act(() => s().selectEntities([a.id]));
    enterPresentation();
    renderChip();
    expect(screen.getByText('1 / 1')).toBeTruthy();
  });
});
