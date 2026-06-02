# Chapter 16 — Sharing your work

> *TP Studio is local-first; nothing leaves your browser unless you choose to send it. The Export picker is the single doorway out. This chapter is the doorway's map.*

## Three modes of sharing

| Mode | Best for | Tradeoff |
| --- | --- | --- |
| **Standalone HTML viewer** | Sharing the full diagram with someone who doesn't have TP Studio. Double-click to open. | Single self-contained file. Read-only. Heaviest in size. |
| **Read-only share link** | Quick share via Slack / email / chat. URL fragment encodes the full doc. | URL gets long for big diagrams. Receiver opens in their own TP Studio session (Browse Lock auto-engages). |
| **Image / vector export** | Pasting into a deck, doc, or wiki. | Static. Lossy if PNG; vector if SVG/PDF. No interactivity. |

Pick by the audience. Engineers and analysts: share link. Slide deck and stakeholder pack: vector PDF. The non-technical "open this with the file" audience: standalone HTML viewer.

## The Export Picker

`Cmd+K → Export` opens the unified picker:

![Export picker dialog with three category groupings](screenshots/chapter16-export-picker.png)

Three groups:

### Images

- **PNG** — high-DPI raster, theme-aware. 2× density by default. Good for ad-hoc paste.
- **JPEG** — lossy raster. Smaller files. Web-friendly.
- **SVG** — vector. Sharp at any zoom. Importable into Figma, Illustrator, etc.
- **PDF** — true vector PDF via jspdf + svg2pdf. Paginated if the diagram exceeds page-height. Optional annotation appendix.
- **Print / Save as PDF…** — opens the **Print Preview Dialog** with mode picker (Standard / Workshop / Ink-saving), annotation appendix toggle, and header/footer merge fields. The browser print dialog opens after.
- **PowerPoint deck (.pptx)** — workshop-ready `.pptx` with one slide per major section: cover (doc title + diagram type), System Scope (if filled), an embedded screenshot of the canvas, EC conflict statement (EC-only), paginated reasoning bullets (≤7 sentences/slide in topological order, assumption-edges filtered), Likely Core Driver(s) (CRT-only), and Method-checklist progress. Indigo brand band; vector content where possible. Generated client-side via lazy-loaded `pptxgenjs` — first invocation downloads the vendor chunk (~123 KB gz), subsequent exports are instant.

The PDF route is the most polished for static layout. Use Print Preview for the layout knobs, the direct PDF export for unattended use, the PowerPoint deck when you need a slide each section of the analysis for a presentation.

### Markup

- **Markdown** — outline form. Paste into docs, GitHub, Notion.
- **OPML** — outline form. OmniOutliner, Bike, Logseq.
- **DOT (Graphviz)** — for tooling pipelines.
- **Mermaid** — both export and import; round-trips with the Mermaid live editor.
- **VGL (declarative)** — Flying Logic-flavored declarative text.
- **Flying Logic XML** — round-trips with Flying Logic.

### Reasoning + Workshop

- **Reasoning narrative** — Markdown, sentence-per-edge prose. See [Chapter 15](15-verbalisation-walkthroughs.md).
- **Reasoning outline** — Markdown, nested-list form.
- **CSV** — entities + edges + groups in one RFC-4180 file.
- **Annotations only (.md / .txt)** — just the description bodies, for content-review workflows.
- **EC Workshop Sheet (PDF)** — one-page PPT-style layout with guiding questions, EC-only.
- **Risk register (CSV)** — one row per UDE in the doc, with columns `risk_id / risk / trigger / consequence / mitigation / owner / status`. The exporter walks each UDE backwards through the causal graph to find any reachable injection or desired-effect; if one exists the row is `mitigated`, otherwise `open`. Owner comes from `entity.owner` (with a back-compat fallback to `entity.attributes.owner.value` for older docs). Imports cleanly into Jira / Linear / a spreadsheet. Only surfaces in the Export picker when the doc has at least one UDE — NBR diagrams and CRTs are the canonical sources; an EC has no UDEs by construction so it's hidden there.
- **Standalone HTML viewer** — single self-contained file.
- **JSON** — canonical schema-versioned export; the most lossless format.
- **Redacted JSON** — content-stripped JSON. Same structure, generic titles. Useful for sharing the *shape* of an analysis without the confidential content.

