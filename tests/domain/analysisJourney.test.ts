import { describe, expect, it } from 'vitest';
import {
  type AnalysisJourney,
  BARNARD_FIVE_QUESTIONS,
  computeJourneyStatuses,
  journeyProgress,
  sanitizeJourney,
  stageForDiagramType,
  stageTypeCoverage,
} from '@/domain/analysisJourney';
import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import type { DiagramType, DocumentId } from '@/domain/types';

const mkJourney = (over: Partial<AnalysisJourney> = {}): AnalysisJourney => ({
  id: 'j1',
  title: 'Test',
  framework: 'barnard5q',
  members: [],
  manualDone: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const member = (
  docId: string,
  stageId: AnalysisJourney['members'][number]['stageId'],
  dt: DiagramType
) => ({
  docId: docId as DocumentId,
  stageId,
  diagramType: dt,
});

describe('analysisJourney — framework', () => {
  it('is Barnard’s five questions, in order, with unique ids', () => {
    expect(BARNARD_FIVE_QUESTIONS.map((s) => s.id)).toEqual([
      'why',
      'what',
      'to-what',
      'how',
      'sustain',
    ]);
    expect(new Set(BARNARD_FIVE_QUESTIONS.map((s) => s.id)).size).toBe(5);
  });

  it('maps every stage to valid diagram types and non-empty copy', () => {
    for (const s of BARNARD_FIVE_QUESTIONS) {
      expect(s.diagramTypes.length).toBeGreaterThan(0);
      for (const dt of s.diagramTypes) expect(dt in DIAGRAM_TYPE_LABEL).toBe(true);
      expect(s.question.trim().length).toBeGreaterThan(0);
      expect(s.purpose.trim().length).toBeGreaterThan(0);
      expect(s.hint.trim().length).toBeGreaterThan(0);
    }
  });

  it('maps each diagram type back to exactly one stage (freeform to none)', () => {
    expect(stageForDiagramType('goalTree')).toBe('why');
    expect(stageForDiagramType('crt')).toBe('what');
    expect(stageForDiagramType('id')).toBe('what');
    expect(stageForDiagramType('ec')).toBe('to-what');
    expect(stageForDiagramType('frt')).toBe('to-what');
    expect(stageForDiagramType('nbr')).toBe('to-what');
    expect(stageForDiagramType('prt')).toBe('how');
    expect(stageForDiagramType('tt')).toBe('how');
    expect(stageForDiagramType('st')).toBe('sustain');
    expect(stageForDiagramType('freeform')).toBeUndefined();
  });
});

describe('analysisJourney — status derivation', () => {
  it('an empty journey makes the first stage active, the rest todo', () => {
    const st = computeJourneyStatuses(mkJourney(), new Set());
    expect(st).toEqual({
      why: 'active',
      what: 'todo',
      'to-what': 'todo',
      how: 'todo',
      sustain: 'todo',
    });
  });

  it('marks a stage done when it has an existing member, keeping one active', () => {
    const journey = mkJourney({ members: [member('d1', 'what', 'crt')] });
    const st = computeJourneyStatuses(journey, new Set(['d1']));
    // 'what' is built out of order; 'why' is the earliest still-unbuilt stage.
    expect(st).toEqual({
      why: 'active',
      what: 'done',
      'to-what': 'todo',
      how: 'todo',
      sustain: 'todo',
    });
  });

  it('honours a hand-ticked (manualDone) stage with no tree', () => {
    const st = computeJourneyStatuses(mkJourney({ manualDone: ['sustain'] }), new Set());
    expect(st.sustain).toBe('done');
    expect(st.why).toBe('active');
  });

  it('treats a member whose doc no longer exists as absent', () => {
    const journey = mkJourney({ members: [member('gone', 'what', 'crt')] });
    const st = computeJourneyStatuses(journey, new Set()); // 'gone' not in existing set
    // The dangling member is ignored, so every stage is unbuilt: 'why' is active.
    expect(st.why).toBe('active');
    expect(st.what).toBe('todo');
  });

  it('when every stage has a live member, all are done', () => {
    const journey = mkJourney({
      members: [
        member('a', 'why', 'goalTree'),
        member('b', 'what', 'crt'),
        member('c', 'to-what', 'frt'),
        member('d', 'how', 'prt'),
        member('e', 'sustain', 'st'),
      ],
    });
    const st = computeJourneyStatuses(journey, new Set(['a', 'b', 'c', 'd', 'e']));
    expect(Object.values(st).every((v) => v === 'done')).toBe(true);
    expect(journeyProgress(journey, new Set(['a', 'b', 'c', 'd', 'e']))).toEqual({
      done: 5,
      total: 5,
    });
  });
});

describe('analysisJourney — stage type coverage', () => {
  it('reports which of a stage’s diagram types are present', () => {
    const toWhat = BARNARD_FIVE_QUESTIONS.find((s) => s.id === 'to-what')!;
    const journey = mkJourney({ members: [member('f', 'to-what', 'frt')] });
    expect(stageTypeCoverage(toWhat, journey, new Set(['f']))).toEqual([
      { diagramType: 'ec', present: false },
      { diagramType: 'frt', present: true },
      { diagramType: 'nbr', present: false },
    ]);
  });
});

describe('analysisJourney — sanitiseJourney', () => {
  const existing = new Set(['keep']);

  it('rejects non-objects and wrong shapes', () => {
    expect(sanitizeJourney(null, existing)).toBeNull();
    expect(sanitizeJourney('x', existing)).toBeNull();
    expect(sanitizeJourney({ title: 'no id' }, existing)).toBeNull();
    expect(sanitizeJourney({ id: 'a', title: 'b', framework: 'cmm' }, existing)).toBeNull();
  });

  it('drops members whose doc is gone, or whose stage/type is invalid', () => {
    const raw = {
      id: 'a',
      title: 'b',
      framework: 'barnard5q',
      members: [
        member('keep', 'what', 'crt'),
        member('gone', 'what', 'crt'), // dangling docId
        { docId: 'keep2', stageId: 'bogus', diagramType: 'crt' }, // bad stage
        { docId: 'keep3', stageId: 'what', diagramType: 'nope' }, // bad type
      ],
      manualDone: ['sustain', 'bogus'],
      createdAt: 1,
      updatedAt: 2,
    };
    const out = sanitizeJourney(raw, new Set(['keep', 'keep2', 'keep3']));
    expect(out?.members.map((m) => m.docId)).toEqual(['keep']);
    expect(out?.manualDone).toEqual(['sustain']);
  });

  it('de-duplicates members by docId, keeping the last enrolment', () => {
    const raw = {
      id: 'a',
      title: 'b',
      framework: 'barnard5q',
      members: [member('keep', 'what', 'crt'), member('keep', 'to-what', 'frt')],
      manualDone: [],
    };
    const out = sanitizeJourney(raw, existing);
    expect(out?.members).toEqual([{ docId: 'keep', stageId: 'to-what', diagramType: 'frt' }]);
  });
});
