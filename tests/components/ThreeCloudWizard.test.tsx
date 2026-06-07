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
