import { Field } from '@/components/inspector/Field';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LAYOUT_NODE_SEPARATION, LAYOUT_RANK_SEPARATION } from '@/domain/constants';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import type { LayoutConfig } from '@/domain/types';
import type {
  AnimationSpeed,
  CausalityLabel,
  DefaultLayoutDirection,
  EdgePalette,
  Theme,
} from '@/store';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { RadioGroup, Section, Slider, Toggle } from './formPrimitives';

/** Session 87 (S25) — Settings is now tabbed. Single-scroll layout
 *  grew past ~15 controls; jumping to a setting required scanning
 *  the whole dialog. Four tabs match the existing section titles. */
type SettingsTab = 'appearance' | 'behavior' | 'display' | 'layout';
const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'behavior', label: 'Behavior' },
  { id: 'display', label: 'Display' },
  { id: 'layout', label: 'Layout' },
];

/**
 * Session 88 (S11) — theme picker as a swatch grid. Each swatch
 * previews the theme's primary surface colour + accent stripe so the
 * user can pre-scan visual identity instead of clicking 7 radios to
 * inspect. Colours mirror the actual CSS variables each theme sets
 * (see `src/styles/themes.css`); kept here as literals so the
 * Settings dialog stays framework-free.
 *
 * The `Theme` union itself is unchanged — this is purely a
 * presentation swap inside the dialog.
 */
type ThemeOption = {
  id: Theme;
  label: string;
  hint?: string;
  /** Surface (background) hex used for the swatch preview. */
  surface: string;
  /** Accent (stripe) hex matching the theme's indigo/violet accent. */
  accent: string;
};
const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', surface: '#ffffff', accent: '#6366f1' },
  { id: 'dark', label: 'Dark', surface: '#0a0a0a', accent: '#818cf8' },
  {
    id: 'highContrast',
    label: 'High contrast',
    hint: 'Maximizes legibility',
    surface: '#ffffff',
    accent: '#000000',
  },
  {
    id: 'rust',
    label: 'Rust',
    hint: 'Warm dark, ember tones',
    surface: '#1c1310',
    accent: '#f97316',
  },
  {
    id: 'coal',
    label: 'Coal',
    hint: 'Near-black, blue tint',
    surface: '#0d1117',
    accent: '#58a6ff',
  },
  { id: 'navy', label: 'Navy', hint: 'Deep blue dark mode', surface: '#0b1733', accent: '#8b5cf6' },
  {
    id: 'ayu',
    label: 'Ayu',
    hint: 'Warm dark, golden accents',
    surface: '#1f2430',
    accent: '#ffcc66',
  },
];

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

const PALETTE_OPTIONS: { id: EdgePalette; label: string; hint?: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'colorblindSafe', label: 'Colorblind-safe', hint: 'Wong palette' },
  { id: 'mono', label: 'Monochrome' },
];

const CAUSALITY_OPTIONS: { id: CausalityLabel; label: string; hint?: string }[] = [
  { id: 'none', label: 'None', hint: 'No fallback label' },
  { id: 'auto', label: 'Auto', hint: 'CRT/FRT/TT → "because", PRT/EC → "in order to"' },
  { id: 'because', label: 'Because', hint: 'Sufficient-cause read, bottom-up' },
  { id: 'therefore', label: 'Therefore', hint: 'Sufficient-cause read, top-down' },
  { id: 'in-order-to', label: 'In order to', hint: 'Necessary-condition read (PRT/EC)' },
];

/** FL-TO3 — Default layout direction for *new* documents (existing docs
 *  keep their own per-doc `layoutConfig`). Auto = use the diagram type's
 *  natural default. Session 88 audit (S12 candidate) — labels were
 *  already long-form ("Bottom → Top"); the two-letter codes only live
 *  in `id`. No change needed. */
const DEFAULT_DIRECTION_OPTIONS: {
  id: DefaultLayoutDirection;
  label: string;
  hint?: string;
}[] = [
  { id: 'auto', label: 'Auto', hint: 'Each diagram type picks its own default' },
  { id: 'BT', label: 'Bottom → Top', hint: 'CRT / FRT default' },
  { id: 'TB', label: 'Top → Bottom' },
  { id: 'LR', label: 'Left → Right' },
  { id: 'RL', label: 'Right → Left' },
];

