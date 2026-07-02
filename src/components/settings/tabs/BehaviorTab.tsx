import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import type { AnimationSpeed } from '@/store';
import { useDocumentStore } from '@/store';
import { RadioGroup, Section, Toggle } from '../formPrimitives';

const SPEED_OPTIONS: { id: AnimationSpeed; label: string; hint?: string }[] = [
  { id: 'instant', label: 'Instant', hint: 'No animation' },
  { id: 'slow', label: 'Slow' },
  // Session 87 (S6) — was "Default" with no explanation. Renamed to
  // "Normal" with a hint that it's the 1× baseline; the actual ms
  // varies per component (the Inspector slide is 120 ms at Normal,
  // other transitions vary). "Slow" / "Fast" multiply this baseline.
  { id: 'default', label: 'Normal', hint: '1× baseline speed' },
  { id: 'fast', label: 'Fast' },
];

/**
 * Session 121 — Behavior tab extracted from `SettingsDialog`. Covers
 * animation speed, Browse Lock, the three creation-wizard toggles, the
 * SelectionToolbar opt-out, and (Session 138) the open-in-new-tab
 * opt-out. All are "what happens when you interact" — grouped on a
 * single tab since Session 87 (S25).
 */
export function BehaviorTab() {
  const {
    animationSpeed,
    browseLocked,
    showGoalTreeWizard,
    showECWizard,
    showCRTWizard,
    showSelectionToolbar,
    openDocsInNewTab,
    setAnimationSpeed,
    setBrowseLocked,
    setShowGoalTreeWizard,
    setShowECWizard,
    setShowCRTWizard,
    setShowSelectionToolbar,
    setOpenDocsInNewTab,
  } = useDocumentStore(
    useShallow((s) => ({
      animationSpeed: s.animationSpeed,
      browseLocked: s.browseLocked,
      showGoalTreeWizard: s.showGoalTreeWizard,
      showECWizard: s.showECWizard,
      showCRTWizard: s.showCRTWizard,
      showSelectionToolbar: s.showSelectionToolbar,
      openDocsInNewTab: s.openDocsInNewTab,
      setAnimationSpeed: s.setAnimationSpeed,
      setBrowseLocked: s.setBrowseLocked,
      setShowGoalTreeWizard: s.setShowGoalTreeWizard,
      setShowECWizard: s.setShowECWizard,
      setShowCRTWizard: s.setShowCRTWizard,
      setShowSelectionToolbar: s.setShowSelectionToolbar,
      setOpenDocsInNewTab: s.setOpenDocsInNewTab,
    }))
  );

  return (
    <Section title="Behavior">
      <Field label="Animation speed" as="group">
        <RadioGroup
          name="animationSpeed"
          value={animationSpeed}
          onChange={setAnimationSpeed}
          options={SPEED_OPTIONS}
        />
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          “Normal” follows your system’s “reduce motion” accessibility setting — enable it in your
          OS and animations are minimised automatically.
        </span>
      </Field>
      <Toggle
        label="Browse Lock"
        hint="Read-only mode — disables editing across the canvas, inspector, and shortcuts"
        checked={browseLocked}
        onChange={setBrowseLocked}
      />
      {/* Session 87 (S5) — the two wizard toggles were standalone
          items in the Behavior section, reading as two unrelated
          prefs. Grouped under a shared "Creation wizards" sub-
          heading so the relationship is visible at a glance. Both
          flags persist independently — power users keep the
          per-diagram override. */}
      <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900/50">
        <span className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
          Creation wizards
        </span>
        <Toggle
          label="Goal Tree"
          hint="Open the guided 5-step panel when you create a new Goal Tree. Off = empty canvas, you build manually."
          checked={showGoalTreeWizard}
          onChange={setShowGoalTreeWizard}
        />
        <Toggle
          label="Evaporating Cloud"
          hint="Open the guided 5-step panel when you create a new EC. Off = the 5 pre-seeded boxes appear ready to edit."
          checked={showECWizard}
          onChange={setShowECWizard}
        />
        <Toggle
          label="Current Reality Tree"
          hint="Open the guided 3-step UDE-elicitation panel when you create a new CRT. Off = empty canvas, you list UDEs manually."
          checked={showCRTWizard}
          onChange={setShowCRTWizard}
        />
      </div>
      {/* Session 95 — SelectionToolbar toggle. Default ON; the
          toolbar is the primary surface for per-selection verbs
          (Add child / Reverse / Group). Disabling keeps the
          palette + context menu as the only access surfaces —
          useful for keyboard-purist users. */}
      <Toggle
        label="Selection toolbar"
        hint="Show a small floating toolbar above the selected entity / edge with the top 3-5 verbs scoped to its kind. Off = palette + context menu only."
        checked={showSelectionToolbar}
        onChange={setShowSelectionToolbar}
      />
      {/* Session 138 (Batch 5.3) — open-in-new-tab toggle. Default ON:
          loading a document (import, pattern, template, example, or a
          shared link) opens it in a new tab and keeps the current one.
          Off restores the pre-tabs behavior — each load replaces the
          active document. */}
      <Toggle
        label="Open documents in new tabs"
        hint="On = importing, loading a pattern / template / example, or opening a shared link opens a new tab. Off = the load replaces the current document."
        checked={openDocsInNewTab}
        onChange={setOpenDocsInNewTab}
      />
    </Section>
  );
}
