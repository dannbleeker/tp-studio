import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);

/**
 * Session 78 / brief §5 + §6 — Creation wizard flow tests.
 *
 * These tests verify:
 *   1. `newDocument('goalTree' | 'ec')` opens the wizard when the
 *      corresponding preference is on.
 *   2. The wizard does NOT open when the preference is off.
 *   3. The wizard advances + closes via the slice actions.
 *   4. `setShowGoalTreeWizard(false)` flips the persisted preference
 *      so subsequent new docs skip the wizard.
 *   5. The minimise toggle preserves state.
 *
 * The actual entity-creation effects (slot fills for EC, entity
 * creation for Goal Tree) are tested via the component's commit
 * function path, which the slice tests can simulate by calling the
 * underlying store actions directly.
 */

describe('Creation wizard — preference-driven open', () => {
  it('opens the wizard on newDocument(goalTree) when showGoalTreeWizard is true', () => {
    const s = useDocumentStore.getState();
    expect(s.showGoalTreeWizard).toBe(true);
    s.newDocument('goalTree');
    const after = useDocumentStore.getState();
    expect(after.creationWizard).toEqual({ kind: 'goalTree', step: 0, minimised: false });
  });

  it('opens the wizard on newDocument(ec) when showECWizard is true', () => {
    const s = useDocumentStore.getState();
    expect(s.showECWizard).toBe(true);
    s.newDocument('ec');
    const after = useDocumentStore.getState();
    expect(after.creationWizard).toEqual({ kind: 'ec', step: 0, minimised: false });
  });

  it('does NOT open the wizard when the preference is off', () => {
    useDocumentStore.getState().setShowGoalTreeWizard(false);
    useDocumentStore.getState().newDocument('goalTree');
    expect(useDocumentStore.getState().creationWizard).toBeNull();
  });

  it('does NOT open the wizard for non-wizardable diagram types (CRT)', () => {
    useDocumentStore.getState().newDocument('crt');
    expect(useDocumentStore.getState().creationWizard).toBeNull();
  });

  it('closes a previous wizard when switching to a non-wizardable diagram', () => {
    useDocumentStore.getState().newDocument('goalTree');
    expect(useDocumentStore.getState().creationWizard).not.toBeNull();
    useDocumentStore.getState().newDocument('crt');
    expect(useDocumentStore.getState().creationWizard).toBeNull();
  });
});

describe('Creation wizard — slice actions', () => {
  it('advanceCreationWizardStep increments the step', () => {
    useDocumentStore.getState().openCreationWizard('goalTree');
    expect(useDocumentStore.getState().creationWizard?.step).toBe(0);
    useDocumentStore.getState().advanceCreationWizardStep();
    expect(useDocumentStore.getState().creationWizard?.step).toBe(1);
    useDocumentStore.getState().advanceCreationWizardStep();
    expect(useDocumentStore.getState().creationWizard?.step).toBe(2);
  });

  it('advanceCreationWizardStep is a no-op when no wizard is open', () => {
    expect(useDocumentStore.getState().creationWizard).toBeNull();
    useDocumentStore.getState().advanceCreationWizardStep();
    expect(useDocumentStore.getState().creationWizard).toBeNull();
  });

  it('toggleCreationWizardMinimised flips the flag', () => {
    useDocumentStore.getState().openCreationWizard('ec');
    expect(useDocumentStore.getState().creationWizard?.minimised).toBe(false);
    useDocumentStore.getState().toggleCreationWizardMinimised();
    expect(useDocumentStore.getState().creationWizard?.minimised).toBe(true);
    useDocumentStore.getState().toggleCreationWizardMinimised();
    expect(useDocumentStore.getState().creationWizard?.minimised).toBe(false);
  });

  it('preserves step + kind across the minimise toggle', () => {
    useDocumentStore.getState().openCreationWizard('goalTree');
    useDocumentStore.getState().advanceCreationWizardStep();
    useDocumentStore.getState().advanceCreationWizardStep();
    useDocumentStore.getState().toggleCreationWizardMinimised();
    const w = useDocumentStore.getState().creationWizard;
    expect(w?.kind).toBe('goalTree');
    expect(w?.step).toBe(2);
    expect(w?.minimised).toBe(true);
  });

  it('closeCreationWizard sets state to null', () => {
    useDocumentStore.getState().openCreationWizard('ec');
    useDocumentStore.getState().advanceCreationWizardStep();
    useDocumentStore.getState().closeCreationWizard();
    expect(useDocumentStore.getState().creationWizard).toBeNull();
  });

  it('openCreationWizard resets state when called on an already-open wizard', () => {
    useDocumentStore.getState().openCreationWizard('goalTree');
    useDocumentStore.getState().advanceCreationWizardStep();
    useDocumentStore.getState().advanceCreationWizardStep();
    useDocumentStore.getState().openCreationWizard('ec');
    expect(useDocumentStore.getState().creationWizard).toEqual({
      kind: 'ec',
      step: 0,
      minimised: false,
    });
  });
});

describe('Creation wizard — preference toggles', () => {
  it('setShowGoalTreeWizard(false) prevents future Goal Tree creations from opening the wizard', () => {
    useDocumentStore.getState().setShowGoalTreeWizard(false);
    useDocumentStore.getState().newDocument('goalTree');
    expect(useDocumentStore.getState().creationWizard).toBeNull();
  });

  it('setShowECWizard(false) prevents future EC creations from opening the wizard, but Goal Tree still opens', () => {
    useDocumentStore.getState().setShowECWizard(false);
    useDocumentStore.getState().newDocument('ec');
    expect(useDocumentStore.getState().creationWizard).toBeNull();
    useDocumentStore.getState().newDocument('goalTree');
    expect(useDocumentStore.getState().creationWizard?.kind).toBe('goalTree');
  });

  it('flipping the preference back on re-enables the wizard on the next newDocument', () => {
    useDocumentStore.getState().setShowGoalTreeWizard(false);
    useDocumentStore.getState().newDocument('goalTree');
    expect(useDocumentStore.getState().creationWizard).toBeNull();
    useDocumentStore.getState().setShowGoalTreeWizard(true);
    useDocumentStore.getState().newDocument('goalTree');
    expect(useDocumentStore.getState().creationWizard).not.toBeNull();
  });
});
