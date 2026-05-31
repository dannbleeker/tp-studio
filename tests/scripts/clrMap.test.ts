import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs ESM module without a .d.ts; tested for behaviour.
import { CLR_MAP_CSS, clrMapHtml } from '../../scripts/lib/clrMapHtml.mjs';

/**
 * Guard: the Chapter-13 "classical CLR map" must not silently go missing.
 *
 * The map is a code-generated HTML/SVG figure (`scripts/lib/clrMapHtml.mjs`)
 * injected into the book at the `<!-- CLR_MAP -->` placeholder by both book
 * builders (`build-book-pdf.mjs` + `build-book-epub.mjs`). Nothing else
 * exercises that contract, so without this test a broken `clrMapHtml()`, a
 * deleted/renamed placeholder, or a builder regex change would drop the map
 * from the PDF + Kindle EPUB while CI stayed green. (That blind spot already
 * cost a session: the existing map was nearly rebuilt from scratch because
 * its presence wasn't obvious.) This locks the three moving parts together.
 */

// Vitest's root is the project dir, so resolve repo files from cwd (the
// module-runner's `import.meta.url` isn't a plain file: URL here).
const CHAPTER_13 = resolve(process.cwd(), 'docs/guide/13-the-clr.md');

// The eight CLR categories, in the order the figure lays them out. Mirrors
// the `CATEGORIES` table in clrMapHtml.mjs — kept here independently so a
// silent edit to that table (dropping/retitling a box) trips this test.
const CATEGORY_TITLES = [
  'Clarity',
  'Entity existence',
  'Causality existence',
  'Cause insufficiency',
  'Additional cause',
  'Cause-effect reversal',
  'Predicted effect',
  'Tautology',
];

// The exact token the book builders expand. Must stay in lockstep with the
// `/<!--\s*CLR_MAP\s*-->/g` regex in build-book-pdf.mjs / build-book-epub.mjs.
const placeholderRe = () => /<!--\s*CLR_MAP\s*-->/g;

describe('CLR map figure (Chapter 13)', () => {
  const html = clrMapHtml();

  it('renders a non-empty map with the grid wrappers', () => {
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(500);
    expect(html).toContain('class="clr-map"');
    expect(html).toContain('class="clr-grid"');
  });

  it('renders exactly eight category cards, each with a vignette', () => {
    expect((html.match(/class="clr-card"/g) ?? []).length).toBe(8);
    expect((html.match(/clr-card-vignette/g) ?? []).length).toBe(8);
    expect((html.match(/<svg/g) ?? []).length).toBe(8);
  });

  it('includes every CLR category title in its heading slot', () => {
    for (const title of CATEGORY_TITLES) {
      expect(html, `missing CLR category: ${title}`).toContain(`>${title}</h4>`);
    }
  });

  it('ships CSS that styles the map and its vignettes', () => {
    expect(typeof CLR_MAP_CSS).toBe('string');
    expect(CLR_MAP_CSS).toContain('.clr-map');
    expect(CLR_MAP_CSS).toContain('.clr-card');
    expect(CLR_MAP_CSS).toContain('.clr-card-vignette');
  });
});

describe('CLR map ↔ book-builder injection contract', () => {
  const chapter = readFileSync(CHAPTER_13, 'utf8');

  it('keeps the <!-- CLR_MAP --> placeholder in the chapter source', () => {
    expect(chapter).toContain('<!-- CLR_MAP -->');
    expect(placeholderRe().test(chapter)).toBe(true);
  });

  it('expands the placeholder into the live map and leaves no bare token', () => {
    const expanded = chapter.replace(placeholderRe(), () => clrMapHtml());
    expect(expanded).toContain('class="clr-map"');
    // The bare injection token must be fully consumed by the expansion.
    expect(placeholderRe().test(expanded)).toBe(false);
  });
});
