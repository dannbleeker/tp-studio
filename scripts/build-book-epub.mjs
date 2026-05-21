#!/usr/bin/env node
/**
 * Session 135 — Build a single EPUB of the *Causal Thinking with TP
 * Studio* book.
 *
 *   Input:   docs/guide/*.md  (manuscript)
 *            docs/guide/screenshots/*.png  (book screenshots)
 *            docs/guide/diagrams/*.png  (diagrams)
 *
 *   Output:  docs/guide/Causal-Thinking-with-TP-Studio.epub
 *
 * EPUB is the Kindle-friendly companion to the PDF: Send-to-Kindle
 * accepts `.epub` natively (since 2022) and reflows the text on any
 * Kindle screen, fixing the "PDF shows up but won't open" + "A4 is
 * unreadable on a 6-inch device" problems the PDF can hit.
 *
 * Output structure (EPUB 3.0):
 *
 *   mybook.epub (zip)
 *   ├── mimetype                       — uncompressed, first file
 *   ├── META-INF/
 *   │   └── container.xml              — points to OEBPS/content.opf
 *   └── OEBPS/
 *       ├── content.opf                — manifest + spine + metadata
 *       ├── nav.xhtml                  — EPUB 3 navigation
 *       ├── toc.ncx                    — EPUB 2 legacy navigation
 *       ├── styles.css                 — book stylesheet
 *       ├── cover.xhtml                — title page
 *       ├── chapter-00.xhtml … chapter-NN.xhtml
 *       └── images/                    — embedded assets
 *
 * Tooling: pure Node + the existing devDeps (`marked` for Markdown,
 * `jszip` for the EPUB container — both already in `package.json`).
 * No system pandoc / LaTeX needed.
 *
 * Re-run after manuscript edits via `pnpm book:epub` (or `pnpm book`
 * to build both PDF + EPUB in one go).
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { marked } from 'marked';
import {
  GUIDE_DIR,
  IMAGE_ROOTS,
  readChapterMetadata,
  SCREENSHOTS_DIR,
  TOC_GROUPS,
} from './lib/bookChapters.mjs';
import { CLR_MAP_CSS, clrMapHtml } from './lib/clrMapHtml.mjs';

const OUT_PATH = join(GUIDE_DIR, 'Causal-Thinking-with-TP-Studio.epub');

// Stable EPUB book id. Generated once and pinned so the EPUB
// identifier stays consistent across rebuilds (Kindle and other
// readers may cache by id; a new id every build would force a re-add).
const BOOK_ID = 'urn:uuid:tp-studio-causal-thinking-2025-v1';
const BOOK_TITLE = 'Causal Thinking with TP Studio';
const BOOK_SUBTITLE =
  "A practitioner's guide to the Theory of Constraints, illustrated end-to-end with TP Studio.";
const BOOK_AUTHOR = 'Dann Pedersen';
const BOOK_LANG = 'en';
const BOOK_PUBLISHER = 'tp-studio.struktureretsundfornuft.dk';

/**
 * Escape a string for safe inclusion in XML attribute values or text
 * content. EPUB content files are XHTML / XML — `&`, `<`, `>`, `"`,
 * `'` all need escaping in different contexts. We escape conservatively
 * for both attributes and text since the escaped form is valid in
 * either position.
 */
function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert marked's HTML5 output to XHTML 1.1 / EPUB-safe XML:
 *   - self-close void elements: `<br>`, `<hr>`, `<img>`, `<meta>`,
 *     `<link>`, `<input>`, `<source>`
 *   - drop boolean-style attributes without values (none in our
 *     markdown output today; defensive).
 *
 * EPUB readers vary in strictness. Strict ones (e.g. Calibre's
 * validator + KindleGen) reject HTML5 void-element forms; permissive
 * ones (most actual reading apps) accept either. Producing
 * well-formed XHTML keeps us future-proof.
 */
function htmlToXhtml(html) {
  let out = html;
  // Self-close void elements that marked emits in non-XHTML form.
  out = out.replace(/<br>/g, '<br />');
  out = out.replace(/<hr>/g, '<hr />');
  out = out.replace(/<(img[^>]*?)(?<!\/)>/g, '<$1 />');
  return out;
}

/**
 * Per-chapter Markdown → XHTML. Mirrors the PDF builder's
 * `chapterToHtml` but rewrites image references to point at the
 * relative `images/<filename>` location inside the EPUB rather than
 * inlining them as data URIs (EPUB embeds the images as separate
 * package items).
 */
