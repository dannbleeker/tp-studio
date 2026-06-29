import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  SELECTED_BUTTON_CLASS,
  SELECTED_BUTTON_CLASS_PLAIN,
  UNSELECTED_BUTTON_CLASS,
} from '@/components/ui/buttonClasses';
import { CARD_FOCUS, INPUT_FOCUS } from '@/components/ui/focusClasses';
import { ACCENT } from '@/domain/tokens';

/**
 * Extraction guard for the semantic `accent` color token.
 *
 * The brand accent must be re-skinnable from ONE place so the `@studio/ui`
 * primitives can be vendored and re-themed. That means:
 *   1. The accent-carrying primitives reference `accent-*` utilities, never
 *      raw `indigo-*` (which would hard-code the brand and break re-skinning).
 *   2. The TS `ACCENT` constant and the CSS `--color-accent-500` token stay in
 *      sync — they're the two faces of the same knob (JS/SVG/export vs CSS).
 *
 * Note: a few `ui/` spots keep `indigo` deliberately — e.g. `InsetCard`'s
 * `indigo` *tone* is one categorical color among amber/emerald/rose, NOT the
 * accent — so this guard targets the accent-bearing class modules specifically
 * rather than banning `indigo` from the whole directory.
 */
const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('accent token guard', () => {
  it('focus + button class constants use accent-, not raw indigo-', () => {
    for (const s of [
      INPUT_FOCUS,
      CARD_FOCUS,
      SELECTED_BUTTON_CLASS,
      SELECTED_BUTTON_CLASS_PLAIN,
      UNSELECTED_BUTTON_CLASS,
    ]) {
      expect(s).not.toMatch(/\bindigo-/);
    }
    // At least the focus rings + selected state must be accent-driven.
    expect(INPUT_FOCUS).toContain('accent-');
    expect(SELECTED_BUTTON_CLASS).toContain('accent-');
  });

  it('accent-carrying ui/ primitives contain no raw indigo- utilities', () => {
    for (const f of [
      'src/components/ui/Button.tsx',
      'src/components/ui/TabBar.tsx',
      'src/components/ui/buttonClasses.ts',
      'src/components/ui/focusClasses.ts',
    ]) {
      expect(read(f), `${f} should not hard-code indigo-`).not.toMatch(/\bindigo-/);
    }
  });

  it('the @theme block defines the full accent scale', () => {
    const css = read('src/styles/index.css');
    for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
      expect(css, `missing --color-accent-${shade}`).toMatch(
        new RegExp(`--color-accent-${shade}:`)
      );
    }
  });

  it('ACCENT (tokens.ts) and --color-accent-500 (CSS) stay in sync', () => {
    const css = read('src/styles/index.css');
    expect(css).toContain(`--color-accent-500: ${ACCENT}`);
  });
});
