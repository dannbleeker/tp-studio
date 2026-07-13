import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnalysisJourneyDialog } from '@/components/journey/AnalysisJourneyDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});
afterEach(cleanup);

const s = () => useDocumentStore.getState();

describe('AnalysisJourneyDialog (§C)', () => {
  it('renders nothing until the dialog flag is set', () => {
    const { container } = render(<AnalysisJourneyDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the start state and begins a journey enrolling the active tree', () => {
    s().newDocument('crt');
    s().openAnalysisJourney();
    render(<AnalysisJourneyDialog />);

    expect(screen.getByText('Start a guided journey')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Start journey/ }));

    expect(s().journey).not.toBeNull();
    // The five questions now render, and the CRT is enrolled under "What to change?".
    expect(screen.getByText('Why change?')).toBeTruthy();
    expect(screen.getByText('What to change?')).toBeTruthy();
    expect(s().journey?.members).toEqual([
      { docId: s().activeDocId, stageId: 'what', diagramType: 'crt' },
    ]);
  });

  it('offers the right per-stage action given a CRT-seeded journey', () => {
    s().newDocument('crt');
    s().startJourney();
    s().openAnalysisJourney();
    render(<AnalysisJourneyDialog />);

    // 'what' has the CRT member → Open; 'to-what' can spawn an FRT from it;
    // the empty stages offer Create of their primary type.
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Spawn FRT' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create Goal Tree' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create PRT' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create S&T' })).toBeTruthy();
  });

  it('Create mints a tree for the stage and enrols it', () => {
    s().newDocument('crt');
    s().startJourney();
    s().openAnalysisJourney();
    render(<AnalysisJourneyDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Create PRT' }));

    expect(s().doc.diagramType).toBe('prt');
    expect(s().journey?.members.some((m) => m.stageId === 'how' && m.diagramType === 'prt')).toBe(
      true
    );
  });

  it('Spawn FRT seeds a Future Reality Tree from the enrolled CRT', () => {
    s().newDocument('crt');
    s().startJourney();
    s().openAnalysisJourney();
    render(<AnalysisJourneyDialog />);

    fireEvent.click(screen.getByRole('button', { name: 'Spawn FRT' }));

    expect(s().doc.diagramType).toBe('frt');
    expect(
      s().journey?.members.some((m) => m.stageId === 'to-what' && m.diagramType === 'frt')
    ).toBe(true);
  });

  it('Mark done hand-completes a stage that has no tree', () => {
    s().newDocument('crt');
    s().startJourney();
    s().openAnalysisJourney();
    render(<AnalysisJourneyDialog />);

    const sustainRow = screen.getByText('How to sustain it?').closest('.gap-3') as HTMLElement;
    fireEvent.click(within(sustainRow).getByRole('button', { name: 'Mark done' }));

    expect(s().journey?.manualDone).toContain('sustain');
  });
});
