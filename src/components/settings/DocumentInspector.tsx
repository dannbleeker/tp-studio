import { Field } from '@/components/inspector/Field';
import { MarkdownField } from '@/components/inspector/MarkdownField';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { METHOD_BY_DIAGRAM, type MethodStep } from '@/domain/methodChecklist';
import type { DiagramType, SystemScope } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { CustomEntityClassesSection } from './CustomEntityClassesSection';

/**
 * Stable module-level fallbacks for the `useShallow` selector. Without
 * these, `s.doc.systemScope ?? {}` would return a fresh `{}` on every
 * store change, breaking `useShallow`'s reference comparison and looping
 * the component to "max update depth exceeded."
 */
const EMPTY_SCOPE: SystemScope = {};
const EMPTY_CHECKLIST: Record<string, boolean> = {};

/**
 * The seven System Scope prompts come from CRT Step 1 in "Thinking with
 * Flying Logic." They generalize across diagram types — every TOC tree
 * benefits from naming its goal, boundaries, and success measures up
 * front — so the section is universal rather than per-diagram.
 */
const SYSTEM_SCOPE_FIELDS: Array<{
  key: keyof SystemScope;
  label: string;
  placeholder: string;
}> = [
  {
    key: 'goal',
    label: 'System goal',
    placeholder: 'What is this system / situation for?',
  },
  {
    key: 'necessaryConditions',
    label: 'Necessary conditions for the goal',
    placeholder: 'What must be true (in the world) for the goal to be reachable?',
  },
  {
    key: 'successMeasures',
    label: 'Measurements of success',
    placeholder: "How will we know it's working? Specific, observable, quantifiable.",
  },
  {
    key: 'boundaries',
    label: 'System boundaries',
    placeholder: "What's inside the system under analysis vs. context that just affects it?",
  },
  {
    key: 'containingSystem',
    label: 'Containing system',
    placeholder: 'What larger system / organization / process is this inside?',
  },
  {
    key: 'interactingSystems',
    label: 'Interacting systems',
    placeholder: 'Other systems that significantly affect or are affected by this one.',
  },
  {
    key: 'inputsOutputs',
    label: 'Inputs / outputs',
    placeholder: 'What flows in (work, materials, information) and what flows out?',
  },
];