function chapterToXhtml(slug, markdownSource, embeddedImages) {
  // Expand <!-- CLR_MAP --> placeholders (same as the PDF builder).
  const expanded = markdownSource.replace(/<!--\s*CLR_MAP\s*-->/g, () => `\n\n${clrMapHtml()}\n\n`);
  let html = marked.parse(expanded, { mangle: false, headerIds: true });

  // Rewrite image src="screenshots/foo.png" → src="images/foo.png"
  // for every IMAGE_ROOTS prefix. The actual file is added to the
  // EPUB package by `collectImages` below.
  for (const { prefix } of IMAGE_ROOTS) {
    const findRe = new RegExp(`(<img\\s+[^>]*src=")${prefix}\\/([^"]+)(")`, 'g');
    html = html.replace(findRe, (_, p, filename, suffix) => {
      embeddedImages.add(`${prefix}/${filename}`);
      return `${p}images/${filename}${suffix}`;
    });
  }

  // Inject the slug id on the H1 so the EPUB navigation lands cleanly.
  html = html.replace(/<h1(.*?)>/, `<h1 id="${slug}"$1>`);

  return htmlToXhtml(html);
}

/**
 * Walk the chapter HTML output to collect every embedded image file
 * referenced under one of the IMAGE_ROOTS prefixes. Returns a Map of
 * `images/<filename>` → { abs: absolute-source-path, mime: mime-type
 * }, used to add the files to the EPUB package.
 *
 * Missing files are dropped silently (the broken-image icon will
 * render in the EPUB the same way it would in the PDF). A future
 * stricter mode could throw — for now we match the PDF builder's
 * permissive behaviour.
 */
async function collectImages(embeddedRelativePaths) {
  const out = new Map();
  for (const rel of embeddedRelativePaths) {
    const [prefix, ...rest] = rel.split('/');
    const filename = rest.join('/');
    const root = IMAGE_ROOTS.find((r) => r.prefix === prefix);
    if (!root) continue;
    const abs = join(root.dir, filename);
    try {
      // Verify the file exists by reading its bytes. We re-read at
      // pack time so a missing-file failure surfaces here, with a
      // useful path, not deep inside the JSZip add.
      const buf = await readFile(abs);
      const ext = filename.split('.').pop()?.toLowerCase() ?? 'png';
      const mime =
        ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : ext === 'svg'
              ? 'image/svg+xml'
              : ext === 'gif'
                ? 'image/gif'
                : 'application/octet-stream';
      out.set(`images/${filename}`, { abs, mime, buf });
    } catch {
      // Same permissive policy as the PDF builder: a missing asset
      // doesn't fail the build. The broken reference surfaces in
      // the EPUB so a maintainer notices.
    }
  }
  return out;
}

/**
 * One chapter wrapped as a standalone XHTML document. EPUB readers
 * expect each spine entry to be a complete XHTML doc with its own
 * head + body.
 */
function chapterDocument(_slug, title, bodyXhtml) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${BOOK_LANG}" lang="${BOOK_LANG}">
<head>
<title>${xmlEscape(title)}</title>
<meta charset="utf-8" />
<link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
${bodyXhtml}
</body>
</html>
`;
}

/**
 * The cover page — title + subtitle + author + date. Plain XHTML
 * styled by `styles.css`'s `.cover` rules. Lives at `cover.xhtml`
 * and is the first spine entry.
 */
function coverXhtml(now) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${BOOK_LANG}" lang="${BOOK_LANG}">
<head>
<title>${xmlEscape(BOOK_TITLE)}</title>
<meta charset="utf-8" />
<link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body class="cover-body">
<section class="cover">
  <div class="cover-eyebrow">Practitioner's guide</div>
  <h1 class="cover-title">${xmlEscape(BOOK_TITLE)}</h1>
  <div class="cover-subtitle">${xmlEscape(BOOK_SUBTITLE)}</div>
  <div class="cover-meta">
    <div>Generated ${now.toISOString().split('T')[0]}</div>
    <div>${xmlEscape(BOOK_PUBLISHER)}</div>
  </div>
</section>
</body>
</html>
`;
}

/**
 * EPUB 3 navigation document. Replaces the legacy `toc.ncx` for
 * EPUB 3 readers but we include both for maximum compatibility.
 */
