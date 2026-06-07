import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ExportPickerDialog } from '@/components/export/ExportPickerDialog';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../../helpers/seedDoc';

/**
 * Entity-gated options in the Export picker.
 *
 * Three exports declare `requiresEntityType` so they don't surface an
 * empty-CSV trap on documents that lack the relevant entity:
 *   - "Risk register (CSV)"     → `ude`
 *   - "Task tracker CSV"        → `action`
 *   - "Prerequisite plan (CSV)" → `intermediateObjective`
 *
 * The `intermediateObjective` guard was declared when the PRT-plan export
 * shipped (Session 162) but never wired into the picker's filter, so the
 * option leaked onto every document. Each test below pins one guard by
 * asserting the option is hidden until its entity type is present.
 */

const openPicker = (): void => {
  act(() => useDocumentStore.getState().openExportPicker());
};

beforeEach(resetStoreForTest);
afterEach(cleanup);

describe('ExportPickerDialog — entity-gated options', () => {
  it('gates "Prerequisite plan (CSV)" on Intermediate Objectives', () => {
    // The doc has no Intermediate Objectives — the option must stay hidden.
    // (Pre-fix it leaked onto every doc, the regression this guards.)
    seedEntity('A plain effect', 'effect');
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('Prerequisite plan (CSV)')).toBeNull();

    // Add one Intermediate Objective and the option appears.
    act(() => {
      seedEntity('Defeat the obstacle', 'intermediateObjective');
    });
    expect(queryByText('Prerequisite plan (CSV)')).not.toBeNull();
  });

  it('gates "Risk register (CSV)" on UDEs', () => {
    seedEntity('A plain effect', 'effect');
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('Risk register (CSV)')).toBeNull();

    act(() => {
      seedEntity('Customers churn', 'ude');
    });
    expect(queryByText('Risk register (CSV)')).not.toBeNull();
  });

  it('gates "Task tracker CSV" on Actions', () => {
    seedEntity('A plain effect', 'effect');
    openPicker();
    const { queryByText } = render(<ExportPickerDialog />);
    expect(queryByText('Task tracker CSV')).toBeNull();

    act(() => {
      seedEntity('Ship the change', 'action');
    });
    expect(queryByText('Task tracker CSV')).not.toBeNull();
  });
});