/**
 * Block A — Layout direction options for the Settings radio group. The
 * label captures the read direction (e.g. "Bottom → Top" for `BT` means
 * causes at the bottom, effects above — the conventional CRT shape).
 */
type LayoutDirectionId = NonNullable<LayoutConfig['direction']>;
const DIRECTION_OPTIONS: { id: LayoutDirectionId; label: string; hint?: string }[] = [
  { id: 'BT', label: 'Bottom → Top', hint: 'Default for CRT / FRT' },
  { id: 'TB', label: 'Top → Bottom', hint: 'Goal at top' },
  { id: 'LR', label: 'Left → Right' },
  { id: 'RL', label: 'Right → Left' },
];

/**
 * Bias options. `'auto'` is the sentinel for "don't pass `align` to dagre"
 * — dagre's own balancing kicks in. UL / UR / DL / DR shift the diagonal
 * preference of multi-parent placements; useful when a graph has a strong
 * primary axis the user wants emphasized.
 */
type BiasId = 'auto' | NonNullable<LayoutConfig['align']>;
const BIAS_OPTIONS: { id: BiasId; label: string; hint?: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Dagre balances' },
  { id: 'UL', label: 'Upper-left' },
  { id: 'UR', label: 'Upper-right' },
  { id: 'DL', label: 'Lower-left' },
  { id: 'DR', label: 'Lower-right' },
];

/**
 * Compactness slider conversion. The slider runs 0 → 100; 50 maps to the
 * exact app defaults (`LAYOUT_RANK_SEPARATION`, `LAYOUT_NODE_SEPARATION`);
 * each side scales exponentially via `factor = 2^((slider − 50) / 50)` so
 * 0 is half-spacing and 100 is double-spacing. Symmetric exponential
 * keeps the visual change at each end feel even rather than dragging
 * through a long flat patch in the middle.
 */
const sliderToCompactness = (slider: number): { nodesep: number; ranksep: number } => {
  const factor = 2 ** ((slider - 50) / 50);
  return {
    nodesep: Math.round(LAYOUT_NODE_SEPARATION * factor),
    ranksep: Math.round(LAYOUT_RANK_SEPARATION * factor),
  };
};

/**
 * Inverse: read the slider position from the stored `ranksep` (we anchor
 * on ranksep — nodesep would give the same answer because they scale
 * together). Clamped to 0..100 so an out-of-band number imported from a
 * future feature doesn't push the thumb off the track.
 */
const compactnessToSlider = (cfg: LayoutConfig | undefined): number => {
  const ranksep = cfg?.ranksep ?? LAYOUT_RANK_SEPARATION;
  const slider = Math.round(50 + 50 * Math.log2(ranksep / LAYOUT_RANK_SEPARATION));
  return Math.max(0, Math.min(100, slider));
};

const hasLayoutOverride = (cfg: LayoutConfig | undefined): boolean =>
  Boolean(cfg && Object.keys(cfg).length > 0);

