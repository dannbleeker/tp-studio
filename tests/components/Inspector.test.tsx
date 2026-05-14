import { Inspector } from '@/components/inspector/Inspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

describe('Inspector', () => {
  it('stays hidden (translate-x-full) when nothing is selected', () => {
    const { container } = render(<Inspector />);
    const aside = container.querySelector('aside')!;
    expect(aside.className).toContain('translate-x-full');
    expect(aside.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the EntityInspector when a single entity is selected', () => {
    const a = seedEntity('Order entry is manual');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container, getByText } = render(<Inspector />);
    const aside = container.querySelector('aside')!;
    expect(aside.className).not.toContain('translate-x-full');
    // Header label
    expect(getByText('Entity')).toBeTruthy();
    // Title field is pre-filled with the entity's title
    const title = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(title.value).toBe('Order entry is manual');
  });

  it('shows the multi-selection summary when two entities are selected', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    act(() => useDocumentStore.getState().selectEntities([a.id, b.id]));
    const { container, getByText } = render(<Inspector />);
    expect(getByText('2 entities')).toBeTruthy();
    // Multi panel reports the entities-selected line.
    expect(container.textContent).toContain('2 entities selected');
    // Convert-all and bulk delete buttons land in the multi view.
    expect(container.textContent).toContain('Convert all to');
    expect(container.textContent).toContain('Delete 2 entities');
  });

  it('shows the GroupInspector when a single group id is selected', () => {
    const a = seedEntity('A');
    const g = useDocumentStore
      .getState()
      .createGroupFromSelection([a.id], { title: 'My Group', color: 'amber' });
    if (!g) throw new Error('group not created');
    // Session 85 (#1) — `selectGroup` brands the id correctly into
    // the new `Selection` `groups` variant; previously this used
    // `selectEntity(g.id)` and relied on cross-detection.
    act(() => useDocumentStore.getState().selectGroup(g.id));
    const { container, getByText } = render(<Inspector />);
    expect(getByText('Group')).toBeTruthy();
    // Group rename input is pre-filled.
    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(titleInput.value).toBe('My Group');
  });

  it('Close button (X) clears the selection', () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container } = render(<Inspector />);
    const closeBtn = container.querySelector('button[aria-label="Close inspector"]')!;
    act(() => fireEvent.click(closeBtn));
    expect(useDocumentStore.getState().selection.kind).toBe('none');
  });

  it('renders a narrow-viewport dismiss backdrop that clears the selection', () => {
    // The backdrop is the tap-to-dismiss surface that overlays the canvas
    // when the inspector is open at < md. CSS hides it from md+ via
    // `md:hidden`, but in jsdom the element is present in the DOM either
    // way — what we pin here is the click handler + the aria-label.
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container } = render(<Inspector />);
    const backdrop = container.querySelector('button[aria-label="Dismiss inspector"]');
    expect(backdrop).toBeTruthy();
    act(() => fireEvent.click(backdrop!));
    expect(useDocumentStore.getState().selection.kind).toBe('none');
  });

  it('the dismiss backdrop is absent when nothing is selected', () => {
    const { container } = render(<Inspector />);
    expect(container.querySelector('button[aria-label="Dismiss inspector"]')).toBeNull();
  });

  it('renders the Edit/Preview toggle for the description field', () => {
    const a = seedEntity('A');
    act(() => useDocumentStore.getState().selectEntity(a.id));
    const { container } = render(<Inspector />);
    const toggles = Array.from(container.querySelectorAll('button[aria-pressed]')).filter((b) =>
      /Edit|Preview/i.test(b.textContent ?? '')
    );
    expect(toggles.length).toBe(2);
  });
});
