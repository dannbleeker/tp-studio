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

import { execSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { marked } from 'marked';
import { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from 'pdf-lib';
import {
  GUIDE_DIR,
  IMAGE_ROOTS,
  readChapterMetadata,
  SCREENSHOTS_DIR,
  TOC_GROUPS,
} from './lib/bookChapters.mjs';
import { CLR_MAP_CSS, clrMapHtml } from './lib/clrMapHtml.mjs';

// Session 135 — the chapter manifest, image-root table, metadata
// reader, and TOC grouping moved to `lib/bookChapters.mjs` so the
// EPUB builder shares them with this script. See that file for the
// canonical chapter list + add-a-chapter instructions.

const OUT_PATH = join(GUIDE_DIR, 'Causal-Thinking-with-TP-Studio.pdf');

// Session 135 — book-level metadata shared with the EPUB build. Used
// by the pdf-lib post-process to write Dublin Core-equivalent
// `/Author`, `/Subject`, `/Keywords`, `/Lang` into the PDF Catalog
// (Chromium/Skia by default emits only `/Title` + `/Creator`).
const BOOK_TITLE = 'Causal Thinking with TP Studio';
const BOOK_SUBTITLE =
  "A practitioner's guide to the Theory of Constraints, illustrated end-to-end with TP Studio.";
const BOOK_AUTHOR = 'Dann Pedersen';
const BOOK_KEYWORDS = [
  'Theory of Constraints',
  'TOC',
  'CRT',
  'FRT',
  'PRT',
  'TT',
  'Evaporating Cloud',
  'Goal Tree',
  'Strategy and Tactics',
  'Causal reasoning',
  'TP Studio',
];
const BOOK_LANG = 'en';

/**
 * Session 135 — Polish bundle #8: reproducible build date.
 *
 * The cover-page "Generated YYYY-MM-DD" text + the PDF's
 * `/CreationDate` previously used `new Date()` — every rebuild
 * stamped a different timestamp, even when the manuscript hadn't
 * changed. That breaks reproducible-build verification and bloats
 * the git diff of the committed PDF.
 *
 * Instead, derive the date from the latest git commit that touched
 * any input affecting the PDF output: the manuscript, screenshots,
 * diagrams, build scripts, and the shared chapter manifest.
 * Identical source → identical timestamp → identical PDF.
 *
 * Fallback to `new Date()` if git isn't available (e.g. running
 * outside a checkout). The fallback exists so the script doesn't
 * fail in degenerate dev contexts; CI / the committed PDF will
 * always have a real timestamp.
 */
function getBookDate() {
  try {
    const cmd =
      'git log -1 --format=%cI -- docs/guide scripts/build-book-pdf.mjs scripts/lib/bookChapters.mjs scripts/lib/clrMapHtml.mjs';
    const out = execSync(cmd, { encoding: 'utf8', cwd: join(GUIDE_DIR, '..', '..') }).trim();
    if (out) return new Date(out);
  } catch {
    // Fall through to `new Date()`.
  }
  return new Date();
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
  const expanded = markdownSource.replace(/<!--\s*CLR_MAP\s*-->/g, () => `\n\n${clrMapHtml()}\n\n`);
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
  // Session 135 — `TOC_GROUPS` lives in `lib/bookChapters.mjs` and
  // is shared with the EPUB builder so the two outputs stay in sync.
  const sections = TOC_GROUPS.map((group) => {
    const items = chapters.filter(group.match);
    if (items.length === 0) return '';
    const rows = items
      .map((c) => {
        const subtitle = c.subtitle ? `<span class="toc-subtitle">— ${c.subtitle}</span>` : '';
        return `<li><a href="#${c.slug}">${c.title}</a>${subtitle}</li>`;
      })
      .join('\n');
    return `<div class="toc-part"><h3>${group.label}</h3><ol class="toc-list">${rows}</ol></div>`;
  }).join('\n');

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
/* Session 135 — Polish bundle #5 + #6: page numbers in the bottom
 * margin and a running book-title header at the top of every
 * non-cover page. Cover + TOC suppress both via the named-page
 * overrides below ('@page cover' and '@page toc'). Chromium's PDF
 * renderer honours @page margin boxes; sizing tuned to fit inside
 * the 22mm vertical margin without crowding the content area. */
@page {
  size: A4;
  margin: 22mm 18mm 22mm 18mm;
  @bottom-center {
    content: counter(page);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
    color: #9ca3af;
    margin-top: 8mm;
  }
  @top-center {
    content: "Causal Thinking with TP Studio";
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 8.5pt;
    color: #9ca3af;
    letter-spacing: 0.08em;
    margin-bottom: 8mm;
  }
}

/* Cover + TOC: no header/footer chrome. Named-page contexts make
 * the @page declaration apply only to elements that opt in via
 * 'page: cover' / 'page: toc'. */
@page cover {
  margin: 0;
  @bottom-center { content: ""; }
  @top-center { content: ""; }
}
@page toc {
  @bottom-center { content: ""; }
  @top-center { content: ""; }
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
  /* Session 135 — opt into the 'cover' named-page context so the
   * @page cover { ... } rule suppresses the header / footer chrome
   * on the cover. Chromium respects the 'page' property. */
  page: cover;
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
  /* Session 135 — opt into the 'toc' named-page context so the
   * @page toc { ... } rule suppresses the header / footer chrome
   * on the contents page. */
  page: toc;
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

  // Session 135 / Polish #8 — reproducible build date. Identical
  // source produces an identical PDF.
  const now = getBookDate();
  console.log(`  build date: ${now.toISOString().split('T')[0]}`);
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
  console.log(`  ✓ Playwright wrote raw PDF`);

  // Session 135 — post-process via pdf-lib to add the metadata +
  // outlines that Chromium/Skia doesn't emit. See `postProcessPdf`
  // below for the rationale per step.
  await postProcessPdf(OUT_PATH, chapters, now);

  // Session 135 / Quick-win #7 — best-effort linearization via
  // `qpdf --linearize`. Linearized PDFs render the first page
  // before fully downloading, which matters for browser viewers
  // and some older Kindle firmware. Silently skipped when qpdf
  // isn't on PATH (local dev on Windows doesn't have it by
  // default; the CI Ubuntu runner installs it via apt). The PDF
  // is fully valid + readable either way — linearization is
  // strictly a render-speed optimization.
  tryLinearize(OUT_PATH);

  console.log(`✓ Wrote ${OUT_PATH}`);
}

/**
 * Session 135 — post-process the raw Chromium output with `pdf-lib`
 * to fix two long-standing gaps:
 *
 *   Quick-win #1 — navigable PDF outlines / bookmarks. Chromium 148
 *   was supposed to emit `/Outlines` from `page.pdf({ outline: true
 *   })` but the actual output had zero outline objects (Skia
 *   regression; unrelated to our content). We rebuild the outline
 *   from the chapter manifest + the `/Dests` map that Chromium DID
 *   produce, so every PDF viewer's bookmark sidebar lights up.
 *
 *   Quick-win #2 — full metadata. Chromium emits only `/Title` +
 *   `/Creator`. We add `/Author`, `/Subject`, `/Keywords`, `/Lang`
 *   so the file matches the EPUB's Dublin Core metadata + reads
 *   correctly in import classifiers (Send-to-Kindle, library
 *   software).
 *
 * Both passes preserve the existing document structure — we read
 * the PDF in, mutate the Catalog + Info dictionaries, and re-save.
 * The byte-level diff is small and the resulting PDF opens
 * identically in Adobe / Preview / Chromium.
 */
async function postProcessPdf(path, chapters, now) {
  console.log(`  post-processing (metadata + outlines)…`);
  const raw = await readFile(path);
  const pdfDoc = await PDFDocument.load(raw, { updateMetadata: false });

  // ── Metadata ────────────────────────────────────────────────
  pdfDoc.setTitle(BOOK_TITLE);
  pdfDoc.setAuthor(BOOK_AUTHOR);
  pdfDoc.setSubject(BOOK_SUBTITLE);
  pdfDoc.setKeywords(BOOK_KEYWORDS);
  pdfDoc.setProducer('TP Studio book builder (Playwright + pdf-lib)');
  pdfDoc.setCreator('TP Studio book builder');
  pdfDoc.setCreationDate(now);
  pdfDoc.setModificationDate(now);
  // `/Lang` lives on the Catalog, not the Info dict. pdf-lib doesn't
  // wrap that one — set it directly via the low-level API.
  const catalog = pdfDoc.catalog;
  catalog.set(PDFName.of('Lang'), PDFString.of(BOOK_LANG));

  // ── Outlines ────────────────────────────────────────────────
  // Strategy: walk the named-destinations map that Chromium emits
  // (one entry per anchor id, including each chapter's H1 slug).
  // For every chapter in the manifest, find its slug in the dest
  // map. Build a flat outline list (one item per chapter) with the
  // PDF spec's `/First`, `/Last`, `/Prev`, `/Next`, `/Parent`,
  // `/Count` linkage. Grouping by part-headers (matching the
  // book's TOC structure) would be nicer but pdf-lib's low-level
  // outline construction stays simpler at one level deep — and the
  // 24-chapter flat list still reads fine in any viewer's bookmark
  // sidebar.
  const destsRef = catalog.get(PDFName.of('Dests'));
  if (destsRef) {
    const dests = pdfDoc.context.lookup(destsRef);
    // dests is a PDFDict mapping name → destination array.
    // Filter to the chapters that have a matching dest.
    const items = [];
    for (const c of chapters) {
      const destValue = dests.get(PDFName.of(c.slug));
      if (!destValue) continue;
      items.push({ title: c.title, dest: destValue });
    }
    if (items.length > 0) {
      // Reserve a ref for /Outlines first so each item can point at
      // it as their /Parent. Build the items with sentinel /Prev
      // and /Next, then back-patch the linkage after registration.
      const outlinesRef = PDFRef.of(pdfDoc.context.largestObjectNumber + 1);
      const itemRefs = items.map((_, i) => PDFRef.of(outlinesRef.objectNumber + 1 + i));

      // Build + register each outline item.
      items.forEach((item, i) => {
        const itemDict = pdfDoc.context.obj({
          Title: PDFHexString.fromText(item.title),
          Parent: outlinesRef,
          Dest: item.dest,
          ...(i > 0 ? { Prev: itemRefs[i - 1] } : {}),
          ...(i < items.length - 1 ? { Next: itemRefs[i + 1] } : {}),
        });
        pdfDoc.context.assign(itemRefs[i], itemDict);
      });

      // Build + register the /Outlines root.
      const outlinesDict = pdfDoc.context.obj({
        Type: 'Outlines',
        First: itemRefs[0],
        Last: itemRefs[itemRefs.length - 1],
        Count: PDFNumber.of(items.length),
      });
      pdfDoc.context.assign(outlinesRef, outlinesDict);

      // Wire it into the Catalog + ask viewers to show the
      // bookmark panel on open.
      catalog.set(PDFName.of('Outlines'), outlinesRef);
      catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
      console.log(`  ✓ Outlines: ${items.length} chapters wired into bookmark sidebar`);
    } else {
      console.warn(`  ⚠ No chapter destinations found in /Dests — skipping outline build`);
    }
  } else {
    console.warn(`  ⚠ No /Dests dictionary — skipping outline build`);
  }

  const out = await pdfDoc.save({ useObjectStreams: false });
  await writeFile(path, out);
  console.log(`  ✓ Metadata + outlines written`);
}

/**
 * Session 135 — best-effort linearization via the qpdf system
 * binary. Linearization reorders the PDF so the first page renders
 * before the rest of the file downloads — important for browser
 * viewers and sometimes a Kindle prerequisite.
 *
 * `qpdf` is installed by the rebuild-book-artifacts workflow via
 * apt; local dev machines may not have it (Windows in particular).
 * Skipping when qpdf is unavailable is fine — the unlinearized PDF
 * is fully valid and renders correctly in every modern viewer.
 */
function tryLinearize(path) {
  try {
    // Run qpdf in-place via the `--replace-input` form. Verbose
    // stderr suppressed; we only log success / skip.
    execSync(`qpdf --linearize --replace-input "${path}"`, { stdio: 'pipe' });
    console.log(`  ✓ Linearized (qpdf)`);
  } catch (err) {
    const msg = err?.message ?? String(err);
    if (/ENOENT|not recognized|not found/i.test(msg)) {
      console.log(`  ⚠ qpdf not on PATH — skipping linearization (non-fatal)`);
    } else {
      console.warn(`  ⚠ qpdf failed: ${msg.split('\n')[0]} — keeping unlinearized PDF`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