export function SettingsDialog() {
  const open = useDocumentStore((s) => s.settingsOpen);
  const close = useDocumentStore((s) => s.closeSettings);

  const {
    theme,
    animationSpeed,
    edgePalette,
    browseLocked,
    showAnnotationNumbers,
    showEntityIds,
    showReachBadges,
    showReverseReachBadges,
    showMinimap,
    printInkSaver,
    causalityLabel,
    defaultLayoutDirection,
    diagramType,
    layoutConfig,
    setTheme,
    setAnimationSpeed,
    setEdgePalette,
    setBrowseLocked,
    setShowAnnotationNumbers,
    setShowEntityIds,
    setShowReachBadges,
    setShowReverseReachBadges,
    setShowMinimap,
    setPrintInkSaver,
    setCausalityLabel,
    setDefaultLayoutDirection,
    setLayoutConfig,
    showGoalTreeWizard,
    showECWizard,
    setShowGoalTreeWizard,
    setShowECWizard,
  } = useDocumentStore(
    useShallow((s) => ({
      theme: s.theme,
      animationSpeed: s.animationSpeed,
      edgePalette: s.edgePalette,
      browseLocked: s.browseLocked,
      showAnnotationNumbers: s.showAnnotationNumbers,
      showEntityIds: s.showEntityIds,
      showReachBadges: s.showReachBadges,
      showReverseReachBadges: s.showReverseReachBadges,
      showMinimap: s.showMinimap,
      printInkSaver: s.printInkSaver,
      causalityLabel: s.causalityLabel,
      defaultLayoutDirection: s.defaultLayoutDirection,
      diagramType: s.doc.diagramType,
      layoutConfig: s.doc.layoutConfig,
      setTheme: s.setTheme,
      setAnimationSpeed: s.setAnimationSpeed,
      setEdgePalette: s.setEdgePalette,
      setBrowseLocked: s.setBrowseLocked,
      setShowAnnotationNumbers: s.setShowAnnotationNumbers,
      setShowEntityIds: s.setShowEntityIds,
      setShowReachBadges: s.setShowReachBadges,
      setShowReverseReachBadges: s.setShowReverseReachBadges,
      setShowMinimap: s.setShowMinimap,
      setPrintInkSaver: s.setPrintInkSaver,
      setCausalityLabel: s.setCausalityLabel,
      setDefaultLayoutDirection: s.setDefaultLayoutDirection,
      setLayoutConfig: s.setLayoutConfig,
      showGoalTreeWizard: s.showGoalTreeWizard,
      showECWizard: s.showECWizard,
      setShowGoalTreeWizard: s.setShowGoalTreeWizard,
      setShowECWizard: s.setShowECWizard,
    }))
  );

  // Block A: the Layout section is only meaningful for auto-layout
  // diagrams. EC ignores dagre entirely (positions live on entities);
  // showing the knobs there would mislead the user.
  const layoutKnobsEnabled = LAYOUT_STRATEGY[diagramType] === 'auto';
  const directionValue = layoutConfig?.direction ?? 'BT';
  const biasValue: BiasId = layoutConfig?.align ?? 'auto';
  const compactnessSlider = compactnessToSlider(layoutConfig);

  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="settings-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="settings-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          Settings
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close settings">
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Session 87 (S25) — tab bar replacing the single-scroll
          layout. ARIA tablist semantics so screen readers announce
          the tab transitions. */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="flex border-neutral-200 border-b px-2 dark:border-neutral-800"
      >
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex-1 px-2 py-2 font-semibold text-[11px] uppercase tracking-wide transition',
                active
                  ? 'border-indigo-500 border-b-2 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
                  : 'border-transparent border-b-2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-4 py-4">
        {activeTab === 'appearance' && (
          <Section title="Appearance">
            <Field label="Theme">
              {/* Session 88 (S11) — swatches replace the 7-radio
                  grid. Each swatch previews surface + accent so
                  pre-click scan is meaningful. Storage value
                  (`Theme` union) is unchanged. */}
              {/* Mirrors the `aria-pressed` pattern the existing
                  `RadioGroup` primitive in `formPrimitives.tsx` uses
                  — keeps the radio semantics without tripping the
                  `useSemanticElements` lint (Biome wants `<input
                  type="radio">` if we annotate as `role="radio"`).
                  Visually still a single-select group. */}
              <div aria-label="Theme" className="grid grid-cols-4 gap-1.5">
                {THEME_OPTIONS.map((opt) => {
                  const selected = opt.id === theme;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={opt.label}
                      title={opt.hint ? `${opt.label} — ${opt.hint}` : opt.label}
                      onClick={() => setTheme(opt.id)}
                      data-radio-name="theme"
                      className={clsx(
                        'flex flex-col items-stretch gap-1 rounded-md border p-1.5 text-left transition',
                        selected
                          ? 'border-indigo-400 ring-2 ring-indigo-200 dark:border-indigo-500 dark:ring-indigo-900'
                          : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700'
                      )}
                    >
                      <span
                        className="block h-8 w-full overflow-hidden rounded border border-neutral-200 dark:border-neutral-700"
                        style={{ background: opt.surface }}
                        aria-hidden
                      >
                        <span
                          className="block h-full"
                          style={{ width: 6, background: opt.accent }}
                        />
                      </span>
                      <span className="truncate text-[10px] text-neutral-700 dark:text-neutral-300">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Edge colors">
              <RadioGroup
                name="edgePalette"
                value={edgePalette}
                onChange={setEdgePalette}
                options={PALETTE_OPTIONS}
              />
            </Field>
          </Section>
        )}

        {activeTab === 'behavior' && (
          <Section title="Behavior">
            <Field label="Animation speed">
              <RadioGroup
                name="animationSpeed"
                value={animationSpeed}
                onChange={setAnimationSpeed}
                options={SPEED_OPTIONS}
              />
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
            </div>
          </Section>
        )}

        {activeTab === 'display' && (
          <Section title="Display">
            <Toggle
              label="Show annotation numbers"
              hint="A small #N badge on each entity"
              checked={showAnnotationNumbers}
              onChange={setShowAnnotationNumbers}
            />
            <Toggle
              label="Show entity IDs"
              hint="Mono-font caption below each title"
              checked={showEntityIds}
              onChange={setShowEntityIds}
            />
            <Toggle
              label="Show UDE-reach badge"
              hint="On each entity, a bottom-left pill counting how many UDEs it transitively reaches (the Core Driver signal). Hidden on diagrams without UDEs."
              checked={showReachBadges}
              onChange={setShowReachBadges}
            />
            <Toggle
              label="Show root-cause-reach badge"
              hint="On each entity, a bottom-right pill counting how many root causes transitively feed it. Useful on Goal Trees / FRTs where multiple injections converge. Hidden on diagrams without root causes."
              checked={showReverseReachBadges}
              onChange={setShowReverseReachBadges}
            />
            <Toggle
              label="Show minimap"
              hint="Bottom-left thumbnail of the whole diagram"
              checked={showMinimap}
              onChange={setShowMinimap}
            />
            <Toggle
              label="Ink-saving print mode"
              hint="When on, Print / Save as PDF drops colour fills (only the entity-type label is colorized)"
              checked={printInkSaver}
              onChange={setPrintInkSaver}
            />
            <Field label="Causality reading">
              <RadioGroup
                name="causalityLabel"
                value={causalityLabel}
                onChange={setCausalityLabel}
                options={CAUSALITY_OPTIONS}
              />
            </Field>
            <Field label="Default direction for new documents">
              <RadioGroup
                name="defaultLayoutDirection"
                value={defaultLayoutDirection}
                onChange={setDefaultLayoutDirection}
                options={DEFAULT_DIRECTION_OPTIONS}
              />
            </Field>
          </Section>
        )}

        {activeTab === 'layout' && (
          <Section title="Layout">
            {layoutKnobsEnabled ? (
              <>
                <Field label="Direction">
                  <RadioGroup
                    name="layoutDirection"
                    value={directionValue}
                    onChange={(id) => setLayoutConfig({ direction: id })}
                    options={DIRECTION_OPTIONS}
                  />
                </Field>
                <Slider
                  label="Compactness"
                  hint="Tighten or loosen the spacing dagre uses between entities. 50 is the app default."
                  value={compactnessSlider}
                  onChange={(v) => setLayoutConfig(sliderToCompactness(v))}
                />
                <Field label="Bias">
                  <RadioGroup
                    name="layoutBias"
                    value={biasValue}
                    onChange={(id) => setLayoutConfig({ align: id === 'auto' ? undefined : id })}
                    options={BIAS_OPTIONS}
                  />
                </Field>
                {hasLayoutOverride(layoutConfig) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLayoutConfig(undefined)}
                    className="self-start"
                    aria-label="Reset layout to defaults"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to defaults</span>
                  </Button>
                )}
              </>
            ) : (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                This diagram uses hand-positioned layout — drag entities directly on the canvas to
                reposition them. The Direction / Compactness / Bias knobs only apply to auto-layout
                diagrams (CRT, FRT, PRT, TT).
              </p>
            )}
          </Section>
        )}
      </div>
    </Modal>
  );
}