## Importing back

Going the other direction — opening someone else's file — uses the single **Import…** picker (`Cmd+K → Import…`). The dialog fans out five sources as cards: **TP Studio JSON** (full round-trip), **Flying Logic file** (`.fll`), **Mermaid diagram** (`.mmd`), **Entities CSV** (append rather than replace), and **Paste from whiteboard** — the last is the escape hatch for Miro / Mural / FigJam / any text source. Copy stickies from the source board, paste into the textarea, one entity is minted per non-empty line. Bullet markers (`-` `*` `•` `1.` `1)`) are stripped, tab-separated content keeps only the first column. Connectors aren't inferred — Miro / Mural don't expose arrow structure in client-accessible exports, so this path gets the entities into the canvas; you wire causality after.

## Generating a diagram with an AI assistant

Sometimes the fastest first draft isn't drawing — it's *describing*. TP Studio ships a Claude **skill**, `tp-studio-import`, that turns a problem, goal, conflict or plan written in plain language into an importable TP Studio document. Tell Claude what you're looking at — "*a Current Reality Tree for why onboarding churns*", "*turn this dilemma into an Evaporating Cloud*" — and it emits a schema-valid `.json` for any of the nine diagram types, which you load through the same **Import… → TP Studio JSON** doorway above.

The skill lives in the repository at `.claude/skills/tp-studio-import/`, so it's available automatically to anyone using Claude Code inside the project; it can also be installed into Claude.ai or a personal Claude setup (its `SKILL.md` explains the format, `reference/format.md` the full schema). A guard test (`tests/skills/tpStudioImport.test.ts`) imports every bundled example through the real validator on each CI run — and fails if a new diagram or entity type is added without updating the skill — so the generated shape can't drift from what the app actually accepts.

Treat the output as a *first draft*. The assistant gets the entities and the causal skeleton onto the canvas in seconds; you still apply the CLR scrutiny of [Chapter 13](13-the-clr.md) that turns a plausible-looking tree into sound logic.

## Share links

`Cmd+K → Copy read-only share link`. Generates a URL that:

- Has the format `https://your-tp-studio-host/#!share=<base64-gzipped-json>`.
- Encodes the entire current document in the fragment.
- Never reaches a server — the fragment after `#` is client-side-only.
- On the receiver: TP Studio detects the `#!share=` fragment on boot, decodes, loads the doc, and **engages Browse Lock automatically** so the receiver can't accidentally commit edits to a foreign document.

Trade-offs:

- **Size**: a typical 20-entity CRT lands under 2 KB compressed; a 200-entity Goal Tree might push past 8 KB and trip length limits in some email clients. A toast warns when the link exceeds ~4 KB.
- **Visibility**: the fragment is in the receiver's browser history. Treat shared diagrams as "public enough to email" — same threat model as JSON export.
- **Hostility defense**: Session 98 added a 5 MB ceiling on the decompressed payload to defend against gzip bombs.

## Print preview

`Cmd+K → Print / Save as PDF`. Opens the **Print Preview Dialog** with:

- **Mode picker:** Standard (full color), Workshop (bold high-contrast), Ink-saving (no fills, lighter strokes). Each renders the same diagram differently for context.
- **Annotation appendix toggle:** include an addendum listing every entity description as a numbered footnote.
- **Header / footer:** plain text + `{title}` / `{pageNumber}` / `{pageCount}` merge fields.
- **Selection-only toggle:** print only the currently-selected entities (renders with non-selected nodes set to `visibility: hidden` so the canvas geometry stays intact).

Browser print dialog opens once you click Print.

## The standalone HTML viewer

