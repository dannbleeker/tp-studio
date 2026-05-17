import clsx from 'clsx';
import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import type { EdgePalette, Theme } from '@/store';
import { useDocumentStore } from '@/store';
import { RadioGroup, Section } from '../formPrimitives';

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

const PALETTE_OPTIONS: { id: EdgePalette; label: string; hint?: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'colorblindSafe', label: 'Colorblind-safe', hint: 'Wong palette' },
  { id: 'mono', label: 'Monochrome' },
];

/**
 * Session 121 — Appearance tab extracted from `SettingsDialog`. Owns
 * its own Zustand subscription so the four tab components stay
 * decoupled — re-rendering one tab's state doesn't touch the others.
 */
export function AppearanceTab() {
  const { theme, edgePalette, setTheme, setEdgePalette } = useDocumentStore(
    useShallow((s) => ({
      theme: s.theme,
      edgePalette: s.edgePalette,
      setTheme: s.setTheme,
      setEdgePalette: s.setEdgePalette,
    }))
  );

  return (
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
                  <span className="block h-full" style={{ width: 6, background: opt.accent }} />
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
  );
}
