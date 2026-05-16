# TP Studio — Security

This document describes TP Studio's threat model, the mitigations in
place, known limitations, and how to report a vulnerability. It is
written for someone reviewing the app for production use inside a
business — and for future maintainers landing security-relevant
changes (so the trade-offs already considered don't have to be
re-derived from scratch).

Last reviewed: Session 98 (2026-05-15) — see CHANGELOG for the full
history.

---

## 1. What TP Studio is

A single-page PWA for drawing Theory of Constraints diagrams:
Evaporating Clouds, Current Reality Trees, Goal Trees, etc.

- Pure client app. No backend, no auth, no telemetry, no analytics.
- All persistence is `localStorage` on the user's own device.
- The app is served as static files from GitHub Pages and an Apex
  CNAME at https://tp-studio.struktureretsundfornuft.dk/.
- A service worker pre-caches the static bundle so the app works
  offline. The SW never proxies user data anywhere.
- There is no signup, no account, no server-side session. The same
  bundle is delivered to every visitor.

What that means for the threat model: TP Studio is closer to a
calculator-shaped local app than a SaaS. The valuable asset is the
user's own diagram and the integrity of the bundle they downloaded;
there is no central data store to breach.

## 2. Trust boundaries

There are three places untrusted data can enter the app:

| # | Boundary                | Entered by                                           | Trust level |
|---|-------------------------|------------------------------------------------------|-------------|
| 1 | User chat input         | Entity titles, descriptions, group labels, etc.      | Untrusted, but only the same user can see it |
| 2 | Imported documents      | JSON / CSV / Mermaid / FlyingLogic file uploads      | Untrusted — can come from anywhere |
| 3 | Share-link URL fragment | `#!share=<gzipped JSON>` pasted from outside         | Untrusted — anyone with the link can hand-craft the fragment |

The boundaries the app is **not** crossing:

- No third-party scripts, fonts, analytics, ads, or CDNs.
- No outbound `fetch()` to any other origin.
- No server-side state — there is no database to inject into and no
  account to take over.

Because every input source above only ever affects the rendering
user's own session, the worst a hostile payload can do is harm the
user that loaded it (e.g. crash their tab, render malicious
markdown). It cannot pivot to other users.

## 3. Mitigations in place

### 3.1 Content Security Policy

