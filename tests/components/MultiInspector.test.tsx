import { MultiInspector } from '@/components/inspector/MultiInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

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
