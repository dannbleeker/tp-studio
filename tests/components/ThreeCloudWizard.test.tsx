import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThreeCloudWizard } from '@/components/three-cloud/ThreeCloudWizard';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();

/** Read a button's native `disabled` (no jest-dom dependency in this repo). */
const isDisabled = (el: HTMLElement): boolean => (el as HTMLButtonElement).disabled;

describe('ThreeCloudWizard', () => {
  it('renders nothing while the overlay flag is off', () => {
    const { queryByRole } = render(<ThreeCloudWizard />);
    expect(queryByRole('dialog')).toBeNull();
  });

  it('walks symptoms → consolidate → create and mints a core cloud', () => {
    act(() => {
      s().openThreeCloud();
    });
    const view = render(<ThreeCloudWizard />);
    const set = (label: string, value: string): void => {
      act(() => {
        fireEvent.change(view.getByLabelText(label), { target: { value } });
      });
    };

    // Step 1 — naming the three UDEs is the gate to advance.
    set('Undesirable effect 1', 'Releases slip');
    set('Undesirable effect 2', 'Bugs recur');
    set('Undesirable effect 3', 'Burnout');

    const next = view.getByRole('button', { name: /Next: consolidate/i });
    expect(isDisabled(next)).toBe(false);
    act(() => {
      fireEvent.click(next);
    });

    // Step 2 — the five core slots (visible EC slot labels).
    set('A · Common objective', 'Deliver sustainably');
    set('B · First need', 'Hit commitments');
    set('C · Second need', 'Stay healthy');
    set('D · First want', 'Push hard');
    set('D′ · Conflicting want', 'Hold capacity back');

    const create = view.getByRole('button', { name: /Create core cloud/i });
    expect(isDisabled(create)).toBe(false);
    act(() => {
      fireEvent.click(create);
    });

    expect(s().doc.cloudType).toBe('core');
    expect(s().doc.title).toBe('Core cloud — 3-cloud diagnosis');
    expect(s().threeCloudOpen).toBe(false);
  });

  it('flips D/D′ on a single cloud in the consolidation grid (backlog D4)', () => {
    act(() => {
      s().openThreeCloud();
    });
    const view = render(<ThreeCloudWizard />);
    const set = (label: string, value: string): void => {
      act(() => {
        fireEvent.change(view.getByLabelText(label), { target: { value } });
      });
    };

    set('Undesirable effect 1', 'Releases slip');
    set('Action you take 1', 'Firefight');
    set('Action you feel you should take instead 1', 'Hold the plan');
    set('Undesirable effect 2', 'Bugs recur');
    set('Undesirable effect 3', 'Burnout');

    act(() => {
      fireEvent.click(view.getByRole('button', { name: /Next: consolidate/i }));
    });

    const flip = view.getByRole('button', { name: /Flip cloud 1/i });
    const card = flip.closest('div.rounded-md') as HTMLElement;
    const order = (): { fire: number; hold: number } => {
      const t = card.textContent ?? '';
      return { fire: t.indexOf('Firefight'), hold: t.indexOf('Hold the plan') };
    };

    // Before flip: D = "Firefight" precedes D′ = "Hold the plan".
    const before = order();
    expect(before.fire).toBeGreaterThanOrEqual(0);
    expect(before.fire).toBeLessThan(before.hold);

    act(() => {
      fireEvent.click(flip);
    });

    // After flip: "Hold the plan" now occupies the D slot, ahead of "Firefight".
    const after = order();
    expect(after.hold).toBeLessThan(after.fire);
  });

  it('propagates a flip into the committed core-cloud provenance (backlog D4)', () => {
    act(() => {
      s().openThreeCloud();
    });
    const view = render(<ThreeCloudWizard />);
    const set = (label: string, value: string): void => {
      act(() => {
        fireEvent.change(view.getByLabelText(label), { target: { value } });
      });
    };

    set('Undesirable effect 1', 'Releases slip');
    set('Action you take 1', 'Firefight');
    set('Action you feel you should take instead 1', 'Hold the plan');
    set('Undesirable effect 2', 'Bugs recur');
    set('Undesirable effect 3', 'Burnout');

    act(() => {
      fireEvent.click(view.getByRole('button', { name: /Next: consolidate/i }));
    });
    // Flip cloud 1, then fill the core and create.
    act(() => {
      fireEvent.click(view.getByRole('button', { name: /Flip cloud 1/i }));
    });
    set('A · Common objective', 'Deliver sustainably');
    set('B · First need', 'Hit commitments');
    set('C · Second need', 'Stay healthy');
    set('D · First want', 'Push hard');
    set('D′ · Conflicting want', 'Hold capacity back');
    act(() => {
      fireEvent.click(view.getByRole('button', { name: /Create core cloud/i }));
    });

    // The provenance block must reflect the FLIPPED order (D and D′ swapped).
    expect(s().doc.description).toContain('pulled between "Hold the plan" and "Firefight"');
  });

  it('keeps "Next" disabled until all three UDEs are named', () => {
    act(() => {
      s().openThreeCloud();
    });
    const view = render(<ThreeCloudWizard />);
    act(() => {
      fireEvent.change(view.getByLabelText('Undesirable effect 1'), {
        target: { value: 'Only one' },
      });
    });
    expect(isDisabled(view.getByRole('button', { name: /Next: consolidate/i }))).toBe(true);
  });
});
