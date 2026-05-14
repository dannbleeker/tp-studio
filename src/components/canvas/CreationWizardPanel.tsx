import type { Entity } from '@/domain/types';
import { log } from '@/services/logger';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { ChevronUp, GripVertical, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ECSlotIndicator } from './ECSlotIndicator';

/**
 * Session 87 / EC PPT comparison item #3 — Reverse-direction (D-first)
 * elicitation framing. The canonical BESTSELLER workshop PPT walks
 * practitioners D → D′ → C → B → A (start from the felt conflict, work
 * up to the shared objective). The default A-first walk is more
 * structurally correct; D-first is closer to how a real practitioner
 * *experiences* the conflict.
 *
 * Implemented as a per-wizard-panel toggle that flips the EC step
 * order. The store state still tracks `step` as a 0-based index; the
 * `EC_SLOTS_BY_ORDER` map decides which slot that index addresses.
 */
type WizardOrder = 'aFirst' | 'dFirst';
const EC_SLOTS_BY_ORDER: Record<WizardOrder, Array<'a' | 'b' | 'c' | 'd' | 'dPrime'>> = {
  aFirst: ['a', 'b', 'c', 'd', 'dPrime'],
  dFirst: ['d', 'dPrime', 'c', 'b', 'a'],
};

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

/**
 * EC wizard prompts keyed by slot. The order is decided at render time
 * by `EC_SLOTS_BY_ORDER` so the same definitions back both the A-first
 * and D-first walks.
 */
const EC_STEP_BY_SLOT: Record<'a' | 'b' | 'c' | 'd' | 'dPrime', StepDef> = {
  a: {
    prompt: 'What is the shared objective (A) both sides agree on?',
    placeholder: 'e.g. "Run a sustainable business"',
  },
  b: {
    prompt: 'Need B — what does the first side need to support A?',
    placeholder: 'e.g. "Hit quarterly revenue targets"',
  },
  c: {
    prompt: 'Need C — what does the other side need to support A?',
    placeholder: 'e.g. "Sustain product quality"',
  },
  d: {
    prompt: "Want D — the first side's prerequisite (will conflict with D′).",
    placeholder: 'e.g. "Ship every feature on the roadmap"',
  },
  dPrime: {
    prompt: "Want D′ — the other side's prerequisite (conflicts with D).",
    placeholder: 'e.g. "Cut the roadmap to half and harden the core"',
  },
};
const EC_STEPS: StepDef[] = EC_SLOTS_BY_ORDER.aFirst.map((slot) => EC_STEP_BY_SLOT[slot]);
const EC_STEPS_D_FIRST: StepDef[] = EC_SLOTS_BY_ORDER.dFirst.map((slot) => EC_STEP_BY_SLOT[slot]);

