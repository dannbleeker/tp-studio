import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import { useT } from '@/i18n/useT';
import type { AnimationSpeed } from '@/store';
import { useDocumentStore } from '@/store';
import { RadioGroup, Section, Toggle } from '../formPrimitives';

/**
 * Session 121 — Behavior tab extracted from `SettingsDialog`. Covers
 * animation speed, Browse Lock, the three creation-wizard toggles, the
 * SelectionToolbar opt-out, and (Session 138) the open-in-new-tab
 * opt-out. All are "what happens when you interact" — grouped on a
 * single tab since Session 87 (S25).
 */
export function BehaviorTab() {
  const t = useT();
  const {
    animationSpeed,
    browseLocked,
    showGoalTreeWizard,
    showECWizard,
    showCRTWizard,
    showSelectionToolbar,
    openDocsInNewTab,
    autoSnapshot,
    setAnimationSpeed,
    setBrowseLocked,
    setShowGoalTreeWizard,
    setShowECWizard,
    setShowCRTWizard,
    setShowSelectionToolbar,
    setOpenDocsInNewTab,
    setAutoSnapshot,
  } = useDocumentStore(
    useShallow((s) => ({
      animationSpeed: s.animationSpeed,
      browseLocked: s.browseLocked,
      showGoalTreeWizard: s.showGoalTreeWizard,
      showECWizard: s.showECWizard,
      showCRTWizard: s.showCRTWizard,
      showSelectionToolbar: s.showSelectionToolbar,
      openDocsInNewTab: s.openDocsInNewTab,
      autoSnapshot: s.autoSnapshot,
      setAnimationSpeed: s.setAnimationSpeed,
      setBrowseLocked: s.setBrowseLocked,
      setShowGoalTreeWizard: s.setShowGoalTreeWizard,
      setShowECWizard: s.setShowECWizard,
      setShowCRTWizard: s.setShowCRTWizard,
      setShowSelectionToolbar: s.setShowSelectionToolbar,
      setOpenDocsInNewTab: s.setOpenDocsInNewTab,
      setAutoSnapshot: s.setAutoSnapshot,
    }))
  );

  const b = t.settings.behavior;
  // Session 87 (S6) — "Normal" rather than "Default", with a hint that it is
  // the 1× baseline; the actual ms varies per component. "Slow" / "Fast"
  // multiply that baseline.
  const speedOptions: { id: AnimationSpeed; label: string; hint?: string }[] = [
    { id: 'instant', label: b.speeds.instant, hint: b.speeds.instantHint },
    { id: 'slow', label: b.speeds.slow },
    { id: 'default', label: b.speeds.default, hint: b.speeds.defaultHint },
    { id: 'fast', label: b.speeds.fast },
  ];

  return (
    <Section title={b.section}>
      <Field label={b.animationSpeed} as="group">
        <RadioGroup
          name="animationSpeed"
          value={animationSpeed}
          onChange={setAnimationSpeed}
          options={speedOptions}
        />
        <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {b.animationSpeedNote}
        </span>
      </Field>
      <Toggle
        label={b.browseLock}
        hint={b.browseLockHint}
        checked={browseLocked}
        onChange={setBrowseLocked}
      />
      <Toggle
        label={b.autoSnapshot}
        hint={b.autoSnapshotHint}
        checked={autoSnapshot}
        onChange={setAutoSnapshot}
      />
      {/* Session 87 (S5) — the two wizard toggles were standalone
          items in the Behavior section, reading as two unrelated
          prefs. Grouped under a shared "Creation wizards" sub-
          heading so the relationship is visible at a glance. Both
          flags persist independently — power users keep the
          per-diagram override. */}
      <div className="flex flex-col gap-1.5 rounded-md border border-neutral-200 bg-neutral-50/50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900/50">
        <span className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
          {b.creationWizards}
        </span>
        <Toggle
          label={b.goalTreeWizard}
          hint={b.goalTreeWizardHint}
          checked={showGoalTreeWizard}
          onChange={setShowGoalTreeWizard}
        />
        <Toggle
          label={b.ecWizard}
          hint={b.ecWizardHint}
          checked={showECWizard}
          onChange={setShowECWizard}
        />
        <Toggle
          label={b.crtWizard}
          hint={b.crtWizardHint}
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
        label={b.selectionToolbar}
        hint={b.selectionToolbarHint}
        checked={showSelectionToolbar}
        onChange={setShowSelectionToolbar}
      />
      {/* Session 138 (Batch 5.3) — open-in-new-tab toggle. Default ON:
          loading a document (import, pattern, template, example, or a
          shared link) opens it in a new tab and keeps the current one.
          Off restores the pre-tabs behavior — each load replaces the
          active document. */}
      <Toggle
        label={b.openDocsInNewTab}
        hint={b.openDocsInNewTabHint}
        checked={openDocsInNewTab}
        onChange={setOpenDocsInNewTab}
      />
    </Section>
  );
}
