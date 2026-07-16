import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntityInspector } from '@/components/inspector/EntityInspector';
import { InterferenceMetricSection } from '@/components/inspector/InterferenceMetricSection';
import { INTERFERENCE_IMPACT_KEY } from '@/domain/interference';
import type { Entity } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

const makeInterference = (over: Partial<Entity> = {}): Entity =>
  ({
    id: 'i1',
    type: 'obstacle',
    title: 'Parts are not available',
    annotationNumber: 1,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  }) as Entity;

// The "Time lost" control is a number input → implicit ARIA role "spinbutton".
const input = () => screen.getByRole('spinbutton') as HTMLInputElement;

describe('InterferenceMetricSection', () => {
  afterEach(cleanup);

  // Session 206 regression: the control passed a JSX `aria-label`, which
  // `TextInput` drops (it forwards the camelCase `ariaLabel` prop). The Field's
  // visible label is not wired to the input via htmlFor/id, so the spinbutton
  // was left with NO accessible name — invisible to a screen reader.
  it('gives the input an accessible name', () => {
    render(
      <InterferenceMetricSection
        entity={makeInterference()}
        locked={false}
        onSet={() => {}}
        onClear={() => {}}
      />
    );
    expect(input().getAttribute('aria-label')).toBe('Time this interference steals');
    // The accessible name must be queryable the way assistive tech resolves it.
    expect(screen.getByLabelText('Time this interference steals')).toBe(input());
  });

  it('reflects the stored impact value', () => {
    render(
      <InterferenceMetricSection
        entity={makeInterference({
          attributes: { [INTERFERENCE_IMPACT_KEY]: { kind: 'int', value: 90 } },
        })}
        locked={false}
        onSet={() => {}}
        onClear={() => {}}
      />
    );
    expect(input().value).toBe('90');
  });

  it('shows an empty field when no impact is set', () => {
    render(
      <InterferenceMetricSection
        entity={makeInterference()}
        locked={false}
        onSet={() => {}}
        onClear={() => {}}
      />
    );
    expect(input().value).toBe('');
  });

  it('calls onSet with the parsed integer when a number is typed', () => {
    const onSet = vi.fn();
    render(
      <InterferenceMetricSection
        entity={makeInterference()}
        locked={false}
        onSet={onSet}
        onClear={() => {}}
      />
    );
    fireEvent.change(input(), { target: { value: '75' } });
    expect(onSet).toHaveBeenCalledWith(75);
  });

  it('calls onClear when the field is emptied', () => {
    const onClear = vi.fn();
    render(
      <InterferenceMetricSection
        entity={makeInterference({
          attributes: { [INTERFERENCE_IMPACT_KEY]: { kind: 'int', value: 30 } },
        })}
        locked={false}
        onSet={() => {}}
        onClear={onClear}
      />
    );
    fireEvent.change(input(), { target: { value: '' } });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('ignores non-negative-integer garbage (e.g. a lone minus)', () => {
    const onSet = vi.fn();
    render(
      <InterferenceMetricSection
        entity={makeInterference()}
        locked={false}
        onSet={onSet}
        onClear={() => {}}
      />
    );
    fireEvent.change(input(), { target: { value: '-' } });
    expect(onSet).not.toHaveBeenCalled();
  });

  it('rejects a negative magnitude (time stolen is never below zero)', () => {
    const onSet = vi.fn();
    render(
      <InterferenceMetricSection
        entity={makeInterference()}
        locked={false}
        onSet={onSet}
        onClear={() => {}}
      />
    );
    fireEvent.change(input(), { target: { value: '-5' } });
    expect(onSet).not.toHaveBeenCalled();
  });

  it('disables the input under Browse Lock', () => {
    render(
      <InterferenceMetricSection
        entity={makeInterference()}
        locked
        onSet={() => {}}
        onClear={() => {}}
      />
    );
    expect(input().disabled).toBe(true);
  });
});

describe('EntityInspector — interference impact surface', () => {
  beforeEach(() => {
    resetStoreForTest();
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it('renders the Time-lost control for an interference on an ID', () => {
    const s = useDocumentStore.getState();
    s.newDocument('id');
    const o = s.addEntity({ type: 'obstacle', title: 'Parts unavailable' });
    render(<EntityInspector entityId={o.id} warnings={[]} />);
    expect(screen.getByText(/time it steals/i)).toBeTruthy();
  });

  it('does not render it for the central objective (goal) on an ID', () => {
    const s = useDocumentStore.getState();
    s.newDocument('id');
    const g = s.addEntity({ type: 'goal', title: 'More throughput' });
    render(<EntityInspector entityId={g.id} warnings={[]} />);
    expect(screen.queryByText(/time it steals/i)).toBeNull();
  });

  it('does not render it for an obstacle on a PRT (ID-only)', () => {
    const s = useDocumentStore.getState();
    s.newDocument('prt');
    const o = s.addEntity({ type: 'obstacle', title: 'No budget' });
    render(<EntityInspector entityId={o.id} warnings={[]} />);
    expect(screen.queryByText(/time it steals/i)).toBeNull();
  });
});