export function DocumentInspector() {
  const open = useDocumentStore((s) => s.docSettingsOpen);
  const close = useDocumentStore((s) => s.closeDocSettings);
  const locked = useDocumentStore((s) => s.browseLocked);

  const {
    title,
    author,
    description,
    diagramType,
    entityCount,
    edgeCount,
    systemScope,
    methodChecklist,
    ecVerbalStyle,
    setTitle,
    setMeta,
    setSystemScope,
    setMethodStep,
    setECVerbalStyle,
  } = useDocumentStore(
    useShallow((s) => ({
      title: s.doc.title,
      author: s.doc.author ?? '',
      description: s.doc.description ?? '',
      diagramType: s.doc.diagramType,
      entityCount: Object.keys(s.doc.entities).length,
      edgeCount: Object.keys(s.doc.edges).length,
      systemScope: s.doc.systemScope ?? EMPTY_SCOPE,
      methodChecklist: s.doc.methodChecklist ?? EMPTY_CHECKLIST,
      ecVerbalStyle: s.doc.ecVerbalStyle ?? 'neutral',
      setTitle: s.setTitle,
      setMeta: s.setDocumentMeta,
      setSystemScope: s.setSystemScope,
      setMethodStep: s.setMethodStep,
      setECVerbalStyle: s.setECVerbalStyle,
    }))
  );

  const steps = METHOD_BY_DIAGRAM[diagramType] ?? [];
  const doneCount = steps.filter((s) => methodChecklist[s.id] === true).length;

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="doc-inspector-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="doc-inspector-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          Document
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close document inspector">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
        <Field label="Title">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={locked}
            className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </Field>

        <Field label="Author">
          <input
            type="text"
            value={author}
            placeholder="Optional"
            onChange={(e) => setMeta({ author: e.target.value })}
            disabled={locked}
            className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
        </Field>

        <MarkdownField
          label="Description"
          value={description}
          onChange={(next) => setMeta({ description: next })}
          placeholder="Goal of this tree, who it's for, what's in scope — supports markdown."
          locked={locked}
        />

        {/*
          System Scope — book-derived "Step 0" capture. Collapsed by default
          so the dialog opens with a glanceable summary rather than a wall
          of empty textareas. The `<details>` summary line shows how many
          questions are filled to give a sense of completeness.
        */}
        <details
          className="rounded-md border border-neutral-200 dark:border-neutral-800"
          // Auto-open when at least one scope field is already filled, so a
          // user re-opening the dialog sees their existing answers without
          // an extra click.
          {...(Object.keys(systemScope).length > 0 ? { open: true } : {})}
        >
          <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-neutral-600 text-xs uppercase tracking-wider dark:text-neutral-300">
            System Scope
            <span className="ml-2 font-normal text-neutral-400 normal-case tracking-normal">
              {Object.keys(systemScope).length}/{SYSTEM_SCOPE_FIELDS.length} answered
            </span>
          </summary>
          <div className="space-y-3 border-neutral-200 border-t px-3 py-3 dark:border-neutral-800">
            <p className="text-neutral-500 text-xs dark:text-neutral-400">
              CRT Step 1 — answer these before drawing entities. The discipline pays back as the
              tree grows.
            </p>
            {SYSTEM_SCOPE_FIELDS.map(({ key, label, placeholder }) => (
              <Field key={key} label={label}>
                <textarea
                  rows={2}
                  value={systemScope[key] ?? ''}
                  placeholder={placeholder}
                  onChange={(e) => setSystemScope({ [key]: e.target.value })}
                  disabled={locked}
                  className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-700 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                />
              </Field>
            ))}
          </div>
        </details>

        {/*
          Method checklist — per-diagram canonical recipe. Auto-opens when
          any step is already checked so the user sees their progress on
          re-open. The list itself is rendered by `MethodChecklist` which
          reads the canonical step catalog from `methodChecklist.ts`.
        */}
        <details
          className="rounded-md border border-neutral-200 dark:border-neutral-800"
          {...(doneCount > 0 ? { open: true } : {})}
        >
          <summary className="cursor-pointer select-none px-3 py-2 font-semibold text-neutral-600 text-xs uppercase tracking-wider dark:text-neutral-300">
            Method checklist
            <span className="ml-2 font-normal text-neutral-400 normal-case tracking-normal">
              {doneCount}/{steps.length} steps — {DIAGRAM_TYPE_LABEL[diagramType]}
            </span>
          </summary>
          <div className="space-y-2 border-neutral-200 border-t px-3 py-3 dark:border-neutral-800">
            <p className="text-neutral-500 text-xs dark:text-neutral-400">
              The canonical recipe for this diagram type. Each step is roughly one focused work
              session.
            </p>
            <MethodChecklist
              diagramType={diagramType}
              checked={methodChecklist}
              locked={locked}
              onToggle={setMethodStep}
            />
          </div>
        </details>

        {diagramType === 'ec' && (
          <Field label="EC verbal style">
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {(
                [
                  { id: 'neutral' as const, label: 'Neutral ("we must")' },
                  { id: 'twoSided' as const, label: 'Two-sided ("I" vs "they")' },
                ] satisfies { id: 'neutral' | 'twoSided'; label: string }[]
              ).map((opt) => {
                const active = ecVerbalStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    data-testid={`ec-verbal-style-${opt.id}`}
                    disabled={locked}
                    onClick={() => setECVerbalStyle(opt.id)}
                    className={`rounded-md border px-2 py-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      active
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                        : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
              Switches the verbalisation strip between the workshop-default neutral voice ("In order
              to A, we must B") and the BESTSELLER PPT's two-party framing ("they want to" / "I want
              to") that surfaces the felt negotiation.
            </p>
          </Field>
        )}

        <CustomEntityClassesSection />

        <dl className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
          <Stat label="Type" value={DIAGRAM_TYPE_LABEL[diagramType]} />
          <div className="mt-2 grid grid-cols-2 gap-3 text-center">
            <Stat label="Entities" value={String(entityCount)} center />
            <Stat label="Edges" value={String(edgeCount)} center />
          </div>
        </dl>
      </div>
    </Modal>
  );
}

function MethodChecklist({
  diagramType,
  checked,
  locked,
  onToggle,
}: {
  diagramType: DiagramType;
  checked: Record<string, boolean>;
  locked: boolean;
  onToggle: (stepId: string, done: boolean) => void;
}) {
  const steps: MethodStep[] = METHOD_BY_DIAGRAM[diagramType] ?? [];
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step, idx) => {
        const done = checked[step.id] === true;
        return (
          <li
            key={step.id}
            className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <input
              id={`method-${step.id}`}
              type="checkbox"
              className="mt-0.5"
              checked={done}
              disabled={locked}
              onChange={(e) => onToggle(step.id, e.target.checked)}
            />
            <label htmlFor={`method-${step.id}`} className="flex-1 cursor-pointer">
              <span
                className={`text-sm ${
                  done
                    ? 'text-neutral-400 line-through dark:text-neutral-500'
                    : 'text-neutral-800 dark:text-neutral-100'
                }`}
              >
                {idx + 1}. {step.label}
              </span>
              {step.hint && (
                <span className="mt-0.5 block text-neutral-500 text-xs dark:text-neutral-400">
                  {step.hint}
                </span>
              )}
            </label>
          </li>
        );
      })}
    </ol>
  );
}

function Stat({
  label,
  value,
  center = false,
}: {
  label: string;
  value: string;
  center?: boolean;
}) {
  return (
    <div className={center ? 'flex flex-col items-center gap-0.5' : 'flex flex-col gap-0.5'}>
      <dt className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
        {label}
      </dt>
      <dd className="text-neutral-800 text-sm dark:text-neutral-100">{value}</dd>
    </div>
  );
}
