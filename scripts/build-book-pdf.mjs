#!/usr/bin/env node
/**
 * Session 104 — Build a single PDF of the *Causal Thinking with TP Studio* book.
 *
 *   Input:   docs/guide/*.md  (manuscript)
 *            docs/guide/screenshots/*.png  (book screenshots)
 *
 *   Output:  docs/guide/Causal-Thinking-with-TP-Studio.pdf
 *
 * Pipeline:
 *   1. Read the chapter files in canonical order.
 *   2. Build a cover-page HTML block.
 *   3. Build a table-of-contents HTML block with anchor links into the
 *      body (clickable in any PDF viewer).
 *   4. Render each chapter's Markdown to HTML via `marked`, rewriting
 *      relative `screenshots/...` image paths to absolute file:// URLs
 *      so Chromium can load them.
 *   5. Concatenate cover + TOC + chapters into one self-contained HTML
 *      document with book-styling CSS.
 *   6. Use Playwright (the same Chromium the project already has
 *      installed for e2e) to render the HTML and print to PDF with
 *      `outline: true`, which produces a navigable bookmark sidebar
 *      from the heading hierarchy.
 *
 * The script reuses the project's existing devDeps:
 *   - `@playwright/test` (already pinned for e2e)
 *   - `marked` (added Session 104 specifically for this script)
 *
 * Re-run after manuscript edits via `pnpm book`. The PDF is committed
 * to docs/guide/ so contributors can download the latest build without
 * regenerating.
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { marked } from 'marked';
import { clrMapHtml, CLR_MAP_CSS } from './lib/clrMapHtml.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');
const GUIDE_DIR = join(PROJECT_ROOT, 'docs', 'guide');
const SCREENSHOTS_DIR = join(GUIDE_DIR, 'screenshots');
const DIAGRAMS_DIR = join(GUIDE_DIR, 'diagrams');
// Markdown image prefixes the rewriter inlines. Keys are the path
// prefix used in the chapter source; values are the absolute directory
// to resolve filenames against. Add a new entry here to expose a new
// asset folder to the book builder.
const IMAGE_ROOTS = [
  { prefix: 'screenshots', dir: SCREENSHOTS_DIR },
  { prefix: 'diagrams', dir: DIAGRAMS_DIR },
];
const OUT_PATH = join(GUIDE_DIR, 'Causal-Thinking-with-TP-Studio.pdf');

/**
 * Canonical chapter order. Mirrors `docs/guide/README.md`. Hand-listed
 * so re-ordering / renaming is explicit; alphabetical sort on the
 * directory would conflate appendices with chapters.
 */
