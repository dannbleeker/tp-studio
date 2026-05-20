import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InjectionWorkbench } from '@/components/inspector/InjectionWorkbench';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push — `InjectionWorkbench` was at 0%.
 *
 * Smoke tests cover the three main states (no injections / one
 * injection / "New injection" button) so a future regression in the
 * EC inspector's Injections tab fails loudly. Deep editing flows are
 * covered indirectly via the store-level injection / assumption tests.
 */

beforeEach(() => {
  resetStoreForTest();
  useDocumentStore.getState().newDocument('ec');
});
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('InjectionWorkbench', () => {
  it('renders the empty state when no injections exist', () => {
    render(<InjectionWorkbench />);
    expect(screen.getByText(/No injections yet/i)).toBeTruthy();
  });

  it('renders existing injections', () => {
    seedEntity('Auto-publish the report', 'injection');
    render(<InjectionWorkbench />);
    // The injection title is editable — rendered as the value of an
    // <input>, not as text content. Use getByDisplayValue accordingly.
    expect(screen.getByDisplayValue(/Auto-publish the report/i)).toBeTruthy();
  });

  it('"New injection" button mints an injection entity', () => {
    render(<InjectionWorkbench />);
    const button = screen.getByRole('button', { name: /new injection/i });
    fireEvent.click(button);
    const injections = Object.values(s().doc.entities).filter((e) => e.type === 'injection');
    expect(injections.length).toBe(1);
  });

  it('"New injection" button is disabled when browse-locked', () => {
    useDocumentStore.setState({ browseLocked: true });
    render(<InjectionWorkbench />);
    const button = screen.getByRole('button', { name: /new injection/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
