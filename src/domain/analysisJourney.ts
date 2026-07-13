// §C — the "Analysis journey" model. A journey is an opt-in, app-level grouping
// of the several trees that make up ONE analysis, walked through Barnard's five
// questions (Handbook Ch. 15 Table 15-3): a guided flow over the trees the user
// builds, not a new kind of document. It lives in localStorage (never on a
// TPDocument — a journey spans many docs), so there is no schema change.
//
// This module is pure: the framework definition, the docId↔stage membership
// derivations, and a defensive sanitiser for the stored blob. All localStorage
// IO and the store actions live in `src/store/journeySlice.ts`.

import { DIAGRAM_TYPE_LABEL } from './entityTypeMeta';
import type { DiagramType, DocumentId } from './types';

/** Barnard's five questions, in order — each maps to the tree(s) it produces. */
export type JourneyStageId = 'why' | 'what' | 'to-what' | 'how' | 'sustain';

export type JourneyStage = {
  id: JourneyStageId;
  /** The question, verbatim — the row heading. */
  question: string;
  /** A few words on what this stage is for. */
  purpose: string;
  /** The diagram type(s) this stage produces, in build order. */
  diagramTypes: DiagramType[];
  /** One-line coaching for the stage. */
  hint: string;
};

export type JourneyStageStatus = 'done' | 'active' | 'todo';

/** A tree enrolled in a journey, tagged with the stage it serves. `diagramType`
 *  is stored so coverage can be derived without loading a closed doc's body. */
export type JourneyMember = {
  docId: DocumentId;
  stageId: JourneyStageId;
  diagramType: DiagramType;
};

export type AnalysisJourney = {
  id: string;
  title: string;
  /** Only Barnard's five questions ship today; the field keeps room for CMM /
   *  U-Shape presets without a storage migration. */
  framework: 'barnard5q';
  members: JourneyMember[];
  /** Stages the user has ticked done by hand (e.g. "sustain", handled outside a
   *  tree). Overrides derivation upward only — never forces a stage back to todo. */
  manualDone: JourneyStageId[];
  createdAt: number;
  updatedAt: number;
};

/**
 * The shipped framework. `why`→Goal Tree · `what`→CRT · `to-what`→EC/FRT/NBR ·
 * `how`→PRT/TT · `sustain`→S&T. Each diagram type belongs to exactly one stage.
 */
export const BARNARD_FIVE_QUESTIONS: readonly JourneyStage[] = [
  {
    id: 'why',
    question: 'Why change?',
    purpose: 'Frame the goal and the gap',
    diagramTypes: ['goalTree'],
    hint: 'Start from the goal and its necessary conditions, then show where reality falls short.',
  },
  {
    id: 'what',
    question: 'What to change?',
    purpose: 'Find the core problem',
    diagramTypes: ['crt'],
    hint: 'Trace the undesirable effects down to the one core problem worth solving.',
  },
  {
    id: 'to-what',
    question: 'What to change to?',
    purpose: 'Break the conflict, design the future',
    diagramTypes: ['ec', 'frt', 'nbr'],
    hint: 'Surface the conflict that holds the problem in place, break it, and build the future it unlocks.',
  },
  {
    id: 'how',
    question: 'How to cause the change?',
    purpose: 'Plan the execution',
    diagramTypes: ['prt', 'tt'],
    hint: 'Turn the change into a sequenced plan — the obstacles to clear and the steps to get there.',
  },
  {
    id: 'sustain',
    question: 'How to sustain it?',
    purpose: 'Measure and keep improving',
    diagramTypes: ['st'],
    hint: 'Decide how you will measure the change and keep improving once it holds.',
  },
] as const;

const STAGE_BY_ID: ReadonlyMap<JourneyStageId, JourneyStage> = new Map(
  BARNARD_FIVE_QUESTIONS.map((s) => [s.id, s])
);

export const journeyStage = (id: JourneyStageId): JourneyStage | undefined => STAGE_BY_ID.get(id);

const VALID_STAGE_IDS: ReadonlySet<string> = new Set(BARNARD_FIVE_QUESTIONS.map((s) => s.id));

/** Reverse map: which stage a freshly created/opened diagram type belongs to.
 *  `freeform` (and anything unmapped) returns undefined — not enrolled. */
const STAGE_FOR_TYPE: Partial<Record<DiagramType, JourneyStageId>> = (() => {
  const m: Partial<Record<DiagramType, JourneyStageId>> = {};
  for (const s of BARNARD_FIVE_QUESTIONS) {
    for (const dt of s.diagramTypes) m[dt] = s.id;
  }
  return m;
})();

