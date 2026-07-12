import clsx from 'clsx';
import { ChevronUp, GripVertical, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { CLOUD_TYPE_LABEL, CLOUD_TYPES } from '@/domain/cloudType';
import {
  EC_CLOUD_TYPE_BREAK_HINT,
  EC_CLOUD_TYPE_ORDER,
  EC_SLOTS_BY_ORDER,
  type ECSlot,
  type ECWizardMode,
  type WizardOrder,
} from '@/domain/ecGuiding';
import { entitiesOfType } from '@/domain/graph';
import type { Entity } from '@/domain/types';
import { log } from '@/services/logger';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { ECSlotIndicator } from '../overlays/ECSlotIndicator';
import {
  CRT_STEPS,
  EC_STEPS,
  EC_STEPS_BY_CLOUD_TYPE,
  EC_STEPS_D_FIRST,
  GOAL_TREE_STEPS,
  type StepDef,
} from './creationWizardSteps';
import { useDraggablePanel } from './useDraggablePanel';

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
 *
 * Session 94 (Top-30 #17) — `WizardOrder` + `EC_SLOTS_BY_ORDER` moved
 * to `@/domain/ecGuiding` so the slot identity has a single source
 * across the canvas, the inspector, the wizard, and the workshop-
 * sheet PDF.
 */

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

// Step definitions extracted to `./creationWizardSteps.ts` (Session 115
// Tier-2 #4 structural refactor). Imported above.

export function CreationWizardPanel() {
  // Session 94 (Top-30 #2) — consolidated 12 individual subscriptions
  // into one `useShallow` selector. Each individual `useDocumentStore`
  // re-fired on any store mutation, including unrelated entity title
  // edits, causing the wizard panel + its effects to re-run more often
  // than needed. The shallow-equal selector now batches reads so the
  // component only re-renders when a member of the returned record
  // actually changes.
  const {
    state,
    advance,
    close,
    toggleMinimised,
    setPosition,
    setShowGoalTreeWizard,
    setShowECWizard,
    setShowCRTWizard,
    setCloudType,
    setDocumentMeta,
    description,
    cloudType,
    docId,
    entities,
    addEntity,
    updateEntity,
    connect,
    updateEdge,
  } = useDocumentStore(
    useShallow((s) => ({
      state: s.creationWizard,
      advance: s.advanceCreationWizardStep,
      close: s.closeCreationWizard,
      toggleMinimised: s.toggleCreationWizardMinimised,
      setPosition: s.setCreationWizardPosition,
      setShowGoalTreeWizard: s.setShowGoalTreeWizard,
      setShowECWizard: s.setShowECWizard,
      setShowCRTWizard: s.setShowCRTWizard,
      setCloudType: s.setCloudType,
      setDocumentMeta: s.setDocumentMeta,
      description: currentDoc(s).description,
      cloudType: currentDoc(s).cloudType,
      docId: currentDoc(s).id,
      entities: currentDoc(s).entities,
      addEntity: s.addEntity,
      updateEntity: s.updateEntity,
      connect: s.connect,
      updateEdge: s.updateEdge,
    }))
  );

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
  // Session 197 (D1) — optional cloud-type mode for the EC wizard. `'generic'`
  // (the default) preserves the shipped A-first/D-first behaviour exactly and
  // never sets `doc.cloudType`; picking a type switches the walk order + prompts
  // to Cohen's per-type recipe.
  const [mode, setMode] = useState<ECWizardMode>('generic');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const stepKey = state ? `${state.kind}-${state.step}-${mode}-${wizardOrder}` : null;

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

  // Session 198 (review follow-up) — `mode` + `wizardOrder` are per-session UI
  // state on a component that never unmounts (it only returns null while
  // closed). Without this, a cloud type or D-first walk chosen in one wizard
  // session would leak into the NEXT session on a different document, quietly
  // breaking the D1 invariant that a fresh EC wizard is the generic default.
  // Reset both whenever a new session begins — tracked by the target doc's id,
  // so a close→reopen or a switch to another doc both re-seed. `mode` re-seeds
  // from the doc's own `cloudType` (undefined ⇒ 'generic'), so reopening the
  // wizard on an already-typed doc reflects it rather than snapping to generic.
  const sessionDocRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state) {
      sessionDocRef.current = null;
      return;
    }
    if (sessionDocRef.current !== docId) {
      sessionDocRef.current = docId;
      setMode(cloudType ?? 'generic');
      setWizardOrder('aFirst');
    }
  }, [state, docId, cloudType]);

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

  // Session 88 (S18) — drag-to-reposition via the header band. The
  // mechanics (grab-offset tracking, viewport clamp, commit-on-up)
  // live in `useDraggablePanel` (Session 135 file split).
  const { panelRef, dragHandlers, positioned } = useDraggablePanel({
    committed: state && state.x !== null && state.y !== null ? { x: state.x, y: state.y } : null,
    onCommit: setPosition,
  });

  if (!state) return null;
  const kind = state.kind;
  // EC-only: the active slot order + step prompts depend on the chosen mode.
  // `'generic'` reuses the shipped A-first/D-first constants byte-for-byte; a
  // cloud type uses Cohen's per-type order + prompts (Session 197 / D1).
  const ecSlotOrder: readonly ECSlot[] =
    mode === 'generic' ? EC_SLOTS_BY_ORDER[wizardOrder] : EC_CLOUD_TYPE_ORDER[mode];
  const ecSteps: StepDef[] =
    mode === 'generic'
      ? wizardOrder === 'dFirst'
        ? EC_STEPS_D_FIRST
        : EC_STEPS
      : EC_CLOUD_TYPE_ORDER[mode].map((slot) => EC_STEPS_BY_CLOUD_TYPE[mode][slot]);
  const steps = kind === 'goalTree' ? GOAL_TREE_STEPS : kind === 'crt' ? CRT_STEPS : ecSteps;
  const step = state.step;
  const isFinalStep = step >= steps.length - 1;
  const isDone = step >= steps.length;
  const def = steps[Math.min(step, steps.length - 1)]!;

  const handleDontShowAgain = (checked: boolean): void => {
    if (kind === 'goalTree') setShowGoalTreeWizard(!checked);
    else if (kind === 'crt') setShowCRTWizard(!checked);
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
      const targetSlot = ecSlotOrder[step];
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
    } else if (kind === 'crt') {
      // Session 136 — CRT wizard. Each of the 3 steps mints a UDE
      // entity. The wizard intentionally stops there — building the
      // causal chain back to a root cause is the user's work (per
      // Goldratt: UDE list first, connections afterwards). No edges
      // created from the wizard; the user wires them by hand once
      // the symptom layer is captured.
      addEntity({ type: 'ude', title: text });
    } else {
      // Goal Tree — step 0 creates the apex `goal`; steps 1-3 each
      // create a CSF connected to the goal (necessity edge); step 4
      // creates one NC connected to the first CSF. `entitiesOfType`
      // reads through the per-doc by-type index (cheap) instead of
      // filtering the full entities map on each lookup.
      const existing = (type: Entity['type']) =>
        entitiesOfType(currentDoc(useDocumentStore.getState()), type);
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
        className="absolute top-2 left-4 z-30 flex items-center gap-1.5 rounded-full border border-accent-300 bg-accent-50 px-3 py-1.5 font-medium text-accent-700 text-xs shadow-md transition hover:bg-accent-100 dark:border-accent-700 dark:bg-accent-950 dark:text-accent-200 dark:hover:bg-accent-900"
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
        className="absolute top-2 left-4 z-30 flex w-[min(360px,90vw)] flex-col gap-2 rounded-lg border border-emerald-300 bg-white p-3 shadow-lg dark:border-emerald-700 dark:bg-neutral-900"
      >
        <p className="font-medium text-emerald-700 text-sm dark:text-emerald-300">
          ✓ Wizard complete — keep building from here.
        </p>
        {mode !== 'generic' && (
          <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
            {EC_CLOUD_TYPE_BREAK_HINT[mode]}
          </p>
        )}
        <button
          type="button"
          onClick={close}
          className="self-end rounded-sm px-2 py-1 font-medium text-neutral-700 text-xs hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Done
        </button>
      </div>
    );
  }

  // Session 88 (S18) — resolved position from `useDraggablePanel`.
  // `null` = no inline style → Tailwind's `top-2 left-4` default.
  return (
    <section
      ref={panelRef}
      data-component="creation-wizard"
      aria-label={`${kind === 'goalTree' ? 'Goal Tree' : kind === 'crt' ? 'Current Reality Tree' : 'Evaporating Cloud'} creation wizard`}
      className={clsx(
        'absolute z-30 flex w-[min(380px,92vw)] flex-col gap-2 rounded-lg border border-accent-200 bg-white p-3 shadow-lg dark:border-accent-800 dark:bg-neutral-900',
        positioned === null && 'top-2 left-4'
      )}
      style={positioned ?? undefined}
    >
      {/* Session 88 (S18) — drag handle = the whole header band.
          Inner buttons short-circuit the drag via the `closest`
          check in the hook. cursor-grab advertises the affordance. */}
      <header
        className="flex cursor-grab select-none items-center justify-between gap-2 active:cursor-grabbing"
        {...dragHandlers}
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-3 w-3 text-neutral-400 dark:text-neutral-500" aria-hidden />
          <Sparkles className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400" aria-hidden />
          <span
            className="font-semibold text-[11px] text-accent-700 uppercase tracking-wide dark:text-accent-300"
            aria-live="polite"
            aria-atomic="true"
          >
            {kind === 'goalTree'
              ? 'Goal Tree setup'
              : kind === 'crt'
                ? 'Current Reality Tree setup'
                : 'Evaporating Cloud setup'}{' '}
            · step {step + 1} of {steps.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={toggleMinimised}
            aria-label="Minimise wizard"
            title="Minimise"
            className="rounded-sm p-1 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss wizard"
            title="Skip / dismiss"
            className="rounded-sm p-1 text-neutral-500 transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
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
        <div className="flex flex-col gap-1.5">
          {/* Session 197 (D1) — optional cloud-type selector. Left at
              "Generic (default)" it changes nothing; picking a type switches
              the wizard to Cohen's per-type walk + prompts and tags the doc. */}
          <label
            data-component="ec-wizard-cloud-type"
            className="flex items-center gap-1.5 text-[10px] text-neutral-600 dark:text-neutral-300"
          >
            <span className="shrink-0 font-medium">Cloud type</span>
            <select
              aria-label="Cloud type"
              value={mode}
              onChange={(e) => {
                const next = e.target.value as ECWizardMode;
                setMode(next);
                setCloudType(next === 'generic' ? undefined : next);
              }}
              className="min-w-0 flex-1 rounded-xs border border-neutral-200 bg-white px-1 py-0.5 text-neutral-700 outline-hidden focus:border-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            >
              <option value="generic">Generic (default)</option>
              {CLOUD_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {CLOUD_TYPE_LABEL[ct]}
                </option>
              ))}
            </select>
          </label>

          {/* Walk-order toggle — only in generic mode; a chosen cloud type
              prescribes its own order (Cohen's tables), so the toggle hides. */}
          {mode === 'generic' && (
            <fieldset
              data-component="ec-wizard-order"
              aria-label="Wizard walk order"
              className="flex gap-1 border-0 p-0 text-[10px]"
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
                      // We don't rewind `state.step` — the user keeps their place
                      // and the prompt at that index reflects the new order.
                      setWizardOrder(opt.id);
                    }}
                    className={clsx(
                      'flex-1 rounded-xs border px-1.5 py-0.5 font-medium transition',
                      active
                        ? 'border-accent-400 bg-accent-100 text-accent-800 dark:border-accent-500 dark:bg-accent-900 dark:text-accent-200'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </fieldset>
          )}

          {/* Cohen's best-arrow-to-break recommendation for the chosen type. */}
          {mode !== 'generic' && (
            <p
              data-component="ec-wizard-break-hint"
              className="rounded-xs bg-accent-50 px-1.5 py-0.5 text-[10px] text-accent-700 dark:bg-accent-950 dark:text-accent-300"
            >
              {EC_CLOUD_TYPE_BREAK_HINT[mode]}
            </p>
          )}
        </div>
      )}

      {/* Per-step progress indicator. A series of dots; current one
          highlighted. Lightweight, no library. */}
      {/* `steps` is a fixed-length per-wizard-kind constant (5–6 entries — see
          creationWizardSteps.ts). Items never reorder, so the index IS the stable
          identity within a given wizard kind; including `kind` in the key forces
          a full remount when the diagram type switches. */}
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: see comment above the map.
            key={`step-${i}-${kind}`}
            className={clsx(
              'h-1 flex-1 rounded-full',
              i < step
                ? 'bg-accent-500'
                : i === step
                  ? 'bg-accent-400'
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
        <div className="flex justify-center text-accent-600 dark:text-accent-300">
          <ECSlotIndicator targetSlot={ecSlotOrder[step] ?? null} />
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
          className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-sm outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
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
          className="block rounded-sm border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
        >
          Press Esc again to discard this draft and close the wizard.
        </output>
      )}
      {skipNoticeOn && (
        <output
          aria-live="polite"
          className="block rounded-sm border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
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
          className="rounded-sm px-2 py-1 font-medium text-neutral-600 text-xs transition hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
        >
          Skip step
        </button>
        <button
          type="button"
          onClick={commit}
          className="rounded-md bg-accent-600 px-3 py-1.5 font-semibold text-white text-xs transition hover:bg-accent-700 disabled:opacity-50 dark:bg-accent-500 dark:hover:bg-accent-400"
        >
          {isFinalStep ? 'Finish' : 'Next ›'}
        </button>
      </div>

      {/* Session 198 (D2) — optional storyline pre-step. Cohen's step 2: write
          the incident factually, as an objective report, to unleash the
          intuition and gather the raw material before (or alongside) filling
          the boxes. Default-collapsed <details> so the wizard is unchanged
          unless opened; saved to the document's description. */}
      {kind === 'ec' && (
        <details
          data-component="ec-wizard-storyline"
          className="rounded-md border border-neutral-200 text-[11px] dark:border-neutral-800"
        >
          <summary className="cursor-pointer select-none px-2 py-1 text-neutral-600 dark:text-neutral-300">
            Storyline (optional) — write the incident first
          </summary>
          <div className="px-2 pb-2">
            <textarea
              aria-label="Storyline"
              value={description ?? ''}
              rows={3}
              placeholder="Who / what / when / where? What did I want to do? Why? What did I feel forced to do? Why?"
              onChange={(e) => setDocumentMeta({ description: e.target.value })}
              className="w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-neutral-900 text-xs outline-hidden focus:border-accent-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
            />
            <p className="mt-1 text-[10px] text-neutral-500 italic dark:text-neutral-400">
              An objective incident report to gather the raw material for the boxes. Saved to the
              document's description.
            </p>
          </div>
        </details>
      )}

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
