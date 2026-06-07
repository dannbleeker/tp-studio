import { beforeEach, describe, expect, it } from 'vitest';
import type { ThreeCloudInput } from '@/domain/threeCloud';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

/**
 * E3 — the store seam between the wizard panel and the document model.
 * `commitThreeCloudDiagnosis` turns captured input into a Core Cloud document,
 * opens it, and dismisses the overlay; `openThreeCloud` / `closeThreeCloud`
 * toggle the overlay flag.
 */
const input: ThreeCloudInput = {
  conflicts: [
    { ude: 'Releases slip', doNow: 'Firefight', doInstead: 'Protect the plan' },
    { ude: 'Bugs recur', doNow: 'Ship fast', doInstead: 'Test more' },
    { ude: 'Burnout', doNow: 'Pile on work', doInstead: 'Cut scope' },
  ],
  core: {
    objective: 'Deliver sustainably',
    need1: 'Hit commitments',
    need2: 'Stay healthy',
    want1: 'Push hard',
    want2: 'Hold capacity back',
  },
  title: 'My core cloud',
};

const s = () => useDocumentStore.getState();
const titleOfSlot = (slot: string): string | undefined =>
  Object.values(s().doc.entities).find((e) => e.ecSlot === slot)?.title;

describe('three-cloud wizard store', () => {
  it('toggles the overlay flag', () => {
    expect(s().threeCloudOpen).toBe(false);
    s().openThreeCloud();
    expect(s().threeCloudOpen).toBe(true);
    s().closeThreeCloud();
    expect(s().threeCloudOpen).toBe(false);
  });

  it('mints a core-cloud EC document and dismisses the overlay on commit', () => {
    s().openThreeCloud();
    s().commitThreeCloudDiagnosis(input);
    expect(s().doc.diagramType).toBe('ec');
    expect(s().doc.cloudType).toBe('core');
    expect(s().doc.title).toBe('My core cloud');
    expect(s().threeCloudOpen).toBe(false);
  });

  it('fills the five EC slots from the consolidated core', () => {
    s().commitThreeCloudDiagnosis(input);
    expect(titleOfSlot('a')).toBe('Deliver sustainably');
    expect(titleOfSlot('b')).toBe('Hit commitments');
    expect(titleOfSlot('dPrime')).toBe('Hold capacity back');
  });

  it('preserves the three source conflicts in the document description', () => {
    s().commitThreeCloudDiagnosis(input);
    expect(s().doc.description).toContain('Releases slip');
    expect(s().doc.description).toContain('Burnout');
  });

  it('makes the new core cloud the active open document', () => {
    s().commitThreeCloudDiagnosis(input);
    expect(s().docs[s().activeDocId]?.cloudType).toBe('core');
  });
});
