import { DIAGRAM_TYPE_LABEL, resolveEntityTypeMeta } from './entityTypeMeta';
import { structuralEntities } from './graph';
import type { Entity, TPDocument } from './types';
import { verbalisedECText } from './verbalisation';

/**
 * Session 77 / brief §11 — Self-contained HTML viewer.
 *
 * Generates a single `.html` file that:
 *   - Renders the document read-only (no editing affordances).
 *   - Inlines all CSS and JS so the file works offline / behind a
 *     firewall / shared via email.
 *   - Embeds the JSON document so a future "edit this snapshot in TP
 *     Studio" round-trip path can lift the data back out.
 *   - For EC docs, surfaces the verbalisation form and lists the
 *     assumptions under each arrow.
 *
 * The current implementation is a *minimal* viewer — entity titles
 * laid out in a CSS grid that mirrors the diagram's logical structure
 * (Goal Tree as a top-down list; EC as the 5-box layout; CRT as a
 * topologically-sorted bottom-up list). A future polish item would
 * render the diagram with React Flow in a Suspense-mounted iframe; for
 * v1 the readable structured view is enough.
 *
 * Pure function: no DOM, no network, framework-free. The service-layer
 * exporter wraps the output in a `Blob` and triggers a download.
 */

/** Escape user text for safe HTML insertion. The output is consumed as
 *  `innerHTML` in the viewer, so untrusted titles get HTML-encoded. */
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Inline CSS, intentionally tiny — the viewer reuses Tailwind-ish
 *  conventions but stays self-contained so the file works in any
 *  browser without bundler trickery. */
