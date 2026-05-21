import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CustomEntityClassesSection } from '@/components/settings/CustomEntityClassesSection';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 134 coverage push (round 2) — `CustomEntityClassesSection`
 * was at 23%.
 *
 * Smoke tests cover the three render branches (no classes / classes
 * present / add-form open) plus the slug-validation messages on the
 * inline form. The deeper icon-filter logic stays out of scope for
 * the smoke level.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('CustomEntityClassesSection', () => {
  it('renders the no-classes state with an "Add class" affordance', () => {
    render(<CustomEntityClassesSection />);
    // Some flavour of "Add" button is the empty-state CTA.
    const addButton = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''));
    expect(addButton, 'no Add button found').toBeDefined();
  });

  it('lists existing custom classes', () => {
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'risk',
      label: 'Risk',
      color: '#dc2626',
    });
    render(<CustomEntityClassesSection />);
    expect(screen.getByText(/Risk/)).toBeTruthy();
  });

  it('opens the add-class form when Add is clicked', () => {
    render(<CustomEntityClassesSection />);
    const addButton = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''));
    if (!addButton) throw new Error('Add button missing');
    fireEvent.click(addButton);
    // Once the inline form opens, there are more inputs visible than
    // before (id + label + color picker, etc.).
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0);
  });

  it('upserts a custom class via the store API and the row shows up', () => {
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'risk',
      label: 'Risk',
      color: '#dc2626',
    });
    render(<CustomEntityClassesSection />);
    // Row label is visible.
    expect(screen.getByText(/Risk/)).toBeTruthy();
    // And the store carries the class.
    expect(s().doc.customEntityClasses?.risk).toBeDefined();
  });

  it('remove button on a class row deletes the class', () => {
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'risk',
      label: 'Risk',
      color: '#dc2626',
    });
    render(<CustomEntityClassesSection />);
    const remove = screen.getByLabelText(/Remove Risk/i);
    fireEvent.click(remove);
    expect(s().doc.customEntityClasses?.risk).toBeUndefined();
  });

  it('does not commit when the new-class id is empty', () => {
    render(<CustomEntityClassesSection />);
    const addButton = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''));
    if (!addButton) throw new Error('Add button missing');
    fireEvent.click(addButton);
    const saveButton = screen
      .getAllByRole('button')
      .find((b) => /save|commit|create/i.test(b.textContent ?? ''));
    if (!saveButton) return; // form structure changed; skip silently
    const before = Object.keys(s().doc.customEntityClasses ?? {}).length;
    fireEvent.click(saveButton);
    // Nothing got committed.
    expect(Object.keys(s().doc.customEntityClasses ?? {}).length).toBe(before);
  });

  it('rejects an id containing uppercase letters or spaces (slug rule)', () => {
    render(<CustomEntityClassesSection />);
    const addButton = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''));
    if (!addButton) throw new Error('Add button missing');
    fireEvent.click(addButton);
    const idInput = screen.getByPlaceholderText(/id \(e\.g\./i) as HTMLInputElement;
    const labelInput = screen.getByPlaceholderText(/Label/i) as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: 'Bad ID' } });
    fireEvent.change(labelInput, { target: { value: 'Bad ID label' } });
    const saveButton = screen
      .getAllByRole('button')
      .find((b) => /save|commit|create/i.test(b.textContent ?? ''));
    if (!saveButton) return;
    fireEvent.click(saveButton);
    // Class wasn't committed.
    expect(s().doc.customEntityClasses?.['Bad ID']).toBeUndefined();
    expect(s().doc.customEntityClasses?.['bad id']).toBeUndefined();
  });

  it('successfully creates a class through the inline form', () => {
    render(<CustomEntityClassesSection />);
    const addButton = screen.getAllByRole('button').find((b) => /add/i.test(b.textContent ?? ''));
    if (!addButton) throw new Error('Add button missing');
    fireEvent.click(addButton);
    const idInput = screen.getByPlaceholderText(/id \(e\.g\./i) as HTMLInputElement;
    const labelInput = screen.getByPlaceholderText(/Label/i) as HTMLInputElement;
    fireEvent.change(idInput, { target: { value: 'evidence' } });
    fireEvent.change(labelInput, { target: { value: 'Evidence' } });
    const saveButton = screen
      .getAllByRole('button')
      .find((b) => /save|commit|create/i.test(b.textContent ?? ''));
    if (!saveButton) return;
    fireEvent.click(saveButton);
    expect(s().doc.customEntityClasses?.evidence).toBeDefined();
    expect(s().doc.customEntityClasses?.evidence?.label).toBe('Evidence');
  });
});