`index.html` ships a `<meta http-equiv="Content-Security-Policy">`
header that pins the app to its own origin:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; connect-src 'self'; font-src 'self';
manifest-src 'self'; worker-src 'self'; object-src 'none';
base-uri 'self'; form-action 'none'
```

- `script-src 'self'` — no inline scripts; no external CDN scripts
  can be loaded even if injected.
- `style-src 'self' 'unsafe-inline'` — React Flow writes
  `style="transform:..."` on pan/zoom, so inline styles are
  required. Inline styles do **not** widen `script-src`.
- `connect-src 'self'` — even if an XSS escapes other mitigations,
  it cannot exfiltrate the document to a third-party endpoint.
- `object-src 'none'`, `base-uri 'self'`, `form-action 'none'` —
  shut common XSS escalation paths.

### 3.2 Markdown sanitization

Entity descriptions and group descriptions support Markdown. The
pipeline is:

1. `micromark` + `micromark-extension-gfm` parses Markdown to HTML.
2. `DOMPurify` sanitizes the HTML with a conservative allow-list.
3. The sanitized HTML is injected via `dangerouslySetInnerHTML`.

`DOMPurify` drops `<script>`, event handlers (`onclick=` etc.),
`javascript:` URLs, and similar XSS vectors by default. Markdown
links must use a safe scheme; the renderer does not auto-add
`target="_blank"` (no `rel="opener"` exposure).

### 3.3 SVG / HTML export sanitization

The static-HTML viewer export (`htmlExport.ts`) renders the diagram
into a self-contained HTML file. Entity titles are inserted as text
nodes (escaped) rather than as innerHTML; descriptions go through
the same DOMPurify-sanitized HTML pipeline as the live app. The
viewer is a passive read-only renderer with no scripts of its own.

### 3.4 Share-link payload defenses

Share links encode the document into the URL fragment as gzip +
URL-safe-base64. The decode path enforces three defenses:

1. **Hard cap on decompressed size**
   (`SHARE_LINK_MAX_DECOMPRESSED_BYTES = 5 MB`). A tiny gzip payload
   can expand to gigabytes (the "zip bomb" pattern); without a cap,
   `Response.text()` would happily allocate the whole stream and
   crash the tab. The decoder reads chunks and aborts when total
   bytes exceed the ceiling. The cap is 40× the largest realistic
   diagram.

2. **JSON-schema validation**
   (`importFromJSON` → `validateAndNormalizeDoc`). The decompressed
   text must parse as JSON and match the expected document shape
   (entities, edges, diagramType, etc.). Unexpected fields are
   stripped; missing required fields cause a hard reject.

3. **Browse Lock auto-engages**. After a successful share-link load,
   Browse Lock is turned on so the receiver cannot accidentally
   commit edits to the foreign document. The user must explicitly
   toggle the lock off to make changes.

### 3.5 Browse Lock authorization

Mutating commands wrap their handlers in `withWriteGuard()`. When
Browse Lock is on, the guard surfaces a toast and refuses to apply
the change. The Selection Toolbar also hides write-verbs while
Browse Lock is on so write affordances disappear instead of
greying-out.

This is a UX guardrail, not a privilege boundary — there is only
one user. But it makes accidental edits to share-linked or
example-loaded documents harder.

### 3.6 Dependency hygiene

- `pnpm audit --prod` is clean as of Session 98 (was 19
  vulnerabilities in `jspdf` 2.5.2; fixed by bumping to 4.2.1).
- All dependencies are pinned via `pnpm-lock.yaml`.
- The build is deterministic from the lockfile.
- No dependencies load remote code at runtime.

### 3.7 Repo / supply-chain hygiene

- No `.env` files committed; the app has no secrets to keep.
- GitHub Actions runs against pinned action versions.
- The `gh-pages` deploy step uploads from `dist/` only, not source.
- `simple-git-hooks` runs `lint-staged` pre-commit; commits without
  passing Biome are rejected locally.

## 4. Known limitations

These are gaps the maintainer has thought about and accepted, with
the reasoning recorded so the trade-off isn't re-litigated:

- **`frame-ancestors` cannot be set via `<meta>`.** Per the CSP
  spec, `frame-ancestors` only works as an HTTP header. GitHub
  Pages does not let us set arbitrary response headers, so embedding
  the app in a hostile iframe (clickjacking) is best-effort
  defended. Since the app has no auth or destructive remote actions,
  the clickjacking attack surface is small — the worst an attacker
  can achieve is tricking the user into editing their own local
  document.

- **`style-src 'unsafe-inline'`.** React Flow's pan/zoom relies on
  inline `style="transform: ..."`. Dropping `'unsafe-inline'` would
  break canvas interaction. Inline styles cannot execute scripts;
  the relaxation does not affect `script-src`.

- **No SRI (subresource integrity) on the bundle.** Vite splits the
  app into many chunks; SRI would require generating hashes for
  each. The bundle is same-origin so this is one defense-in-depth
  layer we have not adopted.

- **`localStorage` is per-origin, not per-user.** Anyone with
  physical access to the browser can read or tamper with stored
  documents. This is the standard web-app trust model; users with
  sensitive diagrams should treat the browser profile the same as
  any other local document store.

- **Test hook in production bundle**. The `__TP_TEST__` global is
  only installed when the URL carries `?test=1`. It exposes
  helpers for Playwright to drive the canvas. Even with the URL
  flag set, the hooks only operate against the same-tab Zustand
  store — they cannot exfiltrate data or affect other tabs.

## 5. Reporting a vulnerability

TP Studio is an open-source side project. If you find a security
issue, please:

1. **Do not file a public GitHub issue.**
2. Email the maintainer (Dann Pedersen) directly — see the GitHub
   profile linked from the repo for current contact.
3. Include a description, reproduction steps, and (if known) the
   affected version / commit SHA.

The maintainer aims to acknowledge reports within 7 days. Because
the app has no backend and no users to notify, the remediation path
is: fix on `main` → push → CI green → deployed via GitHub Pages
automatically. Disclosure happens in CHANGELOG and a release tag.

## 6. Audit history

- **Session 98 (2026-05-15)** — Full 12-area security audit. Findings:
  - **P0 (fixed)** — 19 CVEs in `jspdf` 2.5.2 (2 critical: Local
    File Inclusion + HTML Injection in New Window). Resolved by
    bumping to 4.2.1.
  - **P1 (fixed)** — No CSP. Added meta-tag policy locking the app
    to same-origin.
  - **P1 (fixed)** — Unbounded decompression in `parseShareHash`.
    Added 5 MB ceiling with chunked-read enforcement.
  - **P2 (deferred)** — Inert `<a href="#" onclick="return false;">`
    in the exported HTML viewer. Looks like an event handler to a
    skim audit but is functionally equivalent to a `<span>`. Will
    be cleaned up opportunistically.