The most underrated export. `Cmd+K → Export → Standalone HTML viewer` generates a single `.html` file that contains:

- The full TP Studio canvas runtime, bundled.
- The current document, base64-embedded in a `<script type="application/json">` tag.
- The current theme.

Double-clicking the file opens it in any browser. No network calls. No JavaScript dependencies. Read-only — the viewer has no edit gestures wired up.

Perfect for: airgapped audiences, security-conscious recipients, slides with embedded HTML, archival.

## Review comments

Sharing a diagram for feedback used to mean the feedback came back *somewhere else* — a reply email, a Slack thread, a track-changes Word doc — detached from the diagram it was about. **Review comments** keep the feedback inside the file.

A comment is a short note pinned to one of three places: an **entity**, an **edge**, or the **whole diagram**. Open the panel with the speech-bubble button in the TopBar (or `Cmd+K → Comments`), select the thing you want to talk about, type, and post. With nothing selected the comment attaches to the diagram as a whole.

Because comments live in `doc.comments` — part of the document, not a side-channel — they travel with **every** lossless route out: JSON export, the read-only share link, and the standalone HTML viewer all carry the threads with them. The async-review loop becomes: share the link (or send the JSON) → the reviewer pins objections to the causality where it's wrong → they send it back → you open it and see each note attached to the exact entity or edge in question.

Each thread supports one level of **replies**, a **resolve / reopen** toggle, and inline **edit / delete**. The panel filters to **Open**, **Resolved**, or **All**, so a review pass is simply "work the Open list to zero." Click a thread's anchor chip to jump the canvas to whatever it's pinned to. Comments are signed with the name you set in the panel's *Signing as* field — a local label, not a login; TP Studio has no accounts.

Two boundaries worth knowing:

- **Comments are plain text.** No formatting, no `@`-mentions, no notifications — they're review notes, not a chat system.
- **Deleting the anchor deletes the comment.** Remove an entity or edge and any comments pinned to it go with it (whole-diagram comments stay). That keeps the thread list honest — every open comment points at something that still exists.

## Sidebars

> **🛠 How TP Studio helps**
> - **`Cmd+K → Export`** — unified Export Picker.
> - **`Cmd+K → Copy read-only share link`** — fragment-encoded URL share.
> - **`Cmd+K → Print / Save as PDF`** — Print Preview Dialog.
> - **Standalone HTML viewer** — self-contained share artifact.
> - **EC Workshop Sheet PDF** — one-page handout for EC workshops.
> - **Browse Lock auto-engages on share-link load** — receivers can't accidentally edit.
> - **Review comments** — notes pinned to an entity / edge / the whole diagram, carried inside every JSON / share-link / HTML export.
> - **`tp-studio-import` Claude skill** — describe a problem in words; get an importable JSON for any of the nine diagram types.

> **💡 Practitioner tips**
> - **Capture a snapshot before exporting for stakeholders.** "What I showed them on Tuesday" is a revision you'll want later.
> - **PDF for static audiences, share link for interactive ones.** Stakeholders click PDFs; analysts click links.
> - **Use redacted JSON when sharing the shape of an analysis.** "Here's our diagnostic shape, with anonymized content" is a real workflow.
> - **The EC Workshop Sheet is great handout material.** Print one per participant.
> - **Use comments for async review.** Share the link, let reviewers pin objections to the exact edge, then work the Open filter to zero.

> **⚠ Common mistakes**
> - **Sharing the wrong revision.** When you send a link, the link encodes the *current* doc state — not whichever snapshot you thought it would be. Capture + restore the right revision first.
> - **Forgetting Browse Lock when demoing locally.** Click the lock icon before screen-sharing. Otherwise an errant double-click during the demo creates a stray entity.

🔁 **Chain to next:** sharing is the asynchronous mode. Workshops are the synchronous one. Next chapter covers the latter.

---

→ Continue to [Chapter 17 — Workshops with TP Studio](17-workshops-with-tp-studio.md)
