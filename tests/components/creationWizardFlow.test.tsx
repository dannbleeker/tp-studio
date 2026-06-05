import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreationWizardPanel } from '@/components/canvas/wizards/CreationWizardPanel';
import { entitiesOfType } from '@/domain/graph';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 177 — interaction tests for CreationWizardPanel. The smoke +
 * EC-order suites cover the render branches; this drives the actual
 * step-advance flow (the `commit()` per-kind entity creation, skip-step,
 * the EC order toggle, the done state, the don't-show-again pref, the
 * minimised pill, and the Esc-armed discard) by acting on the panel and
 * asserting the resulting store state.
 */

beforeEach(resetStoreForTest);
afterEach(cleanup);

const s = () => useDocumentStore.getState();
const doc = () => currentDoc(s());

const openWizard = (kind: 'goalTree' | 'crt' | 'ec') => {
  s().newDocument(kind);
  s().openCreationWizard(kind);
};

const fillNext = (value: string) => {
  act(() => fireEvent.change(screen.getByRole('textbox'), { target: { value } }));
  act(() =>
    fireEvent.click(screen.getByText(/Next|Finish/).closest('button') as HTMLButtonElement)
  );
};

describe('CreationWizardPanel — step flow', () => {
  it('commits the apex goal on step 0 of the Goal Tree wizard', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    fillNext('Maximise throughput');
    expect(entitiesOfType(doc(), 'goal').map((g) => g.title)).toContain('Maximise throughput');
    expect(s().creationWizard?.step).toBe(1);
  });

  it('wires a CSF to the goal with a necessity edge', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    fillNext('Goal');
    fillNext('CSF one');
    expect(entitiesOfType(doc(), 'criticalSuccessFactor')).toHaveLength(1);
    expect(Object.values(doc().edges).some((e) => e.kind === 'necessity')).toBe(true);
  });

  it('mints a UDE on a committed CRT wizard step', () => {
    openWizard('crt');
    render(<CreationWizardPanel />);
    fillNext('Late deliveries');
    expect(entitiesOfType(doc(), 'ude').map((e) => e.title)).toContain('Late deliveries');
  });

  it('fills a pre-seeded EC slot title', () => {
    openWizard('ec');
    render(<CreationWizardPanel />);
    fillNext('Common objective');
    expect(Object.values(doc().entities).some((e) => e.title === 'Common objective')).toBe(true);
  });

  it('flips the EC walk order to D-first', () => {
    openWizard('ec');
    render(<CreationWizardPanel />);
    const dFirst = screen.getByText(/from the conflict/).closest('button') as HTMLButtonElement;
    expect(dFirst.getAttribute('aria-pressed')).toBe('false');
    act(() => fireEvent.click(dFirst));
    expect(dFirst.getAttribute('aria-pressed')).toBe('true');
  });

  it('advances without creating an entity when "Skip step" is clicked', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    act(() =>
      fireEvent.click(screen.getByText('Skip step').closest('button') as HTMLButtonElement)
    );
    expect(s().creationWizard?.step).toBe(1);
    expect(entitiesOfType(doc(), 'goal')).toHaveLength(0);
  });

  it('flips the Goal Tree wizard preference via "don\'t show again"', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    act(() => fireEvent.click(screen.getByRole('checkbox')));
    expect(s().showGoalTreeWizard).toBe(false);
  });

  it('renders the minimised pill and expands it on click', () => {
    openWizard('goalTree');
    act(() => s().toggleCreationWizardMinimised());
    render(<CreationWizardPanel />);
    act(() =>
      fireEvent.click(screen.getByText(/Continue setup/).closest('button') as HTMLButtonElement)
    );
    expect(s().creationWizard?.minimised).toBe(false);
  });

  it('shows the "wizard complete" state once the steps are exhausted', () => {
    openWizard('goalTree');
    act(() => {
      for (let i = 0; i < 6; i++) s().advanceCreationWizardStep();
    });
    render(<CreationWizardPanel />);
    expect(screen.getByText(/Wizard complete/)).toBeTruthy();
    act(() => fireEvent.click(screen.getByText('Done').closest('button') as HTMLButtonElement));
    expect(s().creationWizard).toBeNull();
  });

  it('arms Esc with a non-empty draft, then closes on the second Esc', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    const ta = screen.getByRole('textbox');
    act(() => fireEvent.change(ta, { target: { value: 'half-typed' } }));
    act(() => fireEvent.keyDown(ta, { key: 'Escape' }));
    expect(screen.getByText(/Press Esc again to discard/)).toBeTruthy();
    act(() => fireEvent.keyDown(ta, { key: 'Escape' }));
    expect(s().creationWizard).toBeNull();
  });
});