function navXhtml(chapters) {
  const groupedItems = TOC_GROUPS.map((group) => {
    const items = chapters.filter(group.match);
    if (items.length === 0) return '';
    const lis = items
      .map((c, _idx) => {
        const chapterIdx = chapters.indexOf(c);
        return `      <li><a href="chapter-${String(chapterIdx).padStart(2, '0')}.xhtml">${xmlEscape(
          c.title
        )}</a></li>`;
      })
      .join('\n');
    return `  <li>${xmlEscape(group.label)}\n    <ol>\n${lis}\n    </ol>\n  </li>`;
  })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${BOOK_LANG}" lang="${BOOK_LANG}">
<head>
<title>Contents</title>
<meta charset="utf-8" />
<link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
<nav epub:type="toc" id="toc">
<h1>Contents</h1>
<ol>
${groupedItems}
</ol>
</nav>
</body>
</html>
`;
}

/**
 * Legacy EPUB 2 NCX navigation. Some older Kindle firmwares fall
 * back to this when the EPUB 3 nav is missing or malformed; cheap
 * insurance to ship both.
 */
function tocNcx(chapters) {
  const navPoints = chapters
    .map((c, idx) => {
      const num = String(idx).padStart(2, '0');
      return `<navPoint id="navPoint-${idx}" playOrder="${idx + 1}">
<navLabel><text>${xmlEscape(c.title)}</text></navLabel>
<content src="chapter-${num}.xhtml" />
</navPoint>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head>
<meta name="dtb:uid" content="${BOOK_ID}" />
<meta name="dtb:depth" content="1" />
<meta name="dtb:totalPageCount" content="0" />
<meta name="dtb:maxPageNumber" content="0" />
</head>
<docTitle><text>${xmlEscape(BOOK_TITLE)}</text></docTitle>
<navMap>
${navPoints}
</navMap>
</ncx>
`;
}

/**
 * The `content.opf` package document: metadata + manifest + spine.
 * EPUB readers parse this to learn the book's identity, the list
 * of files in the package, and the reading order.
 */
function contentOpf(chapters, images, now) {
  const dateIso = now.toISOString().split('T')[0];

  // Manifest: one item per file. Each item declares id + href +
  // media-type. The nav document carries `properties="nav"`.
  const manifestItems = [
    '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />',
    '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml" />',
    '<item id="styles" href="styles.css" media-type="text/css" />',
    '<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />',
  ];
  chapters.forEach((_c, idx) => {
    const num = String(idx).padStart(2, '0');
    manifestItems.push(
      `<item id="chapter-${num}" href="chapter-${num}.xhtml" media-type="application/xhtml+xml" />`
    );
  });
  for (const [href, meta] of images) {
    // EPUB IDs can't contain spaces or many punctuation marks; slug
    // the filename to a safe id. We don't reference these ids
    // anywhere else so the exact value doesn't matter, only that
    // it's valid + unique.
    const id = `img-${href.replace(/[^a-zA-Z0-9]+/g, '-')}`;
    manifestItems.push(`<item id="${id}" href="${xmlEscape(href)}" media-type="${meta.mime}" />`);
  }

  // Spine: reading order. Cover first, then chapters. Nav is
  // referenced via the `nav` property; it doesn't need to be in the
  // linear reading flow.
  const spineItems = ['<itemref idref="cover" />'];
  chapters.forEach((_c, idx) => {
    const num = String(idx).padStart(2, '0');
    spineItems.push(`<itemref idref="chapter-${num}" />`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${BOOK_LANG}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:identifier id="bookid">${BOOK_ID}</dc:identifier>
  <dc:title>${xmlEscape(BOOK_TITLE)}</dc:title>
  <dc:creator>${xmlEscape(BOOK_AUTHOR)}</dc:creator>
  <dc:language>${BOOK_LANG}</dc:language>
  <dc:publisher>${xmlEscape(BOOK_PUBLISHER)}</dc:publisher>
  <dc:date>${dateIso}</dc:date>
  <dc:description>${xmlEscape(BOOK_SUBTITLE)}</dc:description>
  <dc:subject>Theory of Constraints</dc:subject>
  <dc:subject>Causal reasoning</dc:subject>
  <dc:subject>TP Studio</dc:subject>
  <meta property="dcterms:modified">${now.toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
</metadata>
<manifest>
${manifestItems.join('\n')}
</manifest>
<spine toc="ncx">
${spineItems.join('\n')}
</spine>
</package>
`;
}

/**
 * The container.xml at META-INF/container.xml — the EPUB entry-point
 * that tells the reader where to find the OPF package.
 */
const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`;

/**
 * Book stylesheet — adapted from the PDF's print-targeted CSS to
 * reflow-friendly screen styles. EPUB readers reflow text; fixed-pt
 * sizes are converted to relative units. We keep the visual
 * hierarchy (heading sizes relative to body) and call-out styling
 * (blockquote sidebars, code blocks, tables) so the reading
 * experience tracks the PDF.
 */
const EPUB_STYLESHEET = `
body {
  font-family: serif;
  font-size: 1em;
  line-height: 1.5;
  margin: 0;
  padding: 0;
  color: #1f2937;
}

/* Cover page — sized to whatever the reader gives us. */
.cover-body { text-align: center; }
.cover { padding: 2em 1em; }
.cover-eyebrow {
  font-family: sans-serif;
  font-size: 0.75em;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6366f1;
  font-weight: 600;
  margin-bottom: 2em;
}
.cover-title {
  font-family: sans-serif;
  font-size: 2.4em;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 1em 0;
  color: #111827;
}
.cover-subtitle {
  font-size: 1.1em;
  line-height: 1.45;
  color: #4b5563;
  font-style: italic;
  margin-bottom: 2em;
}
.cover-meta {
  font-size: 0.7em;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}
