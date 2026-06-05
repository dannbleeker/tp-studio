import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreationWizardPanel } from '@/components/canvas/wizards/CreationWizardPanel';
import { entitiesOfType } from '@/domain/graph';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 178 — additional CreationWizardPanel coverage for branches not
 * exercised by the existing smoke / EC-order / flow suites:
 *
 *   - CRT wizard "don't show again" sets `showCRTWizard = false`
 *   - EC wizard "don't show again" sets `showECWizard = false`
 *   - Goal Tree step 4 creates a `necessaryCondition` entity wired to the
 *     first CSF with a necessity edge
 *   - Minimise button in the expanded header collapses to the pill
 *   - Close button (X) dismisses the wizard
 *   - Empty commit on step > 0 advances (skip-on-empty)
 *   - Skip-on-final-step closes the wizard
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

describe('CreationWizardPanel — CRT "don\'t show again"', () => {
  it('sets showCRTWizard = false when the checkbox is ticked on a CRT wizard', () => {
    openWizard('crt');
    render(<CreationWizardPanel />);
    expect(s().showCRTWizard).toBe(true);
    act(() => fireEvent.click(screen.getByRole('checkbox')));
    expect(s().showCRTWizard).toBe(false);
  });

  it('sets showCRTWizard = true when the checkbox is unticked again', () => {
    openWizard('crt');
    render(<CreationWizardPanel />);
    // Tick then untick
    act(() => fireEvent.click(screen.getByRole('checkbox')));
    act(() => fireEvent.click(screen.getByRole('checkbox')));
    expect(s().showCRTWizard).toBe(true);
  });
});

describe('CreationWizardPanel — EC "don\'t show again"', () => {
  it('sets showECWizard = false when the checkbox is ticked on an EC wizard', () => {
    openWizard('ec');
    render(<CreationWizardPanel />);
    expect(s().showECWizard).toBe(true);
    act(() => fireEvent.click(screen.getByRole('checkbox')));
    expect(s().showECWizard).toBe(false);
  });
});

describe('CreationWizardPanel — Goal Tree NC creation', () => {
  it('creates a necessaryCondition on step 4 wired to the first CSF', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    // Step 0: Goal
    fillNext('Grow market share');
    // Steps 1–3: CSFs
    fillNext('CSF alpha');
    fillNext('CSF beta');
    fillNext('CSF gamma');
    // Step 4: NC
    fillNext('NC one');
    const ncs = entitiesOfType(doc(), 'necessaryCondition');
    expect(ncs.map((e) => e.title)).toContain('NC one');
    // Verify the NC is wired to the first CSF
    const csf = entitiesOfType(doc(), 'criticalSuccessFactor')[0];
    const hasNecessityEdge = Object.values(doc().edges).some(
      (e) =>
        e.kind === 'necessity' &&
        e.sourceId === ncs.find((n) => n.title === 'NC one')?.id &&
        e.targetId === csf?.id
    );
    expect(hasNecessityEdge).toBe(true);
  });
});

describe('CreationWizardPanel — header controls', () => {
  it('minimise button in the header collapses the panel', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    const minimiseBtn = screen.getByLabelText('Minimise wizard');
    act(() => fireEvent.click(minimiseBtn));
    expect(s().creationWizard?.minimised).toBe(true);
  });

  it('close button (X) in the header dismisses the wizard', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    const closeBtn = screen.getByLabelText('Dismiss wizard');
    act(() => fireEvent.click(closeBtn));
    expect(s().creationWizard).toBeNull();
  });
});

describe('CreationWizardPanel — empty-submit / skip-on-empty behaviour', () => {
  it('advances on empty Enter on step > 0', () => {
    openWizard('goalTree');
    render(<CreationWizardPanel />);
    // Advance to step 1 with a real value
    fillNext('The Goal');
    expect(s().creationWizard?.step).toBe(1);
    // Now submit empty text via Next button — should still advance
    act(() => fireEvent.click(screen.getByText(/Next/).closest('button') as HTMLButtonElement));
    expect(s().creationWizard?.step).toBe(2);
  });

  it('skip on the last CRT step closes the wizard', () => {
    openWizard('crt');
    render(<CreationWizardPanel />);
    // Advance to the last step (step index 2 of 3)
    act(() => {
      for (let i = 0; i < 2; i++) s().advanceCreationWizardStep();
    });
    // CRT has 3 steps (index 0-2). Now click Skip step on the final step.
    act(() =>
      fireEvent.click(screen.getByText('Skip step').closest('button') as HTMLButtonElement)
    );
    expect(s().creationWizard).toBeNull();
  });
});
