import type { Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { ChevronUp, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Session 78 / brief §5 + §6 — Creation Wizard Panel.
 *
 * Floating top-left panel that walks a first-time user through the
 * canonical structure of a new Goal Tree or Evaporating Cloud. The
 * panel lives ON TOP of the canvas (rather than as a blocking modal),
 * so the user can dismiss / minimise at any time and engage the
 * diagram directly without losing the entities created so far.
 *
 * Behaviour highlights:
 *
 *   - Each answer commits an entity / fills a slot immediately, so
 *     even a mid-wizard dismissal leaves the canvas in a useful state.
 *   - "Don't show this again" checkbox flips the user's
 *     `showGoalTreeWizard` / `showECWizard` preference; future "New X"
 *     commands skip the wizard until the toggle is flipped back in
 *     Settings → Behavior or the user explicitly reopens it via the
 *     palette command "Reopen creation wizard".
 *   - The minimise / expand control collapses the panel to a thin pill
 *     so the user can keep scoping the canvas without losing place.
 *   - The X button on the expanded panel = dismiss this instance
 *     without changing the preference.
 *
 * Per the brief, EC docs already pre-seed the 5 boxes; this wizard
 * fills slot titles via `updateEntity` rather than re-creating them.
 * Goal Tree docs start empty; the wizard creates the Goal entity then
 * adds CSFs + the first NC as the user answers each step.
 */

type StepDef = {
  prompt: string;
  placeholder: string;
};

const GOAL_TREE_STEPS: StepDef[] = [
  {
    prompt: "What is the Goal? One sentence — the system's purpose.",
    placeholder: 'e.g. "Be the customer\'s first choice in our category"',
  },
  {
    prompt: 'First Critical Success Factor — what must hold for the Goal?',
    placeholder: 'e.g. "Customers consistently find what they need"',
  },
  {
    prompt: 'Second Critical Success Factor.',
    placeholder: 'e.g. "Customers trust the experience end-to-end"',
  },
  {
    prompt: 'Third Critical Success Factor.',
    placeholder: 'e.g. "Customers recommend us unprompted"',
  },
  {
    prompt: 'First Necessary Condition — pick any CSF and name a prerequisite.',
    placeholder: 'e.g. "Range covers ≥80% of relevant intent"',
  },
];

const EC_STEPS: StepDef[] = [
  {
    prompt: 'What is the shared objective (A) both sides agree on?',
    placeholder: 'e.g. "Run a sustainable business"',
  },
  {
    prompt: 'Need B — what does the first side need to support A?',
    placeholder: 'e.g. "Hit quarterly revenue targets"',
  },
  {
    prompt: 'Need C — what does the other side need to support A?',
    placeholder: 'e.g. "Sustain product quality"',
  },
  {
    prompt: "Want D — the first side's prerequisite (will conflict with D′).",
    placeholder: 'e.g. "Ship every feature on the roadmap"',
  },
  {
    prompt: "Want D′ — the other side's prerequisite (conflicts with D).",
    placeholder: 'e.g. "Cut the roadmap to half and harden the core"',
  },
];

export function CreationWizardPanel() {
  const state = useDocumentStore((s) => s.creationWizard);
  const advance = useDocumentStore((s) => s.advanceCreationWizardStep);
  const close = useDocumentStore((s) => s.closeCreationWizard);
  const toggleMinimised = useDocumentStore((s) => s.toggleCreationWizardMinimised);
  const setShowGoalTreeWizard = useDocumentStore((s) => s.setShowGoalTreeWizard);
  const setShowECWizard = useDocumentStore((s) => s.setShowECWizard);

  const entities = useDocumentStore((s) => s.doc.entities);
  const addEntity = useDocumentStore((s) => s.addEntity);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const connect = useDocumentStore((s) => s.connect);
  const updateEdge = useDocumentStore((s) => s.updateEdge);

  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset draft on step change. The previous answer is already in the
  // doc, so an empty input prompts the next question cleanly.
  useEffect(() => {
    setDraft('');
    inputRef.current?.focus();
  }, []);

  if (!state) return null;
  const kind = state.kind;
  const steps = kind === 'goalTree' ? GOAL_TREE_STEPS : EC_STEPS;
  const step = state.step;
  const isFinalStep = step >= steps.length - 1;
  const isDone = step >= steps.length;
  const def = steps[Math.min(step, steps.length - 1)]!;

  const handleDontShowAgain = (checked: boolean): void => {
    if (kind === 'goalTree') setShowGoalTreeWizard(!checked);
    else setShowECWizard(!checked);
  };

  const commit = (): void => {
    const text = draft.trim();
    if (text.length === 0) {
      // Empty submit on the first step is a no-op; on later steps it
      // means "skip this question" — still advance.
      if (step > 0) advance();
      return;
    }
    if (kind === 'ec') {
      // EC slot map. The 5 entities are already pre-seeded with
      // `ecSlot` bindings — find the matching one and update its
      // title.
      const slotForStep: Array<'a' | 'b' | 'c' | 'd' | 'dPrime'> = ['a', 'b', 'c', 'd', 'dPrime'];
      const targetSlot = slotForStep[step];
      if (!targetSlot) return;
      const target = Object.values(entities).find((e) => e.ecSlot === targetSlot);
      if (target) updateEntity(target.id, { title: text });
    } else {
      // Goal Tree — step 0 creates the apex `goal`; steps 1-3 each
      // create a CSF connected to the goal (necessity edge); step 4
      // creates one NC connected to the first CSF.
      const existing = (type: Entity['type']) =>
        Object.values(entities).filter((e) => e.type === type);
      if (step === 0) {
        addEntity({ type: 'goal', title: text });
      } else if (step >= 1 && step <= 3) {
        const csf = addEntity({ type: 'criticalSuccessFactor', title: text });
        const goal = existing('goal')[0];
        if (goal) {
          const edge = connect(csf.id, goal.id);
          if (edge) updateEdge(edge.id, { kind: 'necessity' });
        }
      } else if (step === 4) {
        const nc = addEntity({ type: 'necessaryCondition', title: text });
        const csf = existing('criticalSuccessFactor')[0];
        if (csf) {
          const edge = connect(nc.id, csf.id);
          if (edge) updateEdge(edge.id, { kind: 'necessity' });
        }
      }
    }
    setDraft('');
    if (isFinalStep) close();
    else advance();
    inputRef.current?.focus();
  };

  // Minimised pill — small "Continue setup ›" button anchored top-left.
  if (state.minimised) {
    return (
      <button
        type="button"
        onClick={toggleMinimised}
        data-component="creation-wizard-minimised"
        className="absolute left-4 top-14 z-30 flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-md transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        Continue setup ›
      </button>
    );
  }

  // If the wizard finished but the user hasn't dismissed it yet, the
  // dialog renders an inert "all set" state for one click.
  if (isDone) {
    return (
      <div
        data-component="creation-wizard"
        className="absolute left-4 top-14 z-30 flex w-[min(360px,90vw)] flex-col gap-2 rounded-lg border border-emerald-300 bg-white p-3 shadow-lg dark:border-emerald-700 dark:bg-neutral-900"
      >
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          ✓ Wizard complete — keep building from here.
        </p>
        <button
          type="button"
          onClick={close}
          className="self-end rounded px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div
      data-component="creation-wizard"
      className="absolute left-4 top-14 z-30 flex w-[min(380px,92vw)] flex-col gap-2 rounded-lg border border-indigo-200 bg-white p-3 shadow-lg dark:border-indigo-800 dark:bg-neutral-900"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            {kind === 'goalTree' ? 'Goal Tree setup' : 'Evaporating Cloud setup'} · step {step + 1}{' '}
            of {steps.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleMinimised}
            aria-label="Minimise wizard"
            title="Minimise"
            className="rounded p-1 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss wizard"
            title="Skip / dismiss"
            className="rounded p-1 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Per-step progress indicator. A series of dots; current one
          highlighted. Lightweight, no library. */}
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <span
            key={`step-${i}-${kind}`}
            className={clsx(
              'h-1 flex-1 rounded-full',
              i < step
                ? 'bg-indigo-500'
                : i === step
                  ? 'bg-indigo-400'
                  : 'bg-neutral-200 dark:bg-neutral-700'
            )}
          />
        ))}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-700 dark:text-neutral-200">{def.prompt}</span>
        <textarea
          ref={inputRef}
          value={draft}
          rows={2}
          placeholder={def.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            // "Skip step" — advance without committing the draft.
            setDraft('');
            if (isFinalStep) close();
            else advance();
          }}
          className="rounded px-2 py-1 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Skip step
        </button>
        <button
          type="button"
          onClick={commit}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {isFinalStep ? 'Finish' : 'Next ›'}
        </button>
      </div>

      <label className="flex items-center gap-1.5 text-[11px] text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          onChange={(e) => handleDontShowAgain(e.target.checked)}
          className="h-3 w-3"
        />
        Don't show this on new {kind === 'goalTree' ? 'Goal Trees' : 'Evaporating Clouds'}
      </label>
    </div>
  );
}