export const stageForDiagramType = (dt: DiagramType): JourneyStageId | undefined =>
  STAGE_FOR_TYPE[dt];

/** The still-existing member docIds enrolled under a stage (UI: the Open action). */
export const stageMemberDocIds = (
  journey: AnalysisJourney,
  stageId: JourneyStageId,
  existingDocIds: ReadonlySet<string>
): DocumentId[] =>
  journey.members
    .filter((m) => m.stageId === stageId && existingDocIds.has(m.docId))
    .map((m) => m.docId);

/**
 * Status for every stage at once. A stage is `done` when the user ticked it or a
 * still-existing member tree is enrolled under it; the earliest not-done stage is
 * `active`; the rest are `todo`. Cheap — needs only the set of existing docIds.
 */
export const computeJourneyStatuses = (
  journey: AnalysisJourney,
  existingDocIds: ReadonlySet<string>
): Record<JourneyStageId, JourneyStageStatus> => {
  const out = {} as Record<JourneyStageId, JourneyStageStatus>;
  let activeAssigned = false;
  for (const stage of BARNARD_FIVE_QUESTIONS) {
    const hasMember = journey.members.some(
      (m) => m.stageId === stage.id && existingDocIds.has(m.docId)
    );
    if (journey.manualDone.includes(stage.id) || hasMember) {
      out[stage.id] = 'done';
    } else if (!activeAssigned) {
      out[stage.id] = 'active';
      activeAssigned = true;
    } else {
      out[stage.id] = 'todo';
    }
  }
  return out;
};

/** Per-diagram-type presence within a stage — drives the row's type chips. */
export const stageTypeCoverage = (
  stage: JourneyStage,
  journey: AnalysisJourney,
  existingDocIds: ReadonlySet<string>
): { diagramType: DiagramType; present: boolean }[] =>
  stage.diagramTypes.map((dt) => ({
    diagramType: dt,
    present: journey.members.some(
      (m) => m.stageId === stage.id && m.diagramType === dt && existingDocIds.has(m.docId)
    ),
  }));

/** How many stages are done, out of five — the progress read-out. */
export const journeyProgress = (
  journey: AnalysisJourney,
  existingDocIds: ReadonlySet<string>
): { done: number; total: number } => {
  const statuses = computeJourneyStatuses(journey, existingDocIds);
  const done = BARNARD_FIVE_QUESTIONS.filter((s) => statuses[s.id] === 'done').length;
  return { done, total: BARNARD_FIVE_QUESTIONS.length };
};

const isValidDiagramType = (v: unknown): v is DiagramType =>
  typeof v === 'string' && v in DIAGRAM_TYPE_LABEL;

/**
 * Defensive parse of the stored journey blob. Drops members whose docId no longer
 * exists or whose shape is wrong, filters `manualDone` to known stages, and
 * returns null for anything that isn't a well-formed journey — mirrors
 * `readInitialPrefs`'s "never trust localStorage" posture.
 */
export const sanitizeJourney = (
  raw: unknown,
  existingDocIds: ReadonlySet<string>
): AnalysisJourney | null => {
  if (raw == null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.title !== 'string') return null;
  if (r.framework !== 'barnard5q') return null;

  const valid: JourneyMember[] = Array.isArray(r.members)
    ? r.members.filter((m): m is JourneyMember => {
        if (m == null || typeof m !== 'object') return false;
        const mm = m as Record<string, unknown>;
        return (
          typeof mm.docId === 'string' &&
          existingDocIds.has(mm.docId) &&
          typeof mm.stageId === 'string' &&
          VALID_STAGE_IDS.has(mm.stageId) &&
          isValidDiagramType(mm.diagramType)
        );
      })
    : [];
  // De-dup by docId, keeping the last enrolment (a Map keeps first-seen order).
  const byDoc = new Map<string, JourneyMember>();
  for (const m of valid) byDoc.set(m.docId, m);
  const members = [...byDoc.values()];

  const manualDone: JourneyStageId[] = Array.isArray(r.manualDone)
    ? (r.manualDone.filter(
        (s): s is JourneyStageId => typeof s === 'string' && VALID_STAGE_IDS.has(s)
      ) as JourneyStageId[])
    : [];

  return {
    id: r.id,
    title: r.title,
    framework: 'barnard5q',
    members,
    manualDone,
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
};
