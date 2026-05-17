# Authoring notes — *Causal Thinking with TP Studio*

How the book stays in sync with the application as TP Studio evolves. Aimed at whoever (Claude, a contributor, future-Dann) sits down to update a chapter after a UI change.

## Layout

```
docs/guide/
├── README.md              ← TOC + reading paths (public face)
├── AUTHORING.md           ← this file (maintainer face)
├── 00-foreword.md
├── 01-…  through  17-…   ← chapter files, one per chapter
├── appendix-a-…  through  appendix-f-…
└── screenshots/           ← generated PNGs, committed
    ├── crt-step-3-first-effect.png
    ├── ec-wizard-step-2.png
    └── …
```

Every chapter file is a self-contained Markdown document. Cross-references between chapters use relative links (`[Chapter 4](04-current-reality-tree.md)`); screenshot embeds use relative paths from the chapter file (`![…](screenshots/…)`).

## Screenshot pipeline

Screenshots are not hand-captured. They're produced by `e2e/guide-screenshots.spec.ts`, a Playwright spec that drives the production-built app deterministically via the `__TP_TEST__` hook and the same keyboard / palette gestures the book describes.

### How a screenshot is born

1. **Manuscript** — chapter text says "Now your canvas looks like this:" and embeds `![…](screenshots/crt-step-3-first-effect.png)`. The PNG doesn't exist yet.
2. **Spec** — a corresponding `test('crt-step-3-first-effect', …)` block in `e2e/guide-screenshots.spec.ts` performs whatever gestures the book describes up to that point and calls `expect(page).toHaveScreenshot('crt-step-3-first-effect.png', { … })`.
3. **Workflow** — triggering the `Update visual snapshots` GitHub Action runs all `e2e/visual-*.spec.ts` AND `e2e/guide-screenshots.spec.ts` with `--update-snapshots`, captures every PNG, commits them via PR.
4. **Merge** — the baseline PR's PNGs land under `docs/guide/screenshots/`, the manuscript embeds resolve, the book is reproducible.

The same Playwright spec also acts as **a regression test for the book's gestures**: if a future UI change breaks the path described in Chapter 4 (e.g., a palette command renamed, a button moved), the spec fails in regular CI long before any reader hits it. This is the value of generating screenshots from a real driver, not Photoshopping them.

### Where the PNGs live

`docs/guide/screenshots/*.png`. Deliberately a separate directory from `e2e/visual-*.spec.ts-snapshots/`:

- `e2e/visual-*.spec.ts-snapshots/` is regression baselines. Every PNG there represents "this is what the app should look like in this scenario." A pixel diff fails CI.
- `docs/guide/screenshots/` is pedagogical illustrations. Same machinery, but failures here mean "the book's instructions no longer produce the screenshot they describe" — different failure mode, different repair path (update the book OR update the spec).

The two directories don't overlap; the book doesn't reuse regression baselines. This keeps each system honest about what it's pinning.

### Naming convention

`<chapter-slug>-<scene-slug>.png`. Examples:

- `chapter02-empty-canvas.png`
- `chapter04-crt-step-2-after-first-ude.png`
- `chapter04-crt-final-with-and-group.png`
- `chapter05-ec-wizard-step-3.png`
- `chapter13-clr-walkthrough-resolve.png`

Hyphen-separated lowercase. The `chapterNN-` prefix makes alphabetical ordering match the book's flow, which matters when a maintainer scrolls `docs/guide/screenshots/` to verify completeness.

## How to refresh after a UI change

1. **Identify what changed.** A palette command renamed? A button moved? Default theme tweaked? Note which chapter(s) and screenshot(s) might be affected.
2. **Run `Update visual snapshots`** (manual workflow_dispatch on the GitHub Actions tab). It runs the guide spec under `--update-snapshots` and opens a PR with whatever PNGs changed.
3. **Review the PR's diff.** GitHub renders before/after for image files. For each changed PNG, decide: is the new screenshot a faithful render of the same scene the book describes, or does the book also need a text update?
4. **If text needs updating too:** make a follow-up commit on the same PR branch updating the chapter file(s). Workflow already opened the branch; you can push to it directly.
5. **Merge.** Book stays in sync.

The whole loop is one workflow click + one PR review for most UI changes.

## How to add a new chapter or scene

1. Write the chapter content first, with screenshot embeds referencing files that don't exist yet (Markdown gracefully shows the alt-text + a broken-image icon — readable in the meantime).
2. For each embed, add a `test()` block to `e2e/guide-screenshots.spec.ts` that performs the gestures the chapter describes and screenshots at the right moment. The spec is heavily commented; follow the existing pattern.
3. Trigger the refresh workflow. New PNGs land in the same baseline PR pattern.
4. Done.

## Voice and conventions

- **Method first, tool second.** Each chapter is structured around a TOC question (UDE, conflict, root cause, etc.). TP Studio is the implementation, not the subject.
- **Present tense, second person.** "You click", "you see", "your canvas looks like".
- **Verbalisation discipline.** Read aloud anything you ask the reader to read. The TOC tradition treats verbalisation as discipline; the book honours that.
- **Sidebars** — use the existing call-out blocks consistently:
  - **🎯 What this process is for** — opens each Part-2 chapter
  - **🛠 How TP Studio helps** — features called out with shortcut / palette path
  - **💡 Practitioner tip** — earned-from-experience nuance
  - **⚠ Common mistake** — pattern to watch for in your own work
  - **🛑 When to stop** — criteria for "this diagram is done"
  - **🔁 Chain to next** — at chapter end, signpost to the natural next chapter
- **Plain Markdown.** No HTML, no MDX. The book renders identically on GitHub web, in VS Code preview, and via any static-site generator pointed at the directory.

## Building the PDF

A single-file PDF of the entire book is committed at
`docs/guide/Causal-Thinking-with-TP-Studio.pdf` for readers who want
one artifact rather than 24 Markdown files.

To regenerate after a manuscript edit (or after a screenshot
refresh):

```bash
pnpm book   # alias for `node ./scripts/build-book-pdf.mjs`
```

The script (`scripts/build-book-pdf.mjs`):
1. Reads `docs/guide/*.md` in canonical order (the order is
   hand-listed in the script so renaming a chapter doesn't silently
   change the book's flow).
2. Builds a cover page + a clickable TOC page (anchor links into
   each chapter).
3. Renders each chapter's Markdown to HTML via `marked`, rewriting
   relative `screenshots/...` paths to absolute `file://` URIs so
   Chromium can load them.
4. Concatenates everything into one self-contained HTML doc with
   print-grade CSS (A4, justified body, page-break-before on each
   H1).
5. Renders to PDF via Playwright's Chromium using `page.pdf({
   outline: true })`. The `outline: true` flag extracts the heading
   hierarchy into navigable PDF bookmarks — the sidebar in any
   PDF viewer. The TOC page's anchor links also work as clickable
   in-document jumps.

Requirements: `marked` + `@playwright/test` (both pinned as devDeps).
The Chromium binary must be installed locally — `pnpm exec
playwright install chromium` does this once.

Output: `docs/guide/Causal-Thinking-with-TP-Studio.pdf`. Typically
~1 MB with the 13 chapter screenshots embedded.

Commit the PDF after regenerating. Stakeholders link to the file
directly via GitHub Pages or download from the repo.

## Versioning

When TP Studio's schema version bumps (currently v7), or a major UI change lands, mark the affected chapter with a `> *Last reviewed against TP Studio v…*` note near the top. Helps readers calibrate whether the screenshots they see are current.
