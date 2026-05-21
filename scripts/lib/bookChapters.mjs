/**
 * Session 135 — shared chapter manifest used by both
 * `scripts/build-book-pdf.mjs` and `scripts/build-book-epub.mjs`.
 *
 * Hand-listed (rather than alphabetical sort of the directory) so
 * re-ordering / renaming is explicit and appendices don't intermix
 * with numbered chapters. Mirrors `docs/guide/README.md`.
 *
 * Add a chapter: append the filename here AND add an H1 to the new
 * file. `readChapterMetadata` reads the H1 + optional H3 subtitle
 * from the source so renames don't silently drift the TOC.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(HERE, '..', '..');
export const GUIDE_DIR = join(PROJECT_ROOT, 'docs', 'guide');
export const SCREENSHOTS_DIR = join(GUIDE_DIR, 'screenshots');
export const DIAGRAMS_DIR = join(GUIDE_DIR, 'diagrams');

/**
 * Canonical chapter order. Each entry is a filename relative to
 * GUIDE_DIR. Adding / reordering chapters: edit this list, then
 * verify the H1 in each new file matches the desired TOC label.
 */
export const CHAPTER_FILES = [
  '00-foreword.md',
  '01-the-system-has-a-goal.md',
  '02-your-first-canvas.md',
  '03-reading-a-diagram.md',
  '04-current-reality-tree.md',
  '05-evaporating-cloud.md',
  '06-future-reality-tree.md',
  '07-prerequisite-tree.md',
  '08-transition-tree.md',
  '09-goal-tree.md',
  '10-strategy-and-tactics-tree.md',
  '11-freeform-diagrams.md',
  '12-groups-assumptions-injections.md',
  '13-the-clr.md',
  '14-iteration-revisions-branches.md',
  '15-verbalisation-walkthroughs.md',
  '16-sharing-your-work.md',
  '17-workshops-with-tp-studio.md',
  'appendix-a-case-study.md',
  'appendix-b-keyboard-reference.md',
  'appendix-c-clr-rules.md',
  'appendix-d-settings.md',
  'appendix-e-glossary.md',
  'appendix-f-further-reading.md',
];

/**
 * Asset prefix → absolute-directory map. The Markdown source
 * references images as `screenshots/foo.png` or `diagrams/bar.png`;
 * builders use this table to inline (PDF) or embed (EPUB) those
 * assets. Adding a new asset folder: append an entry here and the
 * builders pick it up.
 */
export const IMAGE_ROOTS = [
  { prefix: 'screenshots', dir: SCREENSHOTS_DIR },
  { prefix: 'diagrams', dir: DIAGRAMS_DIR },
];

/**
 * Read the chapter manifest with H1 (title) + optional H3 (subtitle)
 * derived from the source. Used by the PDF + EPUB builders to render
 * the TOC.
 *
 * Throws on the first chapter missing an H1 — that's a manuscript
 * error worth surfacing loudly rather than silently producing a TOC
 * entry with an empty label.
 */
export async function readChapterMetadata() {
  const result = [];
  for (const filename of CHAPTER_FILES) {
    const full = join(GUIDE_DIR, filename);
    const raw = await readFile(full, 'utf8');
    const h1Match = raw.match(/^#\s+(.+?)\s*$/m);
    if (!h1Match) {
      throw new Error(`No H1 found in ${filename}`);
    }
    const h3Match = raw.match(/^###\s+(.+?)\s*$/m);
    result.push({
      filename,
      slug: filename.replace(/\.md$/, ''),
      title: h1Match[1],
      subtitle: h3Match ? h3Match[1] : null,
      raw,
    });
  }
  return result;
}

/**
 * Grouping rule for the TOC's part-headers. Used by both builders so
 * the PDF and EPUB show the same hierarchy. The match is on the
 * filename prefix, which stays stable across renames of the H1.
 */
export const TOC_GROUPS = [
  { label: 'Front matter', match: (c) => c.filename.startsWith('00-') },
  { label: 'Part 1 — Foundations', match: (c) => /^0[1-3]-/.test(c.filename) },
  { label: 'Part 2 — The Thinking Processes', match: (c) => /^(0[4-9]|1[0-1])-/.test(c.filename) },
  { label: 'Part 3 — Across the canvas', match: (c) => /^1[2-4]-/.test(c.filename) },
  { label: 'Part 4 — Beyond the screen', match: (c) => /^1[5-7]-/.test(c.filename) },
  { label: 'Appendices', match: (c) => c.filename.startsWith('appendix-') },
];