const VIEWER_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #171717;
    background: #fafafa;
    line-height: 1.5;
  }
  header { padding: 24px 32px; border-bottom: 1px solid #e5e5e5; background: white; }
  header h1 { margin: 0; font-size: 22px; }
  header .meta { color: #737373; font-size: 13px; margin-top: 4px; }
  header .badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    background: #eef2ff; color: #4338ca; font-size: 11px; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.05em; margin-right: 8px;
  }
  main { padding: 24px 32px; max-width: 960px; margin: 0 auto; }
  section { margin: 24px 0; }
  section h2 {
    font-size: 13px; font-weight: 600; color: #737373; text-transform: uppercase;
    letter-spacing: 0.05em; margin: 0 0 12px;
  }
  .entity {
    display: flex; gap: 12px; padding: 10px 14px; border: 1px solid #e5e5e5;
    border-radius: 8px; background: white; margin-bottom: 6px;
  }
  .entity .stripe { width: 4px; border-radius: 2px; }
  .entity .body { flex: 1; }
  .entity .type {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.05em; color: #737373;
  }
  .entity .title { font-weight: 500; margin-top: 2px; }
  .entity .desc { font-size: 13px; color: #525252; margin-top: 4px; white-space: pre-wrap; }
  .verbal {
    background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px;
    padding: 12px 16px; font-style: italic; color: #44403c;
  }
  .verbal strong { color: #1c1917; font-weight: 600; font-style: normal; }
  .assumption {
    display: flex; gap: 8px; align-items: baseline; padding: 6px 10px;
    background: #f5f3ff; border-left: 3px solid #8b5cf6; border-radius: 4px;
    margin: 4px 0;
  }
  .assumption .status {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 1px 4px; border-radius: 3px;
  }
  .assumption .status.unexamined { background: #e5e5e5; color: #525252; }
  .assumption .status.valid { background: #fef3c7; color: #92400e; }
  .assumption .status.invalid { background: #fee2e2; color: #b91c1c; }
  .assumption .status.challengeable { background: #dbeafe; color: #1d4ed8; }
  .footer {
    border-top: 1px solid #e5e5e5; padding: 16px 32px; color: #a3a3a3;
    font-size: 11px; text-align: center;
  }
  .footer a { color: #6366f1; text-decoration: none; }
`;

const renderEntity = (e: Entity, doc: TPDocument): string => {
  const meta = resolveEntityTypeMeta(e.type, doc.customEntityClasses);
  return `<div class="entity">
    <div class="stripe" style="background:${escapeHtml(meta.stripeColor)}"></div>
    <div class="body">
      <div class="type">${escapeHtml(meta.label)}${e.ecSlot ? ` · slot ${escapeHtml(e.ecSlot)}` : ''} · #${e.annotationNumber}</div>
      <div class="title">${e.title ? escapeHtml(e.title) : '<em style="color:#a3a3a3">(empty)</em>'}</div>
      ${e.description ? `<div class="desc">${escapeHtml(e.description)}</div>` : ''}
    </div>
  </div>`;
};

const renderEntityList = (doc: TPDocument): string => {
  const list = structuralEntities(doc)
    .slice()
    .sort((a, b) => a.annotationNumber - b.annotationNumber)
    .map((e) => renderEntity(e, doc))
    .join('\n');
  return `<section><h2>Entities</h2>${list || '<p style="color:#a3a3a3;font-style:italic">No entities.</p>'}</section>`;
};

const renderECVerbal = (doc: TPDocument): string => {
  if (doc.diagramType !== 'ec') return '';
  const text = verbalisedECText(doc);
  return `<section><h2>Verbalisation</h2><div class="verbal">${escapeHtml(text)}</div></section>`;
};

const renderAssumptions = (doc: TPDocument): string => {
  const list = Object.values(doc.assumptions ?? {});
  if (list.length === 0) return '';
  const rows = list
    .map((a) => {
      const status = escapeHtml(a.status);
      return `<div class="assumption">
        <span class="status ${status}">${status}</span>
        <span>${a.text ? escapeHtml(a.text) : '<em style="color:#a3a3a3">(empty)</em>'}</span>
      </div>`;
    })
    .join('\n');
  return `<section><h2>Assumptions (${list.length})</h2>${rows}</section>`;
};

const renderInjections = (doc: TPDocument): string => {
  const injections = Object.values(doc.entities).filter((e) => e.type === 'injection');
  if (injections.length === 0) return '';
  const rows = injections.map((e) => renderEntity(e, doc)).join('\n');
  return `<section><h2>Injections (${injections.length})</h2>${rows}</section>`;
};

/** Build the full HTML viewer document for `doc`. Returns a string
 *  ready to be wrapped in a `Blob` and downloaded as `<title>.html`. */
export const exportToSelfContainedHTML = (doc: TPDocument): string => {
  const title = doc.title || 'Untitled';
  const diagramLabel = DIAGRAM_TYPE_LABEL[doc.diagramType];
  const author = doc.author ? `<span> · ${escapeHtml(doc.author)}</span>` : '';
  const stamp = new Date().toISOString().slice(0, 10);
  // The doc payload is embedded as JSON so a future "edit in TP
  // Studio" round-trip can extract it. Base64-encoded to dodge
  // </script> token issues in the user's data. `btoa` is available in
  // every modern browser + Node ≥ 16 (the test runtime), so we lean
  // on it directly. The `unescape(encodeURIComponent(...))` dance
  // handles non-ASCII titles safely.
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(doc))));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — TP Studio</title>
<meta name="generator" content="TP Studio self-contained viewer" />
<style>${VIEWER_CSS}</style>
</head>
<body>
<header>
  <div><span class="badge">${escapeHtml(diagramLabel)}</span></div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Read-only view · ${escapeHtml(stamp)}${author}</div>
  ${doc.description ? `<p style="margin-top:12px;color:#404040">${escapeHtml(doc.description)}</p>` : ''}
</header>
<main>
  ${renderECVerbal(doc)}
  ${renderEntityList(doc)}
  ${renderAssumptions(doc)}
  ${renderInjections(doc)}
</main>
<footer class="footer">
  Generated by <a href="#" onclick="return false;">TP Studio</a> · Self-contained · No network calls
</footer>
<script type="application/json" id="tp-studio-doc">${payload}</script>
</body>
</html>
`;
};
