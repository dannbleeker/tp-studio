import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MethodStepper } from '@/components/toolbar/MethodStepper';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * MethodStepper situates the active doc in the TP sequence (CRT → EC → FRT →
 * PRT → TT, + Goal / S&T branch) and surfaces a contextual next step once the
 * current tree hits a milestone.
 *
 * These tests also stand as the permanent guard for the Session-182 render-loop
 * regression: the stepper's `openByType` map must be derived in a memo, NOT
 * built inside the `useShallow` selector (a fresh object there defeats the
 * shallow compare and spins "Maximum update depth exceeded"). If that ever
 * regresses, `render(<MethodStepper />)` throws and every test here fails.
 */

describe('MethodStepper', () => {
  it('renders the TP sequence with the current diagram marked', () => {
    // resetStoreForTest leaves a default CRT doc active.
    const { container } = render(<MethodStepper />);
    const nav = container.querySelector('nav[aria-label="TP method path"]');
    expect(nav).toBeTruthy();
    const labels = Array.from(nav?.querySelectorAll('button') ?? []).map((b) =>
      b.textContent?.trim()
    );
    expect(labels).toEqual(
      expect.arrayContaining(['CRT', 'EC', 'FRT', 'PRT', 'TT', 'Goal Tree', 'S&T'])
    );
    const current = nav?.querySelector('button[aria-current="step"]');
    expect(current?.textContent).toContain('CRT');
  });

  it('shows no next-step suggestion until a milestone is reached', () => {
    const { container } = render(<MethodStepper />);
    expect(container.textContent).not.toContain('Evaporating Cloud');
  });

  it('suggests the Evaporating Cloud once the CRT has a root cause', () => {
    act(() => {
      useDocumentStore.getState().addEntity({ type: 'rootCause' });
    });
    const { container } = render(<MethodStepper />);
    expect(container.textContent).toContain('break it with an Evaporating Cloud');
  });

  it('the collapse control hides the strip via the persisted pref (Session 188)', () => {
    render(<MethodStepper />);
    expect(useDocumentStore.getState().methodPathCollapsed).toBe(false);
    act(() => fireEvent.click(screen.getByLabelText('Hide method path')));
    expect(useDocumentStore.getState().methodPathCollapsed).toBe(true);
  });
});
