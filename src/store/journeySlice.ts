import type { StateCreator } from 'zustand';
import type { AnalysisJourney, JourneyMember, JourneyStageId } from '@/domain/analysisJourney';
import { journeyStage, sanitizeJourney, stageForDiagramType } from '@/domain/analysisJourney';
import { createDocument } from '@/domain/factory';
import { newJourneyId } from '@/domain/ids';
import { listSavedDocIds, loadSavedDoc } from '@/domain/persistence';
import { spawnCRTFromGoalTree } from '@/domain/spawnCRT';
import { spawnFRTFromCrt } from '@/domain/spawnFRT';
import type { DiagramType, DocumentId, TPDocument } from '@/domain/types';
import { readJSON, removeKey, STORAGE_KEYS, writeJSON } from '@/services/storage/storage';
import type { RootStore } from './types';

/**
 * §C — the "Analysis journey": an opt-in, app-level guide over the several trees
 * of one analysis, walked through Barnard's five questions. State is a single
 * active journey (or null), persisted in localStorage — NEVER on a TPDocument, so
 * `schemaVersion` is untouched and every existing surface is byte-identical when
 * no journey is running (zero-default). The framework + derivations are pure in
 * `src/domain/analysisJourney.ts`; this slice owns the state, actions, and IO.
 */

export type JourneyDataKeys = 'journey';

export type JourneySlice = {
  /** The single active journey, or null when none is running. */
  journey: AnalysisJourney | null;

  /** Start a journey; auto-enrols the active doc under its matching stage. */
  startJourney: (title?: string) => void;
  /** Discard the active journey (removes it from storage). The trees are untouched. */
  endJourney: () => void;
  /** Rename the active journey; blank/whitespace keeps the current title. */
  renameJourney: (title: string) => void;

  /** Enrol a tree under a stage (moves it if already enrolled elsewhere). */
  addDocToJourney: (docId: DocumentId, stageId: JourneyStageId, diagramType: DiagramType) => void;
  /** Drop a tree from the journey (all stages). No-op if not a member. */
  removeDocFromJourney: (docId: DocumentId) => void;
  /** Hand-tick a stage done / not-done (overrides derivation upward only). */
  setJourneyStageDone: (stageId: JourneyStageId, done: boolean) => void;

  /** Create a fresh tree for a stage (its primary type, or `diagramType`), open
   *  it in a tab, and enrol it. */
  createTreeForStage: (stageId: JourneyStageId, diagramType?: DiagramType) => void;
  /** Where a bridge applies (to-what← a CRT member; what← a Goal Tree member),
   *  spawn the seeded tree, open it, and enrol it. No-op otherwise. */
  spawnForStage: (stageId: JourneyStageId) => void;
  /** Open a member tree (switch to its tab, or reload it from the library). */
  openJourneyMember: (docId: DocumentId) => void;
};

/** Read + defensively sanitise the stored journey at slice init. */
export const readInitialJourney = (): AnalysisJourney | null => {
  const raw = readJSON<unknown>(STORAGE_KEYS.journey);
  if (raw == null) return null;
  return sanitizeJourney(raw, new Set(listSavedDocIds()));
};

const writeJourney = (journey: AnalysisJourney | null): void => {
  if (journey == null) removeKey(STORAGE_KEYS.journey);
  else writeJSON(STORAGE_KEYS.journey, journey);
};

const defaultTitle = (activeDoc: TPDocument): string =>
  activeDoc.title.trim() ? `${activeDoc.title.trim()} — journey` : 'Analysis journey';

export const journeyDefaults = (): Pick<JourneySlice, JourneyDataKeys> => ({ journey: null });

export const createJourneySlice: StateCreator<RootStore, [], [], JourneySlice> = (set, get) => {
  /** Stamp `updatedAt`, persist, and publish. */
  const commit = (next: AnalysisJourney): void => {
    const stamped = { ...next, updatedAt: Date.now() };
    writeJourney(stamped);
    set({ journey: stamped });
  };

  return {
    journey: readInitialJourney(),

    startJourney: (title) => {
      const now = Date.now();
      const active = get().doc;
      const stageId = stageForDiagramType(active.diagramType);
      const members: JourneyMember[] = stageId
        ? [{ docId: active.id, stageId, diagramType: active.diagramType }]
        : [];
      const journey: AnalysisJourney = {
        id: newJourneyId(),
        title: title?.trim() || defaultTitle(active),
        framework: 'barnard5q',
        members,
        manualDone: [],
        createdAt: now,
        updatedAt: now,
      };
      writeJourney(journey);
      set({ journey });
    },

    endJourney: () => {
      writeJourney(null);
      set({ journey: null });
    },

    renameJourney: (title) => {
      const journey = get().journey;
      if (!journey) return;
      const trimmed = title.trim();
      if (!trimmed || trimmed === journey.title) return;
      commit({ ...journey, title: trimmed });
    },

    addDocToJourney: (docId, stageId, diagramType) => {
      const journey = get().journey;
      if (!journey) return;
      const existing = journey.members.find((m) => m.docId === docId);
      if (existing && existing.stageId === stageId && existing.diagramType === diagramType) return;
      commit({
        ...journey,
        members: [
          ...journey.members.filter((m) => m.docId !== docId),
          { docId, stageId, diagramType },
        ],
      });
    },

    removeDocFromJourney: (docId) => {
      const journey = get().journey;
      if (!journey) return;
      if (!journey.members.some((m) => m.docId === docId)) return;
      commit({ ...journey, members: journey.members.filter((m) => m.docId !== docId) });
    },

    setJourneyStageDone: (stageId, done) => {
      const journey = get().journey;
      if (!journey) return;
      const has = journey.manualDone.includes(stageId);
      if (done === has) return;
      commit({
        ...journey,
        manualDone: done
          ? [...journey.manualDone, stageId]
          : journey.manualDone.filter((s) => s !== stageId),
      });
    },

    createTreeForStage: (stageId, diagramType) => {
      const stage = journeyStage(stageId);
      if (!stage) return;
      const dt = diagramType ?? stage.diagramTypes[0];
      if (!dt) return;
      const doc = createDocument(dt);
      get().openDocInTab(doc);
      get().addDocToJourney(doc.id, stageId, dt);
    },

    spawnForStage: (stageId) => {
      const journey = get().journey;
      if (!journey) return;
      // The two shipped unlinked bridges: FRT←CRT for "to-what", CRT←Goal Tree
      // for "what". Any other stage has no bridge — use createTreeForStage.
      const sourceType: DiagramType | null =
        stageId === 'to-what' ? 'crt' : stageId === 'what' ? 'goalTree' : null;
      if (!sourceType) return;
      const member = journey.members.find((m) => m.diagramType === sourceType);
      if (!member) return;
      const source = get().docs[member.docId] ?? loadSavedDoc(member.docId);
      if (!source) return;
      const spawned =
        stageId === 'to-what' ? spawnFRTFromCrt(source) : spawnCRTFromGoalTree(source);
      get().openDocInTab(spawned);
      get().addDocToJourney(spawned.id, stageId, spawned.diagramType);
    },

    openJourneyMember: (docId) => {
      get().openSavedDoc(docId);
    },
  };
};
