import DOMPurify from 'dompurify';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

/**
 * Markdown → safe HTML renderer for entity / document / edge descriptions.
 *
 * Pipeline:
 *   1. `micromark` parses with GFM extensions (autolinks, strikethrough,
 *      task lists, tables). Smaller and tree-shakeable vs. `marked`.
 *   2. `DOMPurify` strips anything risky (script tags, on* handlers, dangerous
 *      URI schemes) before the HTML hits the DOM.
 *   3. Post-process anchors so links open in a new tab safely AND so internal
 *      entity references (`#entity:ID` or `#N`) carry a `data-entity-ref`
 *      attribute that the click delegator in the inspector can intercept.
 *
 * Returns the HTML string. The caller passes it to React via
 * `dangerouslySetInnerHTML` — safe because DOMPurify already sanitized.
 */
export const renderMarkdown = (src: string): string => {
  if (!src) return '';

  const raw = micromark(src, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
    allowDangerousHtml: false,
  });

  // Sanitize with permissive defaults so common markdown output (anchors,
  // lists, emphasis, tables, code, headings) still renders. Disallow custom
  // attributes that could leak XSS.
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p',
      'a',
      'strong',
      'em',
      'code',
      'pre',
      'blockquote',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'br',
      'hr',
      'del',
      'input',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
    ],
    ALLOWED_ATTR: [
      'href',
      'title',
      'type',
      'checked',
      'disabled',
      'data-entity-ref',
      'target',
      'rel',
    ],
  });

  // FL-AN5: Annotate anchor tags. External links open in a new tab safely;
  // internal entity references (`#entity:ID` or `#N` where N is an annotation
  // number) get rewritten with a `data-entity-ref` attribute that the
  // click delegator can intercept.
  return postProcessAnchors(clean);
};

/**
 * Post-process the sanitized HTML to:
 *   - add `target="_blank" rel="noopener noreferrer"` to external anchors
 *   - swap internal-reference hrefs (`#entity:ID` or `#42`) for a sentinel
 *     `data-entity-ref` attribute so the click handler can dispatch to the
 *     selection without the browser doing its own anchor-jump
 *
 * Implemented via a parser pass on a detached document fragment — cheaper
 * than string regex, and DOMPurify already gave us safe HTML to walk.
 */
const postProcessAnchors = (html: string): string => {
  if (!html.includes('<a')) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  for (const a of Array.from(tpl.content.querySelectorAll('a'))) {
    const href = a.getAttribute('href') ?? '';
    const refMatch = /^#entity:(.+)$/.exec(href);
    const numericRefMatch = /^#(\d+)$/.exec(href);
    if (refMatch?.[1]) {
      a.setAttribute('data-entity-ref', refMatch[1]);
      a.removeAttribute('href');
    } else if (numericRefMatch?.[1]) {
      a.setAttribute('data-entity-ref', `#${numericRefMatch[1]}`);
      a.removeAttribute('href');
    } else if (/^[a-z]+:/i.test(href) || href.startsWith('//')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  }
  return tpl.innerHTML;
};
