/**
 * §C — the Analysis journey store slice. Covers the lifecycle (start/end/rename),
 * membership (add/remove/create/spawn), the manual-done override, the localStorage
 * round-trip via `readInitialJourney`, and the delete-prune hook.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, writeJSON } from '@/services/storage/storage';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { readInitialJourney } from '@/store/journeySlice';

const s = () => useDocumentStore.getState();

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});

describe('journeySlice — lifecycle', () => {
  it('defaults to no active journey', () => {
    expect(s().journey).toBeNull();
  });

  it('startJourney enrols the active doc under its matching stage', () => {
    s().newDocument('crt');
    const crtId = s().activeDocId;
    s().startJourney('Throughput analysis');

    const j = s().journey;
    expect(j?.title).toBe('Throughput analysis');
    expect(j?.framework).toBe('barnard5q');
    expect(j?.members).toEqual([{ docId: crtId, stageId: 'what', diagramType: 'crt' }]);
  });

  it('starting on a freeform tree enrols nothing (freeform maps to no stage)', () => {
    s().newDocument('freeform');
    s().startJourney();
    expect(s().journey?.members).toEqual([]);
  });

  it('endJourney clears the journey and its storage key', () => {
    s().startJourney('x');
    expect(s().journey).not.toBeNull();
    s().endJourney();
    expect(s().journey).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.journey)).toBeNull();
  });

  it('renameJourney trims and ignores blanks', () => {
    s().startJourney('First');
    s().renameJourney('  Second  ');
    expect(s().journey?.title).toBe('Second');
    s().renameJourney('   ');
    expect(s().journey?.title).toBe('Second');
  });
});

describe('journeySlice — membership', () => {
  it('setJourneyStageDone toggles the manual-done override', () => {
    s().startJourney('x');
    s().setJourneyStageDone('sustain', true);
    expect(s().journey?.manualDone).toContain('sustain');
    s().setJourneyStageDone('sustain', false);
    expect(s().journey?.manualDone).not.toContain('sustain');
  });

  it('addDocToJourney moves a doc between stages (one enrolment per doc)', () => {
    s().startJourney('x');
    s().addDocToJourney('d1' as never, 'what', 'crt');
    s().addDocToJourney('d1' as never, 'to-what', 'frt');
    const members = s().journey?.members.filter((m) => m.docId === ('d1' as never)) ?? [];
    expect(members).toEqual([{ docId: 'd1', stageId: 'to-what', diagramType: 'frt' }]);
  });

  it('removeDocFromJourney drops a member', () => {
    s().startJourney('x');
    s().addDocToJourney('d1' as never, 'what', 'crt');
    s().removeDocFromJourney('d1' as never);
    expect(s().journey?.members.some((m) => m.docId === ('d1' as never))).toBe(false);
  });

  it('createTreeForStage opens a new tab of the stage type and enrols it', () => {
    s().newDocument('crt');
    s().startJourney('x');
    const before = s().tabOrder.length;

    s().createTreeForStage('how'); // primary type = prt

    expect(s().tabOrder.length).toBe(before + 1);
    expect(s().doc.diagramType).toBe('prt');
    const enrolled = s().journey?.members.find((m) => m.docId === s().activeDocId);
    expect(enrolled).toEqual({ docId: s().activeDocId, stageId: 'how', diagramType: 'prt' });
  });

  it('spawnForStage(to-what) seeds an FRT from an enrolled CRT and enrols it', () => {
    s().newDocument('crt');
    s().startJourney('x'); // enrols the CRT under 'what'
    s().spawnForStage('to-what');

    expect(s().doc.diagramType).toBe('frt');
    const frt = s().journey?.members.find((m) => m.stageId === 'to-what');
    expect(frt?.diagramType).toBe('frt');
    expect(frt?.docId).toBe(s().activeDocId);
  });

  it('spawnForStage is a no-op when the source tree isn’t enrolled', () => {
    s().newDocument('frt'); // no CRT enrolled
    s().startJourney('x');
    const membersBefore = s().journey?.members.length ?? 0;
    s().spawnForStage('to-what');
    expect(s().journey?.members.length).toBe(membersBefore);
  });
});

describe('journeySlice — persistence', () => {
  it('round-trips a saved member through readInitialJourney', () => {
    s().newDocument('crt');
    s().startJourney('My analysis');
    s().createTreeForStage('to-what', 'frt'); // opened via a tab → saved to storage

    const reloaded = readInitialJourney();
    expect(reloaded?.title).toBe('My analysis');
    expect(reloaded?.members.map((m) => m.diagramType)).toContain('frt');
  });

  it('returns null for a tampered/invalid stored blob', () => {
    writeJSON(STORAGE_KEYS.journey, { framework: 'not-barnard' });
    expect(readInitialJourney()).toBeNull();
  });

  it('deleteSavedDoc prunes the tree from the journey', () => {
    s().newDocument('crt');
    s().startJourney('x');
    s().createTreeForStage('to-what', 'frt');
    const frtId = s().activeDocId;
    expect(s().journey?.members.some((m) => m.docId === frtId)).toBe(true);

    s().deleteSavedDoc(frtId);
    expect(s().journey?.members.some((m) => m.docId === frtId)).toBe(false);
  });
});
