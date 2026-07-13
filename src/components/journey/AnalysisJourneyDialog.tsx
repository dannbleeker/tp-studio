import { CheckCircle2, Circle, CircleDot, ExternalLink, Plus, Route, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { LargeDialog } from '@/components/ui/LargeDialog';
import {
  BARNARD_FIVE_QUESTIONS,
  computeJourneyStatuses,
  type JourneyStage,
  type JourneyStageId,
  journeyProgress,
  stageMemberDocIds,
  stageTypeCoverage,
} from '@/domain/analysisJourney';
import { DIAGRAM_SHORT_LABEL } from '@/domain/entityTypeMeta';
import { listSavedDocIds } from '@/domain/persistence';
import type { DiagramType } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * §C — the Analysis journey dialog. An opt-in guide over the several trees of one
 * analysis, walked through Barnard's five questions. It reads the journey state
 * (`journeySlice`) + the set of existing trees, derives each stage's status, and
 * offers create / spawn / open per stage. It builds on shipped machinery — a
 * "Create" mints a normal tree, a "Spawn" reuses the CRT→FRT / GoalTree→CRT
 * bridges — so there's nothing new to learn.
 */

// The tree a bridge produces for a stage (else no bridge — use Create).
const SPAWN_TARGET: Partial<Record<JourneyStageId, DiagramType>> = {
  what: 'crt',
  'to-what': 'frt',
};

const STATUS_ICON = {
  done: CheckCircle2,
  active: CircleDot,
  todo: Circle,
} as const;

export function AnalysisJourneyDialog() {
  const open = useDocumentStore((s) => s.analysisJourneyOpen);
  const close = useDocumentStore((s) => s.closeAnalysisJourney);
  const journey = useDocumentStore((s) => s.journey);
  const docs = useDocumentStore((s) => s.docs);
  const savedDocsVersion = useDocumentStore((s) => s.savedDocsVersion);
  const startJourney = useDocumentStore((s) => s.startJourney);
  const endJourney = useDocumentStore((s) => s.endJourney);
  const renameJourney = useDocumentStore((s) => s.renameJourney);
  const setStageDone = useDocumentStore((s) => s.setJourneyStageDone);
  const createTreeForStage = useDocumentStore((s) => s.createTreeForStage);
  const spawnForStage = useDocumentStore((s) => s.spawnForStage);
  const openJourneyMember = useDocumentStore((s) => s.openJourneyMember);

  const [titleDraft, setTitleDraft] = useState('');
  useEffect(() => {
    if (journey) setTitleDraft(journey.title);
  }, [journey]);

  // Every open tab + every saved tree — a member counts as "existing" if it's in
  // either. `savedDocsVersion` is the cache-buster: `listSavedDocIds()` reads
  // storage (not a reactive value), so the bump is what re-reads it here.
  const existingDocIds = useMemo(() => {
    void savedDocsVersion;
    return new Set<string>([...Object.keys(docs), ...listSavedDocIds()]);
  }, [docs, savedDocsVersion]);

  if (!open) return null;

  const commitTitle = () => {
    if (journey && titleDraft.trim()) renameJourney(titleDraft);
  };

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title="Analysis journey"
      subtitle="Walk one analysis through Barnard's five questions — a guided flow over the trees it needs. Opt-in; nothing changes on your trees until you build them."
      widthClass="w-[min(560px,96vw)]"
    >
      {!journey ? (
        <div className="flex flex-col items-start gap-3 p-5">
          <div className="flex items-center gap-2 text-accent-700 dark:text-accent-300">
            <Route className="h-5 w-5" aria-hidden />
            <span className="font-medium text-sm">Start a guided journey</span>
          </div>
          <p className="text-neutral-600 text-sm dark:text-neutral-300">
            A journey groups the trees of one analysis and tracks the five questions — why change,
            what to change, what to change to, how to cause it, and how to sustain it. Each stage
            tells you which tree to build and lets you create, spawn, or open it in place.
          </p>
          <button
            type="button"
            onClick={() => startJourney()}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-accent-400 bg-accent-50 px-3 py-1.5 font-medium text-accent-900 text-sm transition hover:bg-accent-100 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-100"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Start journey
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <JourneyHeader
            titleDraft={titleDraft}
            onTitleChange={setTitleDraft}
            onTitleCommit={commitTitle}
            progress={journeyProgress(journey, existingDocIds)}
            onEnd={endJourney}
          />

          <div className="flex flex-col gap-2">
            {BARNARD_FIVE_QUESTIONS.map((stage) => {
              const statuses = computeJourneyStatuses(journey, existingDocIds);
              const memberIds = stageMemberDocIds(journey, stage.id, existingDocIds);
              const coverage = stageTypeCoverage(stage, journey, existingDocIds);
              const target = SPAWN_TARGET[stage.id];
              const hasSource = journey.members.some(
                (m) =>
                  ((stage.id === 'to-what' && m.diagramType === 'crt') ||
                    (stage.id === 'what' && m.diagramType === 'goalTree')) &&
                  existingDocIds.has(m.docId)
              );
              const spawnAvailable =
                target != null &&
                hasSource &&
                !coverage.some((c) => c.diagramType === target && c.present);
              return (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  status={statuses[stage.id]}
                  coverage={coverage}
                  memberIds={memberIds}
                  manuallyDone={journey.manualDone.includes(stage.id)}
                  spawnTarget={spawnAvailable ? (target ?? null) : null}
                  onOpen={() => {
                    const first = memberIds[0];
                    if (first) openJourneyMember(first);
                  }}
                  onCreate={() => createTreeForStage(stage.id)}
                  onSpawn={() => spawnForStage(stage.id)}
                  onToggleDone={(done) => setStageDone(stage.id, done)}
                />
              );
            })}
          </div>
        </div>
      )}
    </LargeDialog>
  );
}