export function CreationWizardPanel() {
  const state = useDocumentStore((s) => s.creationWizard);
  const advance = useDocumentStore((s) => s.advanceCreationWizardStep);
  const close = useDocumentStore((s) => s.closeCreationWizard);
  const toggleMinimised = useDocumentStore((s) => s.toggleCreationWizardMinimised);
  const setPosition = useDocumentStore((s) => s.setCreationWizardPosition);
  const setShowGoalTreeWizard = useDocumentStore((s) => s.setShowGoalTreeWizard);
  const setShowECWizard = useDocumentStore((s) => s.setShowECWizard);

  const entities = useDocumentStore((s) => s.doc.entities);
  const addEntity = useDocumentStore((s) => s.addEntity);
  const updateEntity = useDocumentStore((s) => s.updateEntity);
  const connect = useDocumentStore((s) => s.connect);
  const updateEdge = useDocumentStore((s) => s.updateEdge);

  const [draft, setDraft] = useState('');
  // Session 81 — "Esc-armed" pattern: a non-empty draft + Esc shows a
  // hint instead of closing immediately. A second Esc within ~3s
  // discards the draft and closes the wizard. Prevents losing a long
  // typed answer to a stray Escape press.
  const [escArmed, setEscArmed] = useState(false);
  const [skipNoticeOn, setSkipNoticeOn] = useState(false);
  // Session 87 — EC PPT item #3. Per-wizard-session toggle between the
  // canonical A-first walk and the PPT's D-first ("start from the
  // felt conflict") walk. Local to the panel rather than persisted —
  // the user picks per session; defaults to A-first.
  const [wizardOrder, setWizardOrder] = useState<WizardOrder>('aFirst');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stepKey = state ? `${state.kind}-${state.step}-${wizardOrder}` : null;

  // Reset draft + refocus on every step change (including re-opens via
  // the palette command "Reopen creation wizard"). Depends on stepKey
  // rather than `[]` so the effect actually runs when the user advances
  // — the previous `[]` made it a mount-only effect that left stale
  // state when the wizard cycled through steps in the same session.
  useEffect(() => {
    if (!stepKey) return;
    setDraft('');
    setEscArmed(false);
    setSkipNoticeOn(false);
    inputRef.current?.focus();
  }, [stepKey]);

  // Auto-disarm Esc + auto-hide the skip notice after ~2.5s so the
  // hints don't linger forever.
  useEffect(() => {
    if (!escArmed) return;
    const id = window.setTimeout(() => setEscArmed(false), 2500);
    return () => window.clearTimeout(id);
  }, [escArmed]);
  useEffect(() => {
    if (!skipNoticeOn) return;
    const id = window.setTimeout(() => setSkipNoticeOn(false), 2500);
    return () => window.clearTimeout(id);
  }, [skipNoticeOn]);

  // Session 88 (S18) — drag-to-reposition. The header band is a drag
  // handle: pointerdown on it (but NOT on the minimise / dismiss
  // buttons) begins a drag; pointermove updates the live x/y in
  // local state; pointerup commits to the store. We track the drag
  // origin offset so the cursor stays anchored to the header point
  // the user grabbed, not the panel's top-left corner.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; live: { x: number; y: number } } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  /** Clamp a position so the panel stays mostly on-screen. We keep
   *  ~40 px of the header visible on every side so the user can
   *  always grab it back. The `h` parameter is unused at present —
   *  the vertical clamp uses a fixed pixel margin against viewport
   *  height — but kept in the signature so a future tweak (e.g.
   *  "don't let the panel disappear below the fold") can use it
   *  without changing the call-sites. */
  const clampToViewport = useCallback((x: number, y: number, w: number, _h: number) => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    const minVisible = 40;
    const cx = Math.max(minVisible - w, Math.min(vw - minVisible, x));
    const cy = Math.max(0, Math.min(vh - minVisible, y));
    return { x: cx, y: cy };
  }, []);

  const onHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only respond to primary-button pointer drags on the header
    // SURFACE itself — clicks that started on an inner button
    // (minimise / dismiss) should reach those handlers, not start
    // a drag. closest('button') is the cheapest way to filter.
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      live: { x: rect.left, y: rect.top },
    };
    setDragPos({ x: rect.left, y: rect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel) return;
    const rect = panel.getBoundingClientRect();
    const next = clampToViewport(e.clientX - drag.dx, e.clientY - drag.dy, rect.width, rect.height);
    drag.live = next;
    setDragPos(next);
  };

  const onHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPosition(drag.live.x, drag.live.y);
    dragRef.current = null;
    setDragPos(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (!state) return null;
  const kind = state.kind;
  const steps =
    kind === 'goalTree' ? GOAL_TREE_STEPS : wizardOrder === 'dFirst' ? EC_STEPS_D_FIRST : EC_STEPS;
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
      // means "skip this question" — still advance, with a brief
      // inline notice so the user knows the skip was intentional.
      if (step > 0) {
        setSkipNoticeOn(true);
        advance();
      }
      return;
    }
    if (kind === 'ec') {
      // EC slot map. The 5 entities are already pre-seeded with
      // `ecSlot` bindings — find the matching one and update its
      // title. Session 87: the slot at step N depends on the chosen
      // wizard order (A-first vs. D-first).
      const targetSlot = EC_SLOTS_BY_ORDER[wizardOrder][step];
      if (!targetSlot) return;
      const target = Object.values(entities).find((e) => e.ecSlot === targetSlot);
      if (target) {
        updateEntity(target.id, { title: text });
      } else {
        // Pre-seed missing this slot — shouldn't happen for a doc
        // created via `newDocument('ec')`, but a hand-edited /
        // imported EC might be incomplete. Log so it shows up in
        // diagnostics rather than vanishing silently.
        log.warn('ec-wizard-missing-slot', { targetSlot, step });
      }
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
        className="absolute top-14 left-4 z-30 flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 text-xs shadow-md transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
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
        className="absolute top-14 left-4 z-30 flex w-[min(360px,90vw)] flex-col gap-2 rounded-lg border border-emerald-300 bg-white p-3 shadow-lg dark:border-emerald-700 dark:bg-neutral-900"
      >
        <p className="font-medium text-emerald-700 text-sm dark:text-emerald-300">
          ✓ Wizard complete — keep building from here.
        </p>
        <button
          type="button"
          onClick={close}
          className="self-end rounded px-2 py-1 font-medium text-neutral-700 text-xs hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Done
        </button>
      </div>
    );
  }

  // Session 88 (S18) — resolved position. Live drag overrides
  // committed; committed (`state.x` / `state.y`) overrides default.
  // Default = no inline style → Tailwind's `top-14 left-4` applies.
  const positioned =
    dragPos !== null
      ? { left: dragPos.x, top: dragPos.y }
      : state.x !== null && state.y !== null
        ? { left: state.x, top: state.y }
        : null;
  return (
    <section
      ref={panelRef}
      data-component="creation-wizard"
      aria-label={`${kind === 'goalTree' ? 'Goal Tree' : 'Evaporating Cloud'} creation wizard`}
      className={clsx(
        'absolute z-30 flex w-[min(380px,92vw)] flex-col gap-2 rounded-lg border border-indigo-200 bg-white p-3 shadow-lg dark:border-indigo-800 dark:bg-neutral-900',
        positioned === null && 'top-14 left-4'
      )}
      style={positioned ?? undefined}
    >
      {/* Session 88 (S18) — drag handle = the whole header band.
          Inner buttons short-circuit the drag via the `closest`
          check in `onHeaderPointerDown`. cursor-grab visually
          advertises the affordance. */}
      <header
        className="flex cursor-grab select-none items-center justify-between gap-2 active:cursor-grabbing"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3 w-3 text-neutral-400 dark:text-neutral-500" aria-hidden />
          <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden />
          <span
            className="font-semibold text-[11px] text-indigo-700 uppercase tracking-wide dark:text-indigo-300"
            aria-live="polite"
            aria-atomic="true"
          >
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

      {/* Session 87 / EC PPT item #3 — wizard direction toggle. Only
          visible on EC wizards; flips between the structural A-first
          walk and the practitioner-experiential D-first walk. The
          toggle resets the step to 0 so the prompt at index 0 lines
          up with the new lead slot. */}
      {kind === 'ec' && (
        <div
          data-component="ec-wizard-order"
          aria-label="Wizard walk order"
          className="flex gap-1 text-[10px]"
        >
          {(
            [
              { id: 'aFirst' as const, label: 'A → D′ (top-down)' },
              { id: 'dFirst' as const, label: 'D → A (from the conflict)' },
            ] satisfies { id: WizardOrder; label: string }[]
          ).map((opt) => {
            const active = wizardOrder === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (wizardOrder === opt.id) return;
                  setWizardOrder(opt.id);
                  // We don't rewind `state.step` — the user keeps their
                  // place and the prompt at that index simply reflects
                  // the new order. Fine for a single-action-per-step
                  // wizard; any missed slot can be filled directly on
                  // the canvas later.
                }}
                className={clsx(
                  'flex-1 rounded border px-1.5 py-0.5 font-medium transition',
                  active
                    ? 'border-indigo-400 bg-indigo-100 text-indigo-800 dark:border-indigo-500 dark:bg-indigo-900 dark:text-indigo-200'
                    : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

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

      {/* Session 93 / EC PPT comparison #32 — visual slot indicator.
          The prompt text mentions the slot letter ("Need B"); the
          indicator shows WHICH of the canonical 5-box positions
          that letter is, so a first-time EC user can map the
          question onto the geometry. Pairs with the per-slot
          guiding questions (Session 87) and the EC reading guide
          (Session 88) — three different surfaces reinforcing the
          same conceptual shape. */}
      {kind === 'ec' && (
        <div className="flex justify-center text-indigo-600 dark:text-indigo-300">
          <ECSlotIndicator targetSlot={EC_SLOTS_BY_ORDER[wizardOrder][step] ?? null} />
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-neutral-700 text-xs dark:text-neutral-200">{def.prompt}</span>
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
              // Non-empty draft + first Esc → arm the discard
              // confirmation. Second Esc within 2.5s closes for real.
              // Empty draft → just close.
              if (draft.trim().length > 0 && !escArmed) {
                setEscArmed(true);
              } else {
                close();
              }
            }
          }}
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
        />
        <p className="text-[10px] text-neutral-500 italic dark:text-neutral-400">
          Enter to commit · Shift+Enter for a newline · Esc to dismiss
        </p>
      </label>

      {/* Esc-armed hint — surfaces briefly when the user hits Esc with
          a non-empty draft. Second Esc within ~2.5s actually closes. */}
      {escArmed && (
        <output
          aria-live="polite"
          className="block rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          Press Esc again to discard this draft and close the wizard.
        </output>
      )}
      {skipNoticeOn && (
        <output
          aria-live="polite"
          className="block rounded border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
        >
          Step skipped — you can fill it in directly on the canvas later.
        </output>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            // "Skip step" — advance without committing the draft.
            setDraft('');
            if (isFinalStep) close();
            else {
              setSkipNoticeOn(true);
              advance();
            }
          }}
          className="rounded px-2 py-1 font-medium text-neutral-600 text-xs transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Skip step
        </button>
        <button
          type="button"
          onClick={commit}
          className="rounded-md bg-indigo-600 px-3 py-1.5 font-semibold text-white text-xs transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
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
    </section>
  );
}
