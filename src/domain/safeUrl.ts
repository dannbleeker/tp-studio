/**
 * Keep hostile hrefs out of the document model and the DOM.
 *
 * User-supplied URLs (today: Evidence citation links) are rendered as
 * `<a href={url}>`. A `javascript:` URL — or `data:` / `vbscript:` — placed in
 * an IMPORTED or SHARED document would otherwise execute in the app's origin
 * the moment the user clicks the link. There is no backend, so a malicious
 * document is the threat model.
 *
 * We use a denylist of the script-/content-smuggling schemes rather than an
 * http(s)-only allowlist on purpose: the field is a free-form citation URL,
 * and users legitimately store scheme-less (`www.example.com`) or `mailto:`
 * values. A denylist neutralises the XSS vector without silently dropping
 * that legitimate data.
 *
 * Robustness note: browsers strip whitespace (tab / newline / CR) out of a
 * URL's scheme before acting on it, so a smuggled `java<TAB>script:` still
 * executes. We strip whitespace BEFORE testing the scheme so that form can't
 * slip past the prefix check. The original string is what gets stored and
 * rendered — only the test copy is sanitised.
 */
const DANGEROUS_SCHEME_RE = /^(?:javascript|data|vbscript|file):/i;

export const isSafeHref = (url: string): boolean => {
  const collapsed = url.replace(/\s+/g, '');
  return !DANGEROUS_SCHEME_RE.test(collapsed);
};
