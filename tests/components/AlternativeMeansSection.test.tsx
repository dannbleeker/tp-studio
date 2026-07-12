import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlternativeMeansSection } from '@/components/inspector/AlternativeMeansSection';
import { EntityInspector } from '@/components/inspector/EntityInspector';
import type { Entity } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

const makeEnt = (over: Partial<Entity>): Entity =>
  ({
    id: 'e1',
    type: 'want',
    title: 'Stay on the queue',
    annotationNumber: 1,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Entity;

describe('AlternativeMeansSection (backlog D6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('lists existing means and edits one through onChange', () => {
    const onChange = vi.fn();
    render(
      <AlternativeMeansSection
        entity={makeEnt({ alternativeMeans: ['Delegate triage'] })}
        locked={false}
        onChange={onChange}
      />
    );
    const input = screen.getByLabelText('Alternative means 1') as HTMLInputElement;
    expect(input.value).toBe('Delegate triage');
    fireEvent.change(input, { target: { value: 'Delegate triage to a rota' } });
    expect(onChange).toHaveBeenCalledWith(['Delegate triage to a rota']);
  });

  it('appends a blank row on Add', () => {
    const onChange = vi.fn();
    render(
      <AlternativeMeansSection
        entity={makeEnt({ alternativeMeans: ['x'] })}
        locked={false}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add a means' }));
    expect(onChange).toHaveBeenCalledWith(['x', '']);
  });

  it('clears the field (undefined) when the last row is removed', () => {
    const onChange = vi.fn();
    render(
      <AlternativeMeansSection
        entity={makeEnt({ alternativeMeans: ['only one'] })}
        locked={false}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove alternative means 1' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows an injection-specific caption for injections', () => {
    render(
      <AlternativeMeansSection
        entity={makeEnt({ type: 'injection', alternativeMeans: ['a'] })}
        locked={false}
        onChange={() => {}}
      />
    );
    expect(screen.getByText(/one way to break the conflict/i)).toBeTruthy();
  });

  it('disables the row input under Browse Lock', () => {
    render(
      <AlternativeMeansSection
        entity={makeEnt({ alternativeMeans: ['a'] })}
        locked
        onChange={() => {}}
      />
    );
    expect((screen.getByLabelText('Alternative means 1') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('EntityInspector — D6 surfaces', () => {
  beforeEach(() => {
    resetStoreForTest();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('renders the Alternative means section for a Want', () => {
    const s = useDocumentStore.getState();
    s.newDocument('ec');
    const w = s.addEntity({ type: 'want', title: 'Stay on queue' });
    render(<EntityInspector entityId={w.id} warnings={[]} />);
    expect(screen.getByText('Alternative means')).toBeTruthy();
  });

  it('does not render the section for a Need', () => {
    const s = useDocumentStore.getState();
    s.newDocument('ec');
    const n = s.addEntity({ type: 'need', title: 'Keep queue responsive' });
    render(<EntityInspector entityId={n.id} warnings={[]} />);
    expect(screen.queryByText('Alternative means')).toBeNull();
  });

  it('shows the reframe-your-Need hint on a Need box (slot B)', () => {
    const s = useDocumentStore.getState();
    s.newDocument('ec');
    const n = s.addEntity({ type: 'need', title: 'Keep queue responsive' });
    s.updateEntity(n.id, { ecSlot: 'b' });
    const { container } = render(<EntityInspector entityId={n.id} warnings={[]} />);
    expect(container.querySelector('[data-component="ec-reframe-need"]')).toBeTruthy();
  });

  it('does not show the reframe hint on the Objective (slot A)', () => {
    const s = useDocumentStore.getState();
    s.newDocument('ec');
    const a = s.addEntity({ type: 'goal', title: 'Sustainable support' });
    s.updateEntity(a.id, { ecSlot: 'a' });
    const { container } = render(<EntityInspector entityId={a.id} warnings={[]} />);
    expect(container.querySelector('[data-component="ec-reframe-need"]')).toBeNull();
  });
});
