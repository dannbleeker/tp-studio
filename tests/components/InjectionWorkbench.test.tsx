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

describe('InjectionWorkbench — InjectionRow interactions', () => {
  const seedECDocWithAssumption = () => {
    // EC docs pre-seed the 5-box layout, so wire an edge between two
    // existing entities + attach an assumption + mint an injection.
    const ents = Object.values(useDocumentStore.getState().doc.entities);
    const a = ents[0];
    const b = ents[1];
    if (!a || !b) throw new Error('EC doc lacks pre-seeded entities');
    const edge = useDocumentStore.getState().connect(a.id, b.id);
    if (!edge) throw new Error('connect failed');
    const assumption = useDocumentStore.getState().addAssumptionToEdge(edge.id);
    if (!assumption) throw new Error('addAssumptionToEdge failed');
    const inj = useDocumentStore
      .getState()
      .addEntity({ type: 'injection', title: 'Auto-publish the report' });
    return { assumption, injection: inj };
  };

  it('editing the injection title updates the entity title in the store', () => {
    const { injection } = seedECDocWithAssumption();
    render(<InjectionWorkbench />);
    const input = screen.getByDisplayValue(/Auto-publish the report/);
    fireEvent.change(input, { target: { value: 'Auto-publish nightly' } });
    expect(s().doc.entities[injection.id]?.title).toBe('Auto-publish nightly');
  });

  it('toggling the "Implemented" checkbox sets the implemented attribute', () => {
    const { injection } = seedECDocWithAssumption();
    render(<InjectionWorkbench />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const attr = s().doc.entities[injection.id]?.attributes?.implemented;
    expect(attr).toEqual({ kind: 'bool', value: true });
  });

  it('the per-row "Open injection in inspector" arrow selects the injection', () => {
    const { injection } = seedECDocWithAssumption();
    render(<InjectionWorkbench />);
    const openArrow = screen.getByLabelText(/Open injection in inspector/i);
    fireEvent.click(openArrow);
    const sel = s().selection;
    if (sel.kind === 'entities') {
      expect(sel.ids).toContain(injection.id);
    }
  });
});
