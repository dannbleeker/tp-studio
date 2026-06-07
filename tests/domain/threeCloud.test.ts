import { beforeEach, describe, expect, it } from 'vitest';
import type { ECSlot } from '@/domain/ecGuiding';
import { exportToJSON, importFromJSON } from '@/domain/persistenceJson';
import {
  buildThreeCloudCoreDoc,
  type CloudConflict,
  summariseConflicts,
  type ThreeCloudInput,
} from '@/domain/threeCloud';
import { resetIds } from './helpers';

beforeEach(resetIds);

const sampleConflicts: CloudConflict[] = [
  {
    ude: 'Releases slip every sprint',
    doNow: 'Pull people to firefight',
    doInstead: 'Protect the plan',
  },
  { ude: 'Quality bugs recur', doNow: 'Ship fast', doInstead: 'Slow down to test' },
  { ude: 'Team is burning out', doNow: 'Add more work', doInstead: 'Cut scope' },
];

const sampleInput = (overrides: Partial<ThreeCloudInput> = {}): ThreeCloudInput => ({
  conflicts: sampleConflicts,
  core: {
    objective: 'Deliver reliably and sustainably',
    need1: 'Hit our commitments this quarter',
    need2: 'Keep the system and team healthy',
    want1: 'Push hard on every deadline',
    want2: 'Hold capacity back to invest',
  },
  ...overrides,
});

/** Title of the box occupying a given EC slot. */
const titleOfSlot = (
  doc: ReturnType<typeof buildThreeCloudCoreDoc>,
  slot: ECSlot
): string | undefined => Object.values(doc.entities).find((e) => e.ecSlot === slot)?.title;

describe('buildThreeCloudCoreDoc', () => {
  it('produces an EC document tagged as a core cloud', () => {
    const doc = buildThreeCloudCoreDoc(sampleInput());
    expect(doc.diagramType).toBe('ec');
    expect(doc.cloudType).toBe('core');
  });

  it('maps the consolidated core fields onto the five EC slots', () => {
    const doc = buildThreeCloudCoreDoc(sampleInput());
    expect(titleOfSlot(doc, 'a')).toBe('Deliver reliably and sustainably');
    expect(titleOfSlot(doc, 'b')).toBe('Hit our commitments this quarter');
    expect(titleOfSlot(doc, 'c')).toBe('Keep the system and team healthy');
    expect(titleOfSlot(doc, 'd')).toBe('Push hard on every deadline');
    expect(titleOfSlot(doc, 'dPrime')).toBe('Hold capacity back to invest');
  });

  it('keeps the canonical 5-box / 4-necessity-edge EC scaffold', () => {
    const doc = buildThreeCloudCoreDoc(sampleInput());
    expect(Object.keys(doc.entities)).toHaveLength(5);
    const edges = Object.values(doc.edges);
    expect(edges).toHaveLength(4);
    expect(edges.every((e) => e.kind === 'necessity')).toBe(true);
  });

  it('defaults the title but honours an explicit one', () => {
    expect(buildThreeCloudCoreDoc(sampleInput()).title).toBe('Core cloud — 3-cloud diagnosis');
    expect(buildThreeCloudCoreDoc(sampleInput({ title: '  Firefighting core  ' })).title).toBe(
      'Firefighting core'
    );
  });

  it('records the three source conflicts as a description provenance block', () => {
    const doc = buildThreeCloudCoreDoc(sampleInput());
    expect(doc.description).toContain('Consolidated from a 3-cloud rapid diagnosis');
    expect(doc.description).toContain('Releases slip every sprint');
    expect(doc.description).toContain('Quality bugs recur');
    expect(doc.description).toContain('Team is burning out');
  });

  it('trims box titles and omits the description when no conflict is named', () => {
    const doc = buildThreeCloudCoreDoc({
      conflicts: [{ ude: '   ', doNow: '', doInstead: '' }],
      core: {
        objective: '  Grow sustainably  ',
        need1: 'a',
        need2: 'b',
        want1: 'c',
        want2: 'd',
      },
    });
    expect(titleOfSlot(doc, 'a')).toBe('Grow sustainably');
    expect('description' in doc).toBe(false);
  });

  it('survives a JSON export / import round-trip', () => {
    const doc = buildThreeCloudCoreDoc(sampleInput({ title: 'Round trip' }));
    const back = importFromJSON(exportToJSON(doc));
    expect(back.cloudType).toBe('core');
    expect(back.title).toBe('Round trip');
    expect(back.description).toContain('Releases slip every sprint');
    expect(titleOfSlot(back, 'dPrime')).toBe('Hold capacity back to invest');
  });
});

describe('summariseConflicts', () => {
  it('numbers each named conflict and renders the two-sided pull', () => {
    const text = summariseConflicts(sampleConflicts);
    expect(text).toContain(
      '1. Releases slip every sprint — pulled between "Pull people to firefight" and "Protect the plan".'
    );
    expect(text.split('\n')).toHaveLength(4); // header + 3 conflicts
  });

  it('drops the tension clause when a side is blank', () => {
    const text = summariseConflicts([{ ude: 'Just a symptom', doNow: '', doInstead: '' }]);
    expect(text).toContain('1. Just a symptom.');
    expect(text).not.toContain('pulled between');
  });

  it('returns an empty string when nothing is named', () => {
    expect(summariseConflicts([{ ude: '  ', doNow: 'x', doInstead: 'y' }])).toBe('');
    expect(summariseConflicts([])).toBe('');
  });
});
