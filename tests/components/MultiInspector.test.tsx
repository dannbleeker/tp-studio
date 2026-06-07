import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MultiInspector } from '@/components/inspector/MultiInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedAndGroupable, seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Block B / B8 — batch-edit MultiInspector. Type conversion + swap +
 * delete were already covered indirectly by Inspector.test.tsx; this
 * file drives the new title-size + renumber controls directly so each
 * batch operation has a focused regression net.
 */

const seedThreeAndSelectAll = (): string[] => {
  const a = seedEntity('A');
  const b = seedEntity('B');
  const c = seedEntity('C');
  const ids = [a.id, b.id, c.id];
  act(() => useDocumentStore.getState().selectEntities(ids));
  return ids;
};

describe('MultiInspector (Block B / B8)', () => {
  it('applies a title size to every selected entity', () => {
    const ids = seedThreeAndSelectAll();
    const { container } = render(<MultiInspector kind="entities" ids={ids} />);
    const compactBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Compact')
    ) as HTMLButtonElement | undefined;
    expect(compactBtn).toBeTruthy();
    act(() => fireEvent.click(compactBtn!));
    for (const id of ids) {
      expect(useDocumentStore.getState().doc.entities[id]?.titleSize).toBe('sm');
    }
  });

  it('"Regular" applies as undefined (no persisted titleSize)', () => {
    const ids = seedThreeAndSelectAll();
    // Set them all to "lg" first, then back to Regular.
    for (const id of ids) {
      act(() => useDocumentStore.getState().updateEntity(id, { titleSize: 'lg' }));
    }
    const { container } = render(<MultiInspector kind="entities" ids={ids} />);
    const regular = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Regular')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(regular));
    for (const id of ids) {
      expect(useDocumentStore.getState().doc.entities[id]?.titleSize).toBeUndefined();
    }
  });

  it('Renumber starts at 1 and walks the selection in order', () => {
    const ids = seedThreeAndSelectAll();
    const { container } = render(<MultiInspector kind="entities" ids={ids} />);
    // Renumber button text includes the range; "Apply 1…3" for three items.
    const apply = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Apply 1')
    ) as HTMLButtonElement | undefined;
    expect(apply).toBeTruthy();
    act(() => fireEvent.click(apply!));
    expect(useDocumentStore.getState().doc.entities[ids[0]!]?.ordering).toBe(1);
    expect(useDocumentStore.getState().doc.entities[ids[1]!]?.ordering).toBe(2);
    expect(useDocumentStore.getState().doc.entities[ids[2]!]?.ordering).toBe(3);
  });

  it('Renumber uses the start-at input', () => {
    const ids = seedThreeAndSelectAll();
    const { container } = render(<MultiInspector kind="entities" ids={ids} />);
    const start = container.querySelector(
      'input[aria-label="Renumber starting at"]'
    ) as HTMLInputElement;
    act(() => fireEvent.change(start, { target: { value: '10' } }));
    const apply = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Apply 10')
    ) as HTMLButtonElement;
    act(() => fireEvent.click(apply));
    expect(useDocumentStore.getState().doc.entities[ids[0]!]?.ordering).toBe(10);
    expect(useDocumentStore.getState().doc.entities[ids[2]!]?.ordering).toBe(12);
  });

  it('Renumber control is hidden for a single-entity selection (length < 2)', () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntities([a.id]));
    const { container } = render(<MultiInspector kind="entities" ids={[a.id]} />);
    // The renumber number-input has a distinctive aria-label.
    expect(container.querySelector('input[aria-label="Renumber starting at"]')).toBeNull();
  });

  it('Browse Lock disables title-size + renumber controls', () => {
    const ids = seedThreeAndSelectAll();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<MultiInspector kind="entities" ids={ids} />);
    const compact = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Compact')
    ) as HTMLButtonElement;
    expect(compact.disabled).toBe(true);
    const start = container.querySelector(
      'input[aria-label="Renumber starting at"]'
    ) as HTMLInputElement;
    expect(start.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Helpers for the new suites below
// ---------------------------------------------------------------------------

/**
 * Poll until the in-app ConfirmDialog opens (i.e. state.confirmDialog is
 * non-null), resolve with the given answer, and return the message text so
 * callers can assert on it. Mirrors the pattern in
 * tests/services/confirmations.test.ts.
 */
const settleNextConfirm = (answer: boolean): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const cur = useDocumentStore.getState().confirmDialog;
      if (cur) {
        const msg = cur.message;
        useDocumentStore.getState().resolveConfirm(answer);
        resolve(msg);
        return;
      }
      if (Date.now() - start > 1000) {
        reject(new Error('Timeout waiting for ConfirmDialog'));
        return;
      }
      setTimeout(tick, 5);
    };
    tick();
  });

