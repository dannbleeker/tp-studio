# PDF/UA tagged-PDF accessibility — investigation

*Session 135. Research-only handoff; no code changed. Decides whether (and how) to make the book PDF a tagged, PDF/UA-conformant document for screen-reader navigation.*

## TL;DR

The book PDF is **not** tagged today, and the current toolchain (Chromium `page.pdf()` + pdf-lib post-process) **cannot** produce a tagged PDF — it has no structure-tree emitter. Getting PDF/UA means swapping the HTML→PDF renderer. Best fit is **Pandoc → Typst** or **Pandoc → WeasyPrint**, *not* the LaTeX route NEXT_STEPS guessed at — LaTeX tagging is still experimental and the heaviest install. **Recommended: defer.** EPUB already covers accessible reading, and a tagged PDF is a 1–2 session toolchain migration with real risk of regressing the layout/screenshots the current pipeline gets right.

## What "tagged PDF / PDF/UA" actually requires

A PDF/UA-1 (ISO 14289-1) document needs, at minimum:

1. `/MarkInfo << /Marked true >>` on the Catalog — declares the file is tagged.
2. A `/StructTreeRoot` — a tree of structure elements (`Document` → `H1` / `P` / `Figure` / `L`/`LI` / `Table`…) that maps every piece of marked content to a semantic role and a **reading order** independent of draw order.
3. `/Lang` (we have this — set on the Catalog in `postProcessPdf`).
4. Alt text on every `Figure` (the book's screenshots + the CLR map).
5. No content that's purely decorative leaking into the reading order (artifacts marked as such).

We currently emit **(3)** and navigable `/Outlines` + `/Dests` (bookmarks), plus full Info-dict metadata. Those help, but **bookmarks are not tags** — a screen reader still reads the page as an untagged content stream, i.e. a flat dump with no headings, lists, or figure boundaries.

## Why the current pipeline can't do it

`scripts/build-book-pdf.mjs`:

```
Markdown → marked → HTML → Playwright Chromium page.pdf() → pdf-lib post-process
```

- **Chromium / Skia `page.pdf()` emits untagged PDF.** There is no flag to turn on structure tagging; Skia's PDF backend has never had a `/StructTreeRoot` emitter. (This is the same backend whose `outline: true` flag was already found broken in Session 130's notes — we rebuild outlines by hand from `/Dests`.)
- **pdf-lib can write low-level objects but has no tagging API.** We *could* hand-build a `/StructTreeRoot` the same way we hand-build `/Outlines`, but that means re-deriving the entire heading/paragraph/list/figure structure from the HTML and emitting marked-content operators into the page streams — which Chromium didn't write and pdf-lib can't retrofit onto an existing content stream. This is effectively writing a tagging engine. **Not viable.**

So tagging requires replacing the **renderer** (the HTML→PDF step), not post-processing.

## Toolchain options

| Option | Tagged PDF? | Install weight | HTML/CSS fidelity | Notes |
|---|---|---|---|---|
| **Pandoc → Typst** | ✅ (Typst 0.11+ has experimental PDF/UA + good tag support, maturing fast) | Medium — Typst is a single ~30 MB binary, Pandoc ~150 MB | N/A — Typst is its own markup; we'd render Markdown→Typst, not reuse our HTML/CSS | Cleanest modern route. Loses our existing book CSS — layout rebuilt in Typst. |
| **Pandoc → WeasyPrint** | ✅ (WeasyPrint 61+ emits tagged PDF + PDF/UA-1 from HTML/CSS) | Medium-heavy — Python + WeasyPrint + system Pango/cairo | **High** — it's an HTML/CSS renderer, so most of our book CSS ports over | Best fidelity-preservation. Python dep is the friction on the Windows/AppLocker box. |
| **Pandoc → LaTeX** (NEXT_STEPS's guess) | ⚠️ Experimental (`tagpdf` / LaTeX PDF tagging project still pre-stable as of 2024–25) | **Heaviest** — full TeX Live is 1–4 GB | Low — LaTeX layout, screenshots need repositioning | Most mature for *print typography*, least mature for *tagging*. Not recommended. |
| **Prince / commercial** | ✅ (excellent PDF/UA) | License $$ | High (HTML/CSS) | Best output, but paid + per-seat. Out of scope for an OSS-style project. |
| **Hand-build via pdf-lib** | ✅ in theory | None (already a dep) | — | Writing a tagging engine. Weeks, not sessions. Rejected. |

## Recommendation

**Defer, and record the decision.** Rationale:

1. **EPUB already ships and is the better accessible-reading format.** Reflowable, natively screen-reader-friendly, no fixed-layout reading-order problem to solve. The PDF's job is print/portability, where bookmarks + `/Lang` + metadata (which we have) cover the 80% case.
2. **Every tagging route is a renderer swap**, i.e. a 1–2 session migration that throws away the current pipeline's two hard-won wins: pixel-accurate screenshot placement and the book CSS. Net accessibility gain over the existing EPUB is marginal.
3. **The Windows/AppLocker dev box** makes the Python (WeasyPrint) and multi-GB TeX (LaTeX) installs painful; Typst's single binary is the only low-friction option, and it still means rebuilding the book layout in Typst markup.

### If we do pursue it later

- **Pick Typst** (single binary, tagging maturing fastest, no Python/TeX install pain).
- Scope it as its own 1–2 session project: port the chapter manifest + TOC grouping (already centralized in `scripts/lib/bookChapters.mjs`) into a Typst template, wire screenshot paths, add alt text per figure (the EPUB build already carries alt text — reuse that source).
- Keep the Chromium pipeline as the "fast PDF"; add Typst as `book:pdf-tagged` rather than replacing `book:pdf`, so a layout regression in the tagged build doesn't break the committed PDF.
- Validate with the PAC 2024 (PDF Accessibility Checker) or `verapdf` CLI in CI.

## What we already have (don't redo)

- `/Lang` on the Catalog (`postProcessPdf`, build-book-pdf.mjs:630).
- Navigable `/Outlines` rebuilt from `/Dests` (Chromium's `outline:true` is broken).
- Full Info-dict metadata (`/Title`, `/Author`, `/Subject`, `/Keywords`, `/Producer`, `/Creator`, dates) matching the EPUB's Dublin Core.
- Alt text source for figures lives in the EPUB builder — reusable when tagging lands.
