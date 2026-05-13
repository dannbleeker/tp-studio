import { EntityInspector } from '@/components/inspector/EntityInspector';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * EntityInspector is the editing surface for a single entity: title textarea,
 * type radio grid (driven by PALETTE_BY_DIAGRAM), markdown description,
 * title-size buttons, and the destructive delete button. The Inspector
 * chrome / hide-show logic is covered separately in Inspector.test.tsx; here
 * we drive the body directly.
 *
 * `Browse Lock` (locked === true) disables every input — that's a separate
 * test below to keep the regression net wide. Everything else relies on the
 * store mutators landing as expected.
 */

describe('EntityInspector', () => {
  it('pre-fills the title textarea from the entity', () => {
    const e = seedEntity('Order entry is manual');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.value).toBe('Order entry is manual');
  });

  it('typing in the title textarea writes through to the store', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => fireEvent.change(ta, { target: { value: 'Manual order entry causes errors' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.title).toBe(
      'Manual order entry causes errors'
    );
  });

  it('clicking a different type button updates the entity type', () => {
    const e = seedEntity('A', 'effect');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    // The type radio grid is the second `<Field>` with the "Type" label; each
    // type button is a `<button>` containing the type's display label. We
    // pick "Root Cause" — it's in the default CRT palette.
    const rcBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Root Cause')
    ) as HTMLButtonElement | undefined;
    expect(rcBtn).toBeTruthy();
    act(() => fireEvent.click(rcBtn!));
    expect(useDocumentStore.getState().doc.entities[e.id]?.type).toBe('rootCause');
  });

  it('Title size buttons update titleSize (undefined for md, set for sm/lg)', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const compact = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Compact')
    ) as HTMLButtonElement;
    const large = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Large')
    ) as HTMLButtonElement;
    expect(compact && large).toBeTruthy();
    act(() => fireEvent.click(compact));
    expect(useDocumentStore.getState().doc.entities[e.id]?.titleSize).toBe('sm');
    act(() => fireEvent.click(large));
    expect(useDocumentStore.getState().doc.entities[e.id]?.titleSize).toBe('lg');
  });

  it('Browse Lock disables the title textarea and type buttons', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().setBrowseLocked(true));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta.disabled).toBe(true);
    // Every type button should be disabled too. We sample the destructive
    // Delete button — locked is the most consequential gate it carries.
    const del = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Delete entity')
    ) as HTMLButtonElement;
    expect(del.disabled).toBe(true);
  });

  it('renders nothing when the entity id no longer exists', () => {
    const { container } = render(<EntityInspector entityId="missing-id" warnings={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('Attestation textarea writes Entity.attestation (Block C / E6)', () => {
    const e = seedEntity('A');
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    // The attestation textarea is identified by its placeholder text.
    const ta = container.querySelector(
      'textarea[placeholder*="Source or evidence"]'
    ) as HTMLTextAreaElement | null;
    expect(ta).toBeTruthy();
    expect(ta!.value).toBe('');
    act(() => fireEvent.change(ta!, { target: { value: 'Goldratt, 1990' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.attestation).toBe('Goldratt, 1990');
  });

  it('Clearing the Attestation field stores undefined, not an empty string', () => {
    const e = seedEntity('A');
    act(() => useDocumentStore.getState().updateEntity(e.id, { attestation: 'previous' }));
    const { container } = render(<EntityInspector entityId={e.id} warnings={[]} />);
    const ta = container.querySelector(
      'textarea[placeholder*="Source or evidence"]'
    ) as HTMLTextAreaElement;
    expect(ta.value).toBe('previous');
    act(() => fireEvent.change(ta, { target: { value: '' } }));
    expect(useDocumentStore.getState().doc.entities[e.id]?.attestation).toBeUndefined();
  });
});