function JourneyHeader({
  titleDraft,
  onTitleChange,
  onTitleCommit,
  progress,
  onEnd,
}: {
  titleDraft: string;
  onTitleChange: (v: string) => void;
  onTitleCommit: () => void;
  progress: { done: number; total: number };
  onEnd: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-neutral-200 border-b pb-3 dark:border-neutral-800">
      <div className="flex items-center gap-2">
        <input
          value={titleDraft}
          onChange={(e) => onTitleChange(e.target.value)}
          onBlur={onTitleCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          aria-label="Journey name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-medium text-neutral-900 text-sm transition hover:border-neutral-200 focus:border-accent-400 focus:outline-none dark:text-neutral-100 dark:hover:border-neutral-700"
        />
        <button
          type="button"
          onClick={onEnd}
          className="whitespace-nowrap rounded-md px-2 py-1 text-neutral-500 text-xs transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          End journey
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
          Barnard's five questions
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className="h-full bg-accent-500 transition-all"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
        <span className="text-neutral-500 text-xs dark:text-neutral-400">
          {progress.done} / {progress.total}
        </span>
      </div>
    </div>
  );
}

function StageRow({
  stage,
  status,
  coverage,
  memberIds,
  manuallyDone,
  spawnTarget,
  onOpen,
  onCreate,
  onSpawn,
  onToggleDone,
}: {
  stage: JourneyStage;
  status: 'done' | 'active' | 'todo';
  coverage: { diagramType: DiagramType; present: boolean }[];
  memberIds: string[];
  manuallyDone: boolean;
  spawnTarget: DiagramType | null;
  onOpen: () => void;
  onCreate: () => void;
  onSpawn: () => void;
  onToggleDone: (done: boolean) => void;
}) {
  const Icon = STATUS_ICON[status];
  const hasMember = memberIds.length > 0;
  const primaryType = stage.diagramTypes[0];
  const iconColor =
    status === 'done'
      ? 'text-emerald-600 dark:text-emerald-400'
      : status === 'active'
        ? 'text-accent-600 dark:text-accent-400'
        : 'text-neutral-400 dark:text-neutral-500';

  return (
    <div
      className={`flex gap-3 rounded-md border p-3 ${
        status === 'active'
          ? 'border-accent-300 bg-white dark:border-accent-700/60 dark:bg-neutral-900'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-neutral-900 text-sm dark:text-neutral-100">
          {stage.question}
        </div>
        <div className="text-neutral-500 text-xs dark:text-neutral-400">{stage.purpose}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {coverage.map((c) => (
            <span
              key={c.diagramType}
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                c.present
                  ? 'bg-accent-100 text-accent-800 dark:bg-accent-900/50 dark:text-accent-200'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              {c.present ? '✓ ' : ''}
              {DIAGRAM_SHORT_LABEL[c.diagramType]}
            </span>
          ))}
          {spawnTarget && hasMember ? (
            <button
              type="button"
              onClick={onSpawn}
              className="inline-flex items-center gap-0.5 rounded-full border border-accent-300 px-2 py-0.5 text-[10px] text-accent-700 transition hover:bg-accent-50 dark:border-accent-700 dark:text-accent-300 dark:hover:bg-accent-950/40"
            >
              <Plus className="h-2.5 w-2.5" aria-hidden />
              {DIAGRAM_SHORT_LABEL[spawnTarget]}
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {hasMember ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 px-2.5 py-1 text-neutral-700 text-xs transition hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Open
          </button>
        ) : spawnTarget ? (
          <button
            type="button"
            onClick={onSpawn}
            className="inline-flex items-center gap-1 rounded-md border border-accent-400 bg-accent-50 px-2.5 py-1 font-medium text-accent-900 text-xs transition hover:bg-accent-100 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-100"
          >
            Spawn {DIAGRAM_SHORT_LABEL[spawnTarget]}
          </button>
        ) : (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-1 rounded-md border border-accent-400 bg-accent-50 px-2.5 py-1 font-medium text-accent-900 text-xs transition hover:bg-accent-100 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-100"
          >
            Create {primaryType ? DIAGRAM_SHORT_LABEL[primaryType] : 'tree'}
          </button>
        )}
        {!hasMember ? (
          <button
            type="button"
            onClick={() => onToggleDone(!manuallyDone)}
            className="text-[10px] text-neutral-400 underline-offset-2 transition hover:text-neutral-600 hover:underline dark:text-neutral-500 dark:hover:text-neutral-300"
          >
            {manuallyDone ? 'Not done' : 'Mark done'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