.cover-meta div + div { margin-top: 0.3em; }

/* Chapter content */
h1 {
  font-family: sans-serif;
  font-size: 1.8em;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #111827;
  margin: 1em 0 0.2em 0;
  page-break-before: always;
}
h1 + h3 {
  font-family: sans-serif;
  font-size: 1.1em;
  font-weight: 500;
  font-style: italic;
  color: #6b7280;
  margin: 0 0 1.2em 0;
}
h2 {
  font-family: sans-serif;
  font-size: 1.4em;
  font-weight: 700;
  color: #111827;
  margin: 1.5em 0 0.5em 0;
}
h3 {
  font-family: sans-serif;
  font-size: 1.15em;
  font-weight: 700;
  color: #1f2937;
  margin: 1.2em 0 0.4em 0;
}
p {
  margin: 0 0 0.8em 0;
  text-align: justify;
  hyphens: auto;
}
ul, ol {
  margin: 0 0 0.8em 0;
  padding-left: 1.5em;
}
li { margin: 0.15em 0; }
strong { color: #111827; font-weight: 700; }
em { color: #1f2937; }
code {
  font-family: monospace;
  font-size: 0.9em;
  background: #f3f4f6;
  border-radius: 3px;
  padding: 0.05em 0.3em;
  color: #be185d;
}
pre {
  font-family: monospace;
  font-size: 0.85em;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 3px;
  padding: 0.8em;
  margin: 0 0 1em 0;
  white-space: pre-wrap;
}
pre code {
  background: transparent;
  padding: 0;
  color: #1f2937;
}
blockquote {
  border-left: 3px solid #6366f1;
  background: #f5f3ff;
  padding: 0.8em 1.2em;
  margin: 0 0 1em 0;
  color: #4b5563;
  font-style: italic;
  border-radius: 0 3px 3px 0;
}
blockquote p { margin: 0 0 0.5em 0; }
blockquote p:last-child { margin-bottom: 0; }
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 1em 0;
  font-size: 0.9em;
}
th, td {
  border: 1px solid #e5e7eb;
  padding: 0.4em 0.6em;
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
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  margin: 0.8em 0;
  display: block;
}
hr {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.5em 0;
}
a {
  color: #6366f1;
  text-decoration: none;
}

${CLR_MAP_CSS}
`;

async function main() {
  console.log(`📖 Building Causal-Thinking-with-TP-Studio.epub …`);

  const chapters = await readChapterMetadata();
  console.log(`  ${chapters.length} chapters discovered`);

  const screenshotFiles = await readdir(SCREENSHOTS_DIR).catch(() => []);
  console.log(`  ${screenshotFiles.length} screenshots available`);

  // Render each chapter and collect referenced image paths so we
  // only embed the assets we actually need.
  const embeddedImages = new Set();
  const chapterBodies = await Promise.all(
    chapters.map(async (c) => chapterToXhtml(c.slug, c.raw, embeddedImages))
  );
  console.log(`  ${embeddedImages.size} images referenced`);

  const imageMap = await collectImages(embeddedImages);
  console.log(`  ${imageMap.size} images resolved + ready to embed`);

  const now = new Date();
  const zip = new JSZip();

  // CRITICAL: `mimetype` must be (a) the first entry in the ZIP, and
  // (b) STORE-compressed (uncompressed). EPUB validators reject
  // archives where mimetype is DEFLATE-compressed or appears after
  // other entries. JSZip preserves insertion order; the
  // `compression: 'STORE'` flag pins it to uncompressed.
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', CONTAINER_XML);

  // OEBPS package
  zip.file('OEBPS/content.opf', contentOpf(chapters, imageMap, now));
  zip.file('OEBPS/nav.xhtml', navXhtml(chapters));
  zip.file('OEBPS/toc.ncx', tocNcx(chapters));
  zip.file('OEBPS/styles.css', EPUB_STYLESHEET);
  zip.file('OEBPS/cover.xhtml', coverXhtml(now));

  chapters.forEach((c, idx) => {
    const num = String(idx).padStart(2, '0');
    zip.file(`OEBPS/chapter-${num}.xhtml`, chapterDocument(c.slug, c.title, chapterBodies[idx]));
  });

  for (const [href, meta] of imageMap) {
    zip.file(`OEBPS/${href}`, meta.buf);
  }

  console.log(`  packaging EPUB…`);
  const buf = await zip.generateAsync({
    type: 'nodebuffer',
    // DEFLATE (the EPUB default for non-mimetype files) keeps the
    // file size down — important for Send-to-Kindle's 50 MB cap.
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  await writeFile(OUT_PATH, buf);
  console.log(`✓ Wrote ${OUT_PATH} (${(buf.length / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
