#!/usr/bin/env node
/**
 * Session 111 — Build the in-app docs bundle.
 *
 *   Inputs:
 *     - docs/guide/Causal-Thinking-with-TP-Studio.pdf  (book — binary)
 *     - NOTICE.md                                       (trademarks)
 *     - SECURITY.md                                     (threat model)
 *     - USER_GUIDE.md                                   (feature reference)
 *
 *   Outputs (all into `public/`, which Vite copies into `dist/` at build time):
 *     - public/Causal-Thinking-with-TP-Studio.pdf       (book PDF, ~1 MB)
 *     - public/notices.html
 *     - public/security.html
 *     - public/user-guide.html
 *
 * The About TP Studio dialog (`src/components/about/AboutDialog.tsx`)
 * links to all four URLs. By bundling them into the Vite output rather
 * than linking to GitHub raw URLs we:
 *   1. Keep all in-app links on the branded subdomain
 *      (tp-studio.struktureretsundfornuft.dk) — no leak to github.com.
 *   2. Let the service worker cache the docs for offline reading.
 *
 * The HTML pages use a minimal book-styled shared stylesheet so they
 * render cleanly without depending on the main app bundle. Each page
 * carries a small "Back to TP Studio" link in the header.
 *
 * Run via `pnpm prebuild` (wired in package.json), or directly with
 * `node ./scripts/build-docs-bundle.mjs` for a local refresh.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const PUBLIC_DIR = join(REPO_ROOT, 'public');
const GUIDE_DIR = join(REPO_ROOT, 'docs', 'guide');

const BOOK_PDF = join(GUIDE_DIR, 'Causal-Thinking-with-TP-Studio.pdf');

const HTML_PAGES = [
  {
    source: join(REPO_ROOT, 'NOTICE.md'),
    output: join(PUBLIC_DIR, 'notices.html'),
    title: 'Notices — TP Studio',
    h1: 'Third-party notices',
  },
  {
    source: join(REPO_ROOT, 'SECURITY.md'),
    output: join(PUBLIC_DIR, 'security.html'),
    title: 'Security — TP Studio',
    h1: 'Security',
  },
  {
    source: join(REPO_ROOT, 'USER_GUIDE.md'),
    output: join(PUBLIC_DIR, 'user-guide.html'),
    title: 'User Guide — TP Studio',
    h1: 'User Guide',
  },
];

/**
 * Book-flavored CSS. Same look-and-feel direction as the practitioner
 * guide PDF — neutral typography, generous line-height, dark-mode
 * friendly via `prefers-color-scheme`. Self-contained: no Tailwind, no
 * external fonts.
 */
const STYLES = `
  :root {
    --bg: #ffffff;
    --fg: #18181b;
    --muted: #71717a;
    --accent: #6366f1;
    --border: #e4e4e7;
    --code-bg: #f4f4f5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0a0a0a;
      --fg: #fafafa;
      --muted: #a1a1aa;
      --accent: #818cf8;
      --border: #27272a;
      --code-bg: #18181b;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.65;
    font-size: 16px;
    padding: 2rem 1.25rem 4rem;
  }
  main { max-width: 44rem; margin: 0 auto; }
  header.page-header {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: 1rem; margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  header.page-header a.back {
    font-size: 0.875rem; color: var(--accent); text-decoration: none;
  }
  header.page-header a.back:hover { text-decoration: underline; }
  header.page-header .brand { font-size: 0.875rem; color: var(--muted); }
  h1 { font-size: 1.75rem; margin: 0 0 1rem; letter-spacing: -0.02em; }
  h2 { font-size: 1.25rem; margin: 2rem 0 0.75rem; letter-spacing: -0.01em; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 0.5rem; }
  p, ul, ol { margin: 0 0 1rem; }
  ul, ol { padding-left: 1.5rem; }
  li { margin-bottom: 0.35rem; }
  a { color: var(--accent); }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 0.25rem;
    font-size: 0.9em;
  }
  pre {
    background: var(--code-bg); padding: 0.9rem 1rem; border-radius: 0.5rem;
    overflow-x: auto; font-size: 0.875rem; line-height: 1.5;
  }
  pre code { background: transparent; padding: 0; }
  blockquote {
    border-left: 3px solid var(--accent); padding: 0.1rem 1rem;
    margin: 1rem 0; color: var(--muted);
  }
  table { border-collapse: collapse; margin: 1rem 0; font-size: 0.93rem; }
  th, td { border: 1px solid var(--border); padding: 0.4rem 0.7rem; text-align: left; }
  th { background: var(--code-bg); }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  footer {
    margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border);
    color: var(--muted); font-size: 0.85rem;
  }
`;

function renderPage({ title, h1, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${STYLES}</style>
</head>
<body>
  <main>
    <header class="page-header">
      <a href="/" class="back">← Back to TP Studio</a>
      <span class="brand">TP Studio</span>
    </header>
    <h1>${h1}</h1>
    ${bodyHtml}
    <footer>
      Rendered from the canonical Markdown in the TP Studio repo.
      For the source, open <code>${h1.toLowerCase().replace(/[^a-z]/g, '-')}.md</code> in the repository.
    </footer>
  </main>
</body>
</html>`;
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function buildHtmlPage({ source, output, title, h1 }) {
  const md = readFileSync(source, 'utf8');
  // Strip the leading H1 from the source markdown if present — the
  // wrapper template already emits one, and a double H1 would hurt
  // both visuals and screen-reader navigation.
  const stripped = md.replace(/^# .+?\n+/, '');
  const bodyHtml = marked.parse(stripped, { mangle: false, headerIds: true });
  const html = renderPage({ title, h1, bodyHtml });
  writeFileSync(output, html, 'utf8');
}

function copyBookPdf() {
  const dest = join(PUBLIC_DIR, 'Causal-Thinking-with-TP-Studio.pdf');
  copyFileSync(BOOK_PDF, dest);
}

function main() {
  ensureDir(PUBLIC_DIR);
  console.log('📚 Building in-app docs bundle …');
  copyBookPdf();
  console.log('  ✓ Copied book PDF');
  for (const page of HTML_PAGES) {
    buildHtmlPage(page);
    console.log(`  ✓ Rendered ${page.output.replace(REPO_ROOT, '.')}`);
  }
  console.log('Done.');
}

main();
