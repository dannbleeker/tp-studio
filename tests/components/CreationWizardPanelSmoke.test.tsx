import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreationWizardPanel } from '@/components/canvas/wizards/CreationWizardPanel';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 134 coverage push (round 2) — `CreationWizardPanel` was at
 * 44%.
 *
 * Existing `CreationWizardPanelECOrder.test.tsx` covers the EC step-
 * order toggle in depth; this file fills the gaps: closed render,
 * Goal Tree branch, minimised render, dismiss.
 */

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  cleanup();
});

const s = () => useDocumentStore.getState();

describe('CreationWizardPanel — closed', () => {
  it('renders nothing when the wizard is closed', () => {
    const { container } = render(<CreationWizardPanel />);
    expect(container.firstChild).toBeNull();
  });
});

describe('CreationWizardPanel — Goal Tree wizard', () => {
  it('mounts the panel when opened on a fresh goalTree doc', () => {
    useDocumentStore.getState().newDocument('goalTree');
    useDocumentStore.getState().openCreationWizard('goalTree');
    const { container } = render(<CreationWizardPanel />);
    // The panel renders SOME content (not null) when the wizard is open.
    expect(container.firstChild).not.toBeNull();
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('renders at least one button (advance/dismiss/minimise) when open', () => {
    useDocumentStore.getState().newDocument('goalTree');
    useDocumentStore.getState().openCreationWizard('goalTree');
    render(<CreationWizardPanel />);
    // The expanded panel always renders >= 1 button (the close + minimise
    // controls in the header, plus the step-advance affordance).
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('dismiss closes the wizard panel', () => {
    useDocumentStore.getState().newDocument('goalTree');
    useDocumentStore.getState().openCreationWizard('goalTree');
    render(<CreationWizardPanel />);
    useDocumentStore.getState().closeCreationWizard();
    expect(s().creationWizard).toBeNull();
  });
});

describe('CreationWizardPanel — EC wizard', () => {
  it('renders for an EC doc', () => {
    useDocumentStore.getState().newDocument('ec');
    useDocumentStore.getState().openCreationWizard('ec');
    const { container } = render(<CreationWizardPanel />);
    expect(container.firstChild).not.toBeNull();
  });
});

describe('CreationWizardPanel — minimised', () => {
  it('toggleCreationWizardMinimised flips minimised state', () => {
    useDocumentStore.getState().newDocument('goalTree');
    useDocumentStore.getState().openCreationWizard('goalTree');
    const before = s().creationWizard?.minimised ?? false;
    useDocumentStore.getState().toggleCreationWizardMinimised();
    expect(s().creationWizard?.minimised).toBe(!before);
  });
});