const CHAPTER_FILES = [
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
 * Display-name + slug pairs for the TOC. Derived from the chapter
 * file content (the H1) rather than hard-coded so renames don't
 * silently drift.
 */
async function readChapterMetadata() {
  const result = [];
  for (const filename of CHAPTER_FILES) {
    const full = join(GUIDE_DIR, filename);
    const raw = await readFile(full, 'utf8');
    // First line of the H1 (`# Chapter 4 — …`). Drop the leading `#`.
    const h1Match = raw.match(/^#\s+(.+?)\s*$/m);
    if (!h1Match) {
      throw new Error(`No H1 found in ${filename}`);
    }
    // Subtitle (the H3 directly under the H1, if any) — used in the
    // TOC to make the table read more naturally.
    const h3Match = raw.match(/^###\s+(.+?)\s*$/m);
    result.push({
      filename,
      slug: filename.replace(/\.md$/, ''),
      title: h1Match[1],
      subtitle: h3Match ? h3Match[1] : null,
    });
  }
  return result;
}

/**
 * Walk the rendered HTML for each chapter and inline every
 * `screenshots/foo.png` reference as a `data:image/png;base64,…` URI.
 *
 * Session 132 (followup) — the previous implementation rewrote paths
 * to `file://` absolute URLs, but Chromium's security policy blocks
 * `file://` resources from HTML loaded via `page.setContent()` (the
 * document's origin is opaque, not file://). Result: 11 of 13 chapter
 * screenshots failed to load silently and the rendered PDF shipped
 * without them. Base64 data URIs bypass the origin check entirely,
 * inflate the HTML by ~870 KB (well within memory budget for a 1 MB
 * PDF), and produce the same final binary output.
 */
async function rewriteImagePaths(html) {
  let result = html;
  for (const { prefix, dir } of IMAGE_ROOTS) {
    // Build a per-prefix regex so we can substitute each asset root
    // independently. The literal-prefix interpolation is safe — all
    // entries in IMAGE_ROOTS are static.
    const findRe = new RegExp(`<img\\s+[^>]*src="${prefix}\\/([^"]+)"`, 'g');
    const matches = [...result.matchAll(findRe)];
    if (matches.length === 0) continue;
    const fileToDataUri = new Map();
    for (const m of matches) {
      const filename = m[1];
      if (fileToDataUri.has(filename)) continue;
      try {
        const buf = await readFile(join(dir, filename));
        const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        fileToDataUri.set(filename, `data:${mime};base64,${buf.toString('base64')}`);
      } catch {
        // Missing asset — leave the relative path so the broken-image
        // icon renders + a maintainer notices instead of the PDF
        // shipping without warning.
        fileToDataUri.set(filename, `${prefix}/${filename}`);
      }
    }
    const replaceRe = new RegExp(`(<img\\s+[^>]*src=")${prefix}\\/([^"]+)(")`, 'g');
    result = result.replace(
      replaceRe,
      (_, p, filename, suffix) => `${p}${fileToDataUri.get(filename)}${suffix}`
    );
  }
  return result;
}

/**
 * Convert one chapter's Markdown body to HTML. Adds an `id` attribute
 * to the H1 derived from the filename slug so the TOC anchors land
 * precisely (default marked-generated H1 ids are based on the title
 * text, which would change if a chapter's title is edited).
 */
async function chapterToHtml(slug, markdownSource) {
  // Pre-pass: expand `<!-- CLR_MAP -->` placeholders. Done before marked
  // sees the source so the generated `<div>` tree is preserved exactly
  // (marked passes HTML through but is fussy about empty-line framing
  // around block-level HTML; pasting the expanded HTML with surrounding
  // blank lines lets it land cleanly between paragraphs).
  const expanded = markdownSource.replace(
    /<!--\s*CLR_MAP\s*-->/g,
    () => `\n\n${clrMapHtml()}\n\n`
  );
  const html = marked.parse(expanded, { mangle: false, headerIds: true });
  // Inject the slug id on the H1 so TOC links resolve.
  const withId = html.replace(/<h1(.*?)>/, `<h1 id="${slug}"$1>`);
  return rewriteImagePaths(withId);
}

function coverHtml(now) {
  return `
<section class="cover">
  <div class="cover-inner">
    <div class="cover-eyebrow">Practitioner's guide</div>
    <h1 class="cover-title">Causal Thinking<br/>with TP Studio</h1>
    <div class="cover-subtitle">A practitioner's guide to the Theory of Constraints, illustrated end-to-end with TP Studio.</div>
    <div class="cover-meta">
      <div>Generated ${now.toISOString().split('T')[0]}</div>
      <div>tp-studio.struktureretsundfornuft.dk</div>
    </div>
  </div>
</section>
`;
}

function tocHtml(chapters) {
  // Group by part for visual structure. The chapter-file naming
  // convention is what we group on — Part 1 is files 00-03, Part 2 is
  // 04-11, Part 3 is 12-14, Part 4 is 15-17, Appendices are appendix-*.
  const groups = [
    { label: 'Front matter', match: (c) => c.filename.startsWith('00-') },
    {
      label: 'Part 1 — Foundations',
      match: (c) => /^0[1-3]-/.test(c.filename),
    },
    {
      label: 'Part 2 — The Thinking Processes',
      match: (c) => /^(0[4-9]|1[0-1])-/.test(c.filename),
    },
    {
      label: 'Part 3 — Across the canvas',
      match: (c) => /^1[2-4]-/.test(c.filename),
    },
    {
      label: 'Part 4 — Beyond the screen',
      match: (c) => /^1[5-7]-/.test(c.filename),
    },
    { label: 'Appendices', match: (c) => c.filename.startsWith('appendix-') },
  ];

  const sections = groups
    .map((group) => {
      const items = chapters.filter(group.match);
      if (items.length === 0) return '';
      const rows = items
        .map((c) => {
          const subtitle = c.subtitle ? `<span class="toc-subtitle">— ${c.subtitle}</span>` : '';
          return `<li><a href="#${c.slug}">${c.title}</a>${subtitle}</li>`;
        })
        .join('\n');
      return `<div class="toc-part"><h3>${group.label}</h3><ol class="toc-list">${rows}</ol></div>`;
    })
    .join('\n');

  return `
<section class="toc-page">
  <h2 class="toc-title">Contents</h2>
  ${sections}
</section>
`;
}

/**
 * The book stylesheet. Print-friendly typography, page-break rules so
 * each chapter starts on its own page, image sizing that respects the
 * page margin, and the cover/TOC visual treatment.
 */
const STYLESHEET = `
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1f2937;
  margin: 0;
  padding: 0;
}

/* ───── Cover ─────
 * A4 content area is 297mm − 22mm × 2 = 253mm tall. Setting an explicit
 * mm height (rather than 100vh) makes Chromium's PDF renderer pin the
 * cover to exactly one page; vh was being computed against the layout
 * viewport, not the printed page, and produced an under-filled cover.
 */
.cover {
  height: 253mm;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  page-break-after: always;
}
.cover-inner {
  max-width: 480px;
}
.cover-eyebrow {
  font-size: 11pt;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6366f1;
  font-weight: 600;
  margin-bottom: 32pt;
}
/* The global h1 rule below forces page-break-before always for
 * chapter starts. The cover title is an h1 too, which previously
 * kicked everything after the eyebrow onto a new page. Opt out here
 * so the cover renders as one cohesive page. */
.cover-title {
  font-size: 48pt;
  line-height: 1.05;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 32pt 0;
  color: #111827;
  page-break-before: auto;
}
.cover-subtitle {
  font-size: 13pt;
  line-height: 1.45;
  color: #4b5563;
  font-style: italic;
  margin-bottom: 48pt;
}
.cover-meta {
  font-size: 9pt;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}
.cover-meta div + div {
  margin-top: 4pt;
}

/* ───── TOC ─────
 * The cover's page-break-after already starts the TOC on a fresh page;
 * the first chapter's h1 page-break-before starts the body on the next
 * fresh page. Repeating those breaks on .toc-page was triggering an
 * intermittent blank page between cover and TOC in Chromium's PDF
 * renderer. */
.toc-page {
  /* no forced page-breaks — neighbours handle it */
}
.toc-title {
  font-size: 26pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 24pt 0;
  color: #111827;
}
.toc-part {
  margin-bottom: 18pt;
}
.toc-part h3 {
  font-size: 10pt;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #6366f1;
  font-weight: 700;
  margin: 0 0 8pt 0;
}
.toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.toc-list li {
  padding: 4pt 0;
  border-bottom: 0.5pt dotted #e5e7eb;
  font-size: 10.5pt;
}
.toc-list a {
  color: #1f2937;
  text-decoration: none;
  font-weight: 500;
}
.toc-subtitle {
  color: #6b7280;
  font-style: italic;
  margin-left: 6pt;
  font-size: 9.5pt;
}

/* ───── Chapter content ───── */
h1 {
  page-break-before: always;
  font-size: 22pt;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #111827;
  margin: 0 0 4pt 0;
}
h1 + h3 {
  font-size: 13pt;
  font-weight: 500;
  font-style: italic;
  color: #6b7280;
  margin: 0 0 24pt 0;
}
h2 {
  font-size: 16pt;
  font-weight: 700;
  color: #111827;
  margin: 24pt 0 8pt 0;
  page-break-after: avoid;
}
h3 {
  font-size: 12.5pt;
  font-weight: 700;
  color: #1f2937;
  margin: 18pt 0 6pt 0;
  page-break-after: avoid;
}
p {
  margin: 0 0 9pt 0;
  text-align: justify;
  hyphens: auto;
  -webkit-hyphens: auto;
}
ul, ol {
  margin: 0 0 9pt 0;
  padding-left: 22pt;
}
li {
  margin: 2pt 0;
}
strong {
  color: #111827;
  font-weight: 700;
}
em {
  color: #1f2937;
}
code {
  font-family: "SF Mono", "Consolas", "Monaco", "Courier New", monospace;
  font-size: 9.5pt;
  background: #f3f4f6;
  border-radius: 3pt;
  padding: 1pt 4pt;
  color: #be185d;
}
pre {
  font-family: "SF Mono", "Consolas", "Monaco", "Courier New", monospace;
  font-size: 9pt;
  background: #f9fafb;
  border: 0.5pt solid #e5e7eb;
  border-radius: 3pt;
  padding: 10pt;
  margin: 0 0 12pt 0;
  overflow-x: auto;
  white-space: pre-wrap;
  page-break-inside: avoid;
}
pre code {
  background: transparent;
  padding: 0;
  color: #1f2937;
}
blockquote {
  border-left: 3pt solid #6366f1;
  background: #f5f3ff;
  padding: 10pt 14pt;
  margin: 0 0 12pt 0;
  color: #4b5563;
  font-style: italic;
  border-radius: 0 3pt 3pt 0;
  page-break-inside: avoid;
}
blockquote p {
  margin: 0 0 6pt 0;
}
blockquote p:last-child {
  margin-bottom: 0;
}
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 14pt 0;
  font-size: 9.5pt;
  page-break-inside: avoid;
}
th, td {
  border: 0.5pt solid #e5e7eb;
  padding: 5pt 7pt;
  text-align: left;
  vertical-align: top;
}
th {
  background: #f9fafb;
  font-weight: 700;
  color: #111827;
}
img {
  max-width: 100%;
  height: auto;
  border: 0.5pt solid #e5e7eb;
  border-radius: 4pt;
  margin: 8pt 0;
  page-break-inside: avoid;
  display: block;
}
hr {
  border: none;
  border-top: 0.5pt solid #e5e7eb;
  margin: 16pt 0;
}
a {
  color: #6366f1;
  text-decoration: none;
}

${CLR_MAP_CSS}

/* Sidebars (call-out blockquotes). The author marks them with leading
   emoji per AUTHORING.md (🎯 🛠 💡 ⚠ 🛑 🔁). They render as styled
   blockquotes — no extra CSS needed; the existing blockquote style
   carries them. */
`;

async function main() {
  console.log(`📖 Building Causal-Thinking-with-TP-Studio.pdf …`);

  const chapters = await readChapterMetadata();
  console.log(`  ${chapters.length} chapters discovered`);

  const screenshotFiles = await readdir(SCREENSHOTS_DIR).catch(() => []);
  console.log(`  ${screenshotFiles.length} screenshots available`);

  const chapterBodies = await Promise.all(
    chapters.map(async (c) => {
      const md = await readFile(join(GUIDE_DIR, c.filename), 'utf8');
      return chapterToHtml(c.slug, md);
    })
  );

  const now = new Date();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Causal Thinking with TP Studio</title>
<style>${STYLESHEET}</style>
</head>
<body>
${coverHtml(now)}
${tocHtml(chapters)}
${chapterBodies.join('\n')}
</body>
</html>`;

  // Render to PDF via Playwright. `outline: true` extracts headings
  // into PDF bookmarks — the navigable sidebar in any PDF viewer.
  // `preferCSSPageSize: true` honors the @page CSS rule's A4 / margins.
  console.log(`  rendering via Playwright (Chromium)…`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({
    path: OUT_PATH,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    outline: true,
  });
  await browser.close();

  console.log(`✓ Wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
