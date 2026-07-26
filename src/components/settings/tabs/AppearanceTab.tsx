import clsx from 'clsx';
import { useShallow } from 'zustand/shallow';
import { Field } from '@/components/inspector/Field';
import { isLocale, LOCALE_LABEL, SELECTABLE_LOCALES } from '@/i18n/locale';
import { useT } from '@/i18n/useT';
import type { EdgePalette, Theme } from '@/store';
import { useDocumentStore } from '@/store';
import { RadioGroup, Section, Select } from '../formPrimitives';

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
 *
 * Session 209 — the labels and hints moved to the message catalogue, keyed by
 * theme id. The hexes stay here: they are presentation, not copy, and have no
 * business being translatable.
 */
type ThemeSwatch = {
  id: Theme;
  /** Surface (background) hex used for the swatch preview. */
  surface: string;
  /** Accent (stripe) hex matching the theme's indigo/violet accent. */
  accent: string;
};
const THEME_SWATCHES: ThemeSwatch[] = [
  { id: 'light', surface: '#ffffff', accent: '#6366f1' },
  { id: 'dark', surface: '#0a0a0a', accent: '#818cf8' },
  { id: 'highContrast', surface: '#ffffff', accent: '#000000' },
  { id: 'rust', surface: '#1c1310', accent: '#f97316' },
  { id: 'coal', surface: '#0d1117', accent: '#58a6ff' },
  { id: 'navy', surface: '#0b1733', accent: '#8b5cf6' },
  { id: 'ayu', surface: '#1f2430', accent: '#ffcc66' },
];

/**
 * Session 121 — Appearance tab extracted from `SettingsDialog`. Owns
 * its own Zustand subscription so the four tab components stay
 * decoupled — re-rendering one tab's state doesn't touch the others.
 */
export function AppearanceTab() {
  const t = useT();
  const { theme, edgePalette, locale, setTheme, setEdgePalette, setLocale } = useDocumentStore(
    useShallow((s) => ({
      theme: s.theme,
      edgePalette: s.edgePalette,
      locale: s.locale,
      setTheme: s.setTheme,
      setEdgePalette: s.setEdgePalette,
      setLocale: s.setLocale,
    }))
  );

  const themeLabel = (id: Theme): string => t.settings.appearance.themes[id];
  const themeHint = (id: Theme): string | undefined =>
    id === 'light' || id === 'dark' ? undefined : t.settings.appearance.themes[`${id}Hint`];

  const paletteOptions: { id: EdgePalette; label: string; hint?: string }[] = [
    { id: 'default', label: t.settings.appearance.palettes.default },
    {
      id: 'colorblindSafe',
      label: t.settings.appearance.palettes.colorblindSafe,
      hint: t.settings.appearance.palettes.colorblindSafeHint,
    },
    { id: 'mono', label: t.settings.appearance.palettes.mono },
  ];

  return (
    <Section title={t.settings.appearance.section}>
      <Field label={t.settings.appearance.theme}>
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
        <fieldset
          aria-label={t.settings.appearance.theme}
          className="grid grid-cols-4 gap-1.5 border-0 p-0"
        >
          {THEME_SWATCHES.map((opt) => {
            const selected = opt.id === theme;
            const label = themeLabel(opt.id);
            const hint = themeHint(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={selected}
                aria-label={label}
                title={hint ? `${label} — ${hint}` : label}
                onClick={() => setTheme(opt.id)}
                data-radio-name="theme"
                className={clsx(
                  'flex flex-col items-stretch gap-1 rounded-md border p-1.5 text-left transition',
                  selected
                    ? 'border-accent-400 ring-2 ring-accent-200 dark:border-accent-500 dark:ring-accent-900'
                    : 'border-neutral-200 hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700'
                )}
              >
                <span
                  className="block h-8 w-full overflow-hidden rounded-sm border border-neutral-200 dark:border-neutral-700"
                  style={{ background: opt.surface }}
                  aria-hidden
                >
                  <span className="block h-full" style={{ width: 6, background: opt.accent }} />
                </span>
                <span className="truncate text-[10px] text-neutral-700 dark:text-neutral-300">
                  {label}
                </span>
              </button>
            );
          })}
        </fieldset>
      </Field>
      <Field label={t.settings.appearance.colorPalette}>
        <RadioGroup
          name="edgePalette"
          value={edgePalette}
          onChange={setEdgePalette}
          options={paletteOptions}
        />
      </Field>
      {/* Hidden while English is the only shipping locale: a one-option picker
          is a choice that isn't one, and it invites the user to expect a
          translated app that doesn't exist yet. The preference, its
          persistence and `<html lang>` all work regardless — this is purely
          whether the control is offered. It reappears the moment
          `SELECTABLE_LOCALES` has a second entry. */}
      {SELECTABLE_LOCALES.length > 1 && (
        <Field label={t.settings.appearance.language}>
          <Select
            value={locale}
            // `Select` hands back a bare `string`. Narrowing with the same guard
            // the persistence layer uses — rather than asserting `as Locale` —
            // keeps this correct if the option list and the union ever drift
            // apart, and matches how a tampered stored value is handled.
            onChange={(next) => {
              if (isLocale(next)) setLocale(next);
            }}
            ariaLabel={t.settings.appearance.language}
            options={SELECTABLE_LOCALES.map((id) => ({ value: id, label: LOCALE_LABEL[id] }))}
          />
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
            {t.settings.appearance.languageHint}
          </span>
        </Field>
      )}
    </Section>
  );
}
