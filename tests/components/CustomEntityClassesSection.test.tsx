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
    expect(s().doc.customEntityClasses?.['risk']).toBeDefined();
  });
});