/** Seed two entities connected a→b; also add a second pair c→d. Both edges share NO target. */
const seedTwoEdgesDifferentTargets = () => {
  const { edge: e1 } = seedConnectedPair('A', 'B');
  const { edge: e2 } = seedConnectedPair('C', 'D');
  return { e1, e2 };
};

/** Seed three entities a, b, c and connect both a→c and b→c (shared target). */
const seedTwoEdgesSameTarget = () => {
  const { a, b, c, e1, e2 } = seedAndGroupable();
  return { a, b, c, e1, e2 };
};

// ---------------------------------------------------------------------------
// EntitiesMulti — Delete entities button (line 213)
// ---------------------------------------------------------------------------

describe('MultiInspector — delete entities', () => {
  it('clicking "Delete N entities" opens the confirm dialog', async () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);

    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('entit'));
    expect(delBtn, 'Delete entities button not found').toBeDefined();

    // Start the delete — fire-and-forget; we'll settle via settleNextConfirm.
    const settlePromise = settleNextConfirm(true);
    act(() => fireEvent.click(delBtn!));
    await settlePromise;

    // Both entities should now be gone.
    expect(useDocumentStore.getState().doc.entities[a.id]).toBeUndefined();
    expect(useDocumentStore.getState().doc.entities[b.id]).toBeUndefined();
  });

  it('cancelling the confirm dialog leaves entities intact', async () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);

    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('entit'));
    expect(delBtn, 'Delete entities button not found').toBeDefined();

    const settlePromise = settleNextConfirm(false);
    act(() => fireEvent.click(delBtn!));
    await settlePromise;

    expect(useDocumentStore.getState().doc.entities[a.id]).toBeDefined();
    expect(useDocumentStore.getState().doc.entities[b.id]).toBeDefined();
  });

  it('"Delete N entities" button is disabled under Browse Lock', () => {
    const a = seedEntity('Alpha');
    const b = seedEntity('Beta');
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    render(<MultiInspector kind="entities" ids={[a.id, b.id]} />);

    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('entit')) as
      | HTMLButtonElement
      | undefined;
    expect(delBtn?.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — rendering (lines 280-424)
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti rendering', () => {
  it('renders "N edges selected" summary', () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.getByText(/2 edges selected/i)).toBeTruthy();
  });

  it('reports "Share a target" when all selected edges share a common target', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.getByText(/Share a target/i)).toBeTruthy();
  });

  it('reports "Different targets" when selected edges have distinct targets', () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.getByText(/Different targets/i)).toBeTruthy();
  });

  it('renders null when none of the ids reference existing edges', () => {
    const { container } = render(<MultiInspector kind="edges" ids={['no-edge-1', 'no-edge-2']} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders Group as AND / Group as OR / Group as XOR buttons', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.getByRole('button', { name: /Group as AND/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Group as OR/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Group as XOR/i })).toBeTruthy();
  });

  it('"Delete N edges" button is visible', () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('edge'));
    expect(delBtn).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — AND grouping
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti AND group', () => {
  it('"Group as AND" sets andGroupId on both edges', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const btn = screen.getByRole('button', { name: /Group as AND/i });
    act(() => fireEvent.click(btn));

    const s = useDocumentStore.getState();
    expect(s.doc.edges[e1.id]?.andGroupId).toBeTruthy();
    expect(s.doc.edges[e2.id]?.andGroupId).toBeTruthy();
    expect(s.doc.edges[e1.id]?.andGroupId).toBe(s.doc.edges[e2.id]?.andGroupId);
  });

  it('"Ungroup AND" button appears after AND-grouping and clears the group', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();

    // AND-group first via the store directly.
    const result = useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    if (!result.ok) throw new Error('groupAsAnd failed');

    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    const ungroupBtn = screen.getByRole('button', { name: /Ungroup AND/i });
    expect(ungroupBtn).toBeTruthy();

    act(() => fireEvent.click(ungroupBtn));
    expect(useDocumentStore.getState().doc.edges[e1.id]?.andGroupId).toBeUndefined();
    expect(useDocumentStore.getState().doc.edges[e2.id]?.andGroupId).toBeUndefined();
  });

  it('"Ungroup AND" button does NOT render when no edge has andGroupId', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.queryByRole('button', { name: /Ungroup AND/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — OR grouping
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti OR group', () => {
  it('"Group as OR" sets orGroupId on both edges', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const btn = screen.getByRole('button', { name: /Group as OR/i });
    act(() => fireEvent.click(btn));

    const s = useDocumentStore.getState();
    expect(s.doc.edges[e1.id]?.orGroupId).toBeTruthy();
    expect(s.doc.edges[e2.id]?.orGroupId).toBeTruthy();
    expect(s.doc.edges[e1.id]?.orGroupId).toBe(s.doc.edges[e2.id]?.orGroupId);
  });

  it('"Ungroup OR" button appears after OR-grouping and clears the group', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    const result = useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    if (!result.ok) throw new Error('groupAsOr failed');

    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    const ungroupBtn = screen.getByRole('button', { name: /Ungroup OR/i });
    expect(ungroupBtn).toBeTruthy();

    act(() => fireEvent.click(ungroupBtn));
    expect(useDocumentStore.getState().doc.edges[e1.id]?.orGroupId).toBeUndefined();
    expect(useDocumentStore.getState().doc.edges[e2.id]?.orGroupId).toBeUndefined();
  });

  it('"Ungroup OR" button does NOT render when no edge has orGroupId', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.queryByRole('button', { name: /Ungroup OR/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — XOR grouping
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti XOR group', () => {
  it('"Group as XOR" sets xorGroupId on both edges', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const btn = screen.getByRole('button', { name: /Group as XOR/i });
    act(() => fireEvent.click(btn));

    const s = useDocumentStore.getState();
    expect(s.doc.edges[e1.id]?.xorGroupId).toBeTruthy();
    expect(s.doc.edges[e2.id]?.xorGroupId).toBeTruthy();
    expect(s.doc.edges[e1.id]?.xorGroupId).toBe(s.doc.edges[e2.id]?.xorGroupId);
  });

  it('"Ungroup XOR" button appears after XOR-grouping and clears the group', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    const result = useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
    if (!result.ok) throw new Error('groupAsXor failed');

    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    const ungroupBtn = screen.getByRole('button', { name: /Ungroup XOR/i });
    expect(ungroupBtn).toBeTruthy();

    act(() => fireEvent.click(ungroupBtn));
    expect(useDocumentStore.getState().doc.edges[e1.id]?.xorGroupId).toBeUndefined();
    expect(useDocumentStore.getState().doc.edges[e2.id]?.xorGroupId).toBeUndefined();
  });

  it('"Ungroup XOR" button does NOT render when no edge has xorGroupId', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);
    expect(screen.queryByRole('button', { name: /Ungroup XOR/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — delete edges
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti delete edges', () => {
  it('clicking "Delete N edges" opens the confirm dialog and deletes on confirm', async () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    act(() => useDocumentStore.getState().selectEdges([e1.id, e2.id]));
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('edge'));
    expect(delBtn, 'Delete edges button not found').toBeDefined();

    const settlePromise = settleNextConfirm(true);
    act(() => fireEvent.click(delBtn!));
    await settlePromise;

    expect(useDocumentStore.getState().doc.edges[e1.id]).toBeUndefined();
    expect(useDocumentStore.getState().doc.edges[e2.id]).toBeUndefined();
  });

  it('cancelling the confirm dialog leaves edges intact', async () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    act(() => useDocumentStore.getState().selectEdges([e1.id, e2.id]));
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('edge'));
    expect(delBtn).toBeDefined();

    const settlePromise = settleNextConfirm(false);
    act(() => fireEvent.click(delBtn!));
    await settlePromise;

    expect(useDocumentStore.getState().doc.edges[e1.id]).toBeDefined();
    expect(useDocumentStore.getState().doc.edges[e2.id]).toBeDefined();
  });

  it('"Delete N edges" button is disabled under Browse Lock', () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('edge')) as
      | HTMLButtonElement
      | undefined;
    expect(delBtn?.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — Browse Lock disables all group/ungroup buttons
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti Browse Lock', () => {
  it('disables all group buttons under Browse Lock', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const andBtn = screen.getByRole('button', { name: /Group as AND/i }) as HTMLButtonElement;
    const orBtn = screen.getByRole('button', { name: /Group as OR/i }) as HTMLButtonElement;
    const xorBtn = screen.getByRole('button', { name: /Group as XOR/i }) as HTMLButtonElement;
    expect(andBtn.disabled).toBe(true);
    expect(orBtn.disabled).toBe(true);
    expect(xorBtn.disabled).toBe(true);
  });

  it('disables Ungroup AND/OR/XOR buttons under Browse Lock', () => {
    const { e1, e2 } = seedTwoEdgesSameTarget();
    // Set up all three group types so all three Ungroup buttons render.
    // Re-use same edge ids; the store allows layering groups.
    useDocumentStore.getState().groupAsAnd([e1.id, e2.id]);
    useDocumentStore.getState().groupAsOr([e1.id, e2.id]);
    useDocumentStore.getState().groupAsXor([e1.id, e2.id]);
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const ungroupAnd = screen.queryByRole('button', {
      name: /Ungroup AND/i,
    }) as HTMLButtonElement | null;
    const ungroupOr = screen.queryByRole('button', {
      name: /Ungroup OR/i,
    }) as HTMLButtonElement | null;
    const ungroupXor = screen.queryByRole('button', {
      name: /Ungroup XOR/i,
    }) as HTMLButtonElement | null;
    // At least the ungroup buttons that exist should be disabled.
    if (ungroupAnd) expect(ungroupAnd.disabled).toBe(true);
    if (ungroupOr) expect(ungroupOr.disabled).toBe(true);
    if (ungroupXor) expect(ungroupXor.disabled).toBe(true);
    // The delete button should also be disabled.
    const delBtn = screen
      .getAllByRole('button')
      .find((btn) => btn.textContent?.includes('Delete') && btn.textContent?.includes('edge')) as
      | HTMLButtonElement
      | undefined;
    expect(delBtn?.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EdgesMulti — grouping error path (different targets → !result.ok)
// ---------------------------------------------------------------------------

describe('MultiInspector — EdgesMulti group error path', () => {
  it('"Group as AND" shows an error toast when edges have different targets', () => {
    // Two edges with DIFFERENT targets cannot be AND-grouped.
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const btn = screen.getByRole('button', { name: /Group as AND/i });
    act(() => fireEvent.click(btn));

    // The store should NOT have set an andGroupId.
    const s = useDocumentStore.getState();
    expect(s.doc.edges[e1.id]?.andGroupId).toBeUndefined();
    expect(s.doc.edges[e2.id]?.andGroupId).toBeUndefined();
    // A toast error should have been queued.
    expect(s.toasts.length).toBeGreaterThan(0);
    expect(s.toasts.some((t) => t.kind === 'error')).toBe(true);
  });

  it('"Group as OR" shows an error toast when edges have different targets', () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const btn = screen.getByRole('button', { name: /Group as OR/i });
    act(() => fireEvent.click(btn));

    const s = useDocumentStore.getState();
    expect(s.doc.edges[e1.id]?.orGroupId).toBeUndefined();
    expect(s.toasts.some((t) => t.kind === 'error')).toBe(true);
  });

  it('"Group as XOR" shows an error toast when edges have different targets', () => {
    const { e1, e2 } = seedTwoEdgesDifferentTargets();
    render(<MultiInspector kind="edges" ids={[e1.id, e2.id]} />);

    const btn = screen.getByRole('button', { name: /Group as XOR/i });
    act(() => fireEvent.click(btn));

    const s = useDocumentStore.getState();
    expect(s.doc.edges[e1.id]?.xorGroupId).toBeUndefined();
    expect(s.toasts.some((t) => t.kind === 'error')).toBe(true);
  });
});
