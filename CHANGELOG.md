# Changelog

Reverse chronological. Entries are grouped by build session, not by release — the project has no version tags yet.

> **Sessions 1–149 live in [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md)** — same format,
> split out in Session 211 so this file opens on current history. Nothing was edited in the move.

## Session 211 — consolidating the project's memory

Dann: *"consolidate memory and prune and clean-up."* The project's memory is four hand-maintained files
(`CLAUDE.md`, `CHANGELOG.md`, `NEXT_STEPS.md`, `README.md`) plus a generated `public/stats.json`. After
210 sessions the hand-maintained side had drifted from the generated side, the history had outgrown
reading from the top, and `CLAUDE.md` documented one environment while two were in use.

### Four hand-copied statistics, all wrong

`public/stats.json` is generated and already feeds the live dashboard. Four prose copies quoted it by
hand: README said *"4,200+ tests … as of Session 186"* and *"~4,250 tests"*, `CLAUDE.md` said *"~5,190"*,
`docs/HANDOFF.md` said *"~5,200"*, and NEXT_STEPS claimed *"~97% lines / ~85% branches"*. The truth is
5,128 tests (5,032 unit + 96 e2e) at 95.33% / 83.75%.

The fix is not just the digits. Each site now either cites the generated source or states a deliberately
rounded **floor** — a claim that understates can go stale without going false, which a mirror cannot. The
`HANDOFF` gate line dropped its number entirely. NEXT_STEPS' coverage line says outright that it read
~97/~85 *because* someone re-copied it. This is the same failure NEXT_STEPS already names about English
label mirrors: an unread mirror is how two copies drift apart.

### CHANGELOG split — and the metric it would have quietly broken

11,816 lines, 412 entries. Sessions 1–149 were 62% of the file, and `CLAUDE.md` tells every session to
read it from the top for rationale — an instruction only usable if the file opens on load-bearing
history. Sessions 1–149 moved to `docs/CHANGELOG-archive.md`, byte-for-byte; `CHANGELOG.md` keeps 150+.

The trap was in `scripts/build-stats.mjs`, which counts `^##` in `CHANGELOG.md` into
`git.changelogEntries` — a figure published in `public/stats.json` and shown on the live dashboard.
Splitting naively would have dropped it 412 → 178: the dashboard would have reported barely more than a
third of the project's history, with nothing on the page to contradict it. It now sums both files;
verified 412 across the split, and 413 by CI once this session's own entry landed.

`check-feature-coverage.mjs` reads only the current file on purpose (it wants the *latest* session, which
is always there) — now commented so the next reader doesn't "fix" it.

*Correction, same session:* the first write-up of this claimed the figure also rides
`public/stats-history.json` and that a naive split would leave a permanent cliff in the trend line. It
does not, and it would not. The history writer stores exactly nine fields — `date`, `linesTsJs`,
`coveragePct`, `tests`, `bundleKb`, `mutationScore` and the three feature percentages — and
`changelogEntries` is not among them. The fix was still needed; the severity was overstated, and leaving
that overstatement in the file this session existed to de-drift would have been its own small joke.

### CLAUDE.md documented one environment; there are two

About 30% of the primer was Windows/AppLocker guidance, four instructions of which are actively wrong in
a Claude Code web session — each one hit in Session 210: `pnpm install` is mandatory here rather than
forbidden, `/c/devtools` doesn't exist, there is no `gh` CLI (GitHub work goes through `mcp__github__*`,
and `pull_request_read` with `get_check_runs` is the session-end all-runs cross-check), and the
pre-installed Chromium can lag the pinned `@playwright/test` (1194 vs 1223) so `playwright test` fails to
launch until pointed at the binary. Now split: shared · Windows workstation · web/remote, with a one-line
test for telling which you're in.

Recorded alongside it, because Session 210 exercised the distinction: `visual-*` baselines still must
never be committed from a local render, but `docs/guide/screenshots/` **may** be — those are
illustrations, not pinned baselines, and CI's `e2e` job confirmed the regeneration.

### SessionStart hook

There wasn't one, so every web session booted with no `node_modules`. That costs more than time: it
silently disarms `pre-bash-gate.cjs`, the PreToolUse hook that is supposed to block a commit when
tsc/biome fail. `.claude/hooks/session-start.sh` installs on remote containers only (`CLAUDE_CODE_REMOTE`),
is idempotent (checks for real binaries, not just the directory), and fails **soft** — a broken install
leaves the session usable to diagnose rather than bricking it. Deliberately synchronous: the gate hook can
fire on the first Bash call, and that race is the thing being removed. Cold path measured at 8.4 s.

### NEXT_STEPS re-audit

Walked every section against CHANGELOG. **Nothing was cut as shipped** — the Session-209 i18n follow-ups
and the rest are genuinely open, which is the answer a re-audit is allowed to have.

What did come out was a duplicated *Known environment quirks* block that had drifted into contradicting
`CLAUDE.md`: it still recorded the Session-175 findings that `biome.exe` and the bundled Playwright
Chromium were AppLocker-blocked, both superseded (Session 181 and 169 respectively). Two memory files
disagreeing about whether a tool works is worse than one file saying it. The four quirks that lived only
there survive; the lazy-chunk list moved to its own reference entry, since it was never an environment
quirk.

Also: `docs/features.json` carried `reviewedThroughSession: 209` while CHANGELOG had advanced to 210, so
`check-feature-coverage.mjs` was emitting a `::warning::` on every CI run. Session 210 shipped no new
user-facing feature — the History/Comments panel geometry change is a bug fix — so this is a bump, not a
catalogue addition.

## Session 210 — the book's screenshots had the UI standing in front of the diagram

Dann photographed a printed page of *Causal Thinking with TP Studio* and asked what was wrong with the
pictures. Chapter 3's screenshot is supposed to teach "because A, B" from a connected pair; it showed one
node, a selection toolbar, a coaching panel sitting on top of the *other* node, and the Inspector eating
the right quarter of the frame. An audit of all fifteen committed PNGs found **eleven with a defect, four
of them hiding content the surrounding prose promised the reader would see**.

None of it was a rendering or print problem. The PNGs are generated by `e2e/guide-screenshots.spec.ts`,
and the spec was capturing states no reader following the manuscript ever reaches.

### Six independent causes

- **Every seeded capture left an entity selected.** `addEntity` sets `selection` (`entityCrud.ts`), and
  `seed()` loops it — so the last-created entity was always selected, which renders *both* the
  SelectionToolbar over the canvas and the Inspector on the right edge. Eight shots.
- **`FirstEntityTip` was always on** — and it is the one that hid content. It renders at 1–2 entities and
  the spec `localStorage.clear()`s the dismissed flag before each test, so it was never not showing;
  `bottom-24 left-1/2` puts it dead-centre of the canvas. In `chapter02-connected-pair` and
  `chapter03-causality-because` it covered the **cause** node completely.
- **The toaster `mask:` painted a fluorescent magenta bar.** Playwright's `mask` does not hide an element,
  it overpaints it with `#FF00FF`. With no toast live the toaster returns `null` and the mask was a
  harmless no-op, which is why this went unnoticed — but on the three scenes that raise a toast
  (chapters 5, 9, 10) a solid pink rectangle shipped into the printed book.
- **Nothing called `fitView` after seeding.** React Flow's `fitView` *prop* only fires on mount, before
  the seed. `chapter04-crt-step2-three-udes` is captioned "Three UDEs" and showed two.
- **1280×720 was too small for the app's chrome** — rail + Inspector left ~740 px of canvas, and the
  height clipped the Export dialog mid-row.
- **The minimap sat on the diagram** bottom-left, and rendered as an empty box on the empty canvas.

### The fix

- **`stageForCapture()` on the test hook** (`src/services/testHook.ts`), composing store actions that
  already existed — `clearSelection` (which closes toolbar *and* Inspector, since they share `selection`
  as their visibility source), `dismissEmptyStateTip`, `dismissSelectionToolbarTip`, `dismissToast` over
  the live toasts, `setShowMinimap(false)`, and a `fitView`. No new store code.
- **`_screenshot` stages every capture**, so a scene added later is staged by construction rather than by
  remembering. `{ keepSelection: true }` for the one scene whose subject *is* the Inspector (Chapter 13);
  `{ stage: false }` plus an earlier `_stage()` for the one whose final gesture owns a selection
  (Chapter 15's read-through). **The `mask:` argument is gone entirely.**
- **Viewport 1440×900, scoped to the spec file** with `test.use()` — `playwright.config.ts` stays at
  1280×720 because that is the pinned baseline for the `visual-*` snapshot specs. Two scenes that are
  genuinely taller than a laptop viewport (the Export picker's five category groups, the Start page's
  template gallery) set their own height rather than ship a truncated frame.

### Two bugs the audit turned up

- **The History and Comments panels rendered their headers behind the top bar.** Both use
  `absolute top-0 right-0 h-full` and both carry a comment saying they mirror the Inspector's geometry —
  but they were mounted in the dialog `Suspense` block at the bottom of `<main>`, whose box is the whole
  viewport, while the Inspector lives in the content row below the header. So `top-0` meant *viewport*
  top: the "History" title, its close button and most of "Snapshot now" sat under the tab strip and
  TopBar, unreachable. Moved both into the content row next to the Inspector. This is why Chapter 14's
  screenshot was clipped; it was never a viewport-height problem.
- **The palette-driven scenes raced app boot.** They pressed `Control+K` immediately after `page.goto`,
  which races the `useGlobalShortcuts` effect that installs the listener — lose the race and the keypress
  lands on nothing. CI's `retries: 2` was papering over it; locally three of four failed on a 30 s
  timeout every run. `_runCommand` waits for the top bar's command-search affordance first, keeping the
  documented keyboard gesture as the thing under test. The spec went from 1.3 min to 18 s.

### Manuscript

- **Chapter 3's embed described a picture that did not exist.** Its alt text read "Settings dialog with
  causality-reading dropdown visible" while pointing at a two-node canvas. Both belong in the chapter, so
  there are now two: the connected pair moved up to the paragraph it actually illustrates, and a new
  `chapter03-causality-setting.png` sits under the modes table where the old alt text expected it.
- The modes table was missing `in order to`, which the new screenshot shows as a selectable option.
  Added — a picture contradicting the table on the same page is worse than either alone.
- `AUTHORING.md` gained a **Staging** section documenting the contract (and the "never pass `mask:`"
  rule), and its pipeline description no longer claims the spec uses `toHaveScreenshot` — it has used
  `page.screenshot({ path })` since Session 103.

All sixteen PNGs regenerated and re-read one by one against the defect inventory before commit.

## Session 209 — multi-language architecture (English-only, no language picker)

The seams for a second locale, with exactly one locale shipped and **no language control offered**.
Nothing about the app changes for a user today. This reverses the long-standing `i18n (English only)`
line that sat in the won't-build tail of NEXT_STEPS. Full contract: **`docs/I18N.md`**.

### The architecture

- **Hand-rolled typed catalogue, no dependency.** `src/i18n/locales/en.ts` is the source of truth;
  `type Messages = typeof en` makes a missing key, an extra key, or a changed interpolation signature a
  `tsc` error in any future locale. Deliberately **not** `as const` — that would narrow every value to its
  own string literal and demand a Danish catalogue contain the literal `'Undesirable Effect'`. Static copy
  is a `string`, interpolated copy is a `(params) => string` arrow, so a locale can't quietly drop a
  parameter and ICU placeholder parsing stays out of the app.
- **`useT()` returns the catalogue object**, not a `t('a.b.c')` lookup. Every access is checked against
  `Messages`; a typo is a compile error, not a runtime placeholder.
- **Locale lives in the Zustand preferences slice, not a React context.** `createContext` appears zero
  times in `src/`, there is no shared test render helper, and 119 test files call RTL `render()` directly —
  a provider would have meant ~119 test diffs. As a preference it costs zero test churn and
  `resetStoreForTest` resets it for free. An unrecognized stored value degrades to English via the same
  `isLocale` guard the persistence layer uses.
- **No language picker is shown.** `SELECTABLE_LOCALES` holds only `en`, and the Settings row is gated on
  there being more than one entry — a one-option dropdown is a choice that isn't one, and it would imply a
  translated app that doesn't exist. The preference, its persistence, the tampered-value fallback and
  `<html lang>` all work regardless; only the control is withheld, and it appears by itself when a second
  locale is registered.

### Crossing the domain / React boundary

Domain modules keep the STRUCTURE — which rules, steps, shortcuts exist and in what order — and the
catalogue holds the COPY, keyed by an id that was already stable. A resolver renders it for React callers;
an English-rendered view stays for callers outside a render (the exporters, `factory.ts`'s persisted
default document title), which is also what keeps existing assertions passing.

- **CLR warnings carry a key, not copy.** `validate(doc)` is memoized twice (a `WeakMap` plus a 32-entry
  fingerprint LRU), so threading a catalogue in would have meant keying both caches on the locale. Instead
  `makeWarning` takes `messageKey` + `params`. All 35 validator files converted; `ruleId` plus the existing
  `variant` discriminator already formed the key space. `Warning.message` is retained, rendered in English
  from the same catalogue entry the UI uses — so a mis-named interpolation parameter surfaces immediately
  in the validator suite instead of reaching a user.
- Same split applied to the 63-step method checklist (step ids were already the JSON wire-format key), the
  38 keyboard shortcuts, the 7-CLR scrutiny stepper, Barnard's five journey questions and the method-path
  prompts (`NextStep` carries `labelKey`).

### Copy quality

- **Real plural + list rules, with zero copy change.** `Intl.PluralRules` replaces the
  `n === 1 ? '' : 's'` ternaries; `Intl.ListFormat` replaces `join(', ')` in `st-tactic-assumptions` using
  `type: 'unit'`, **not** `'conjunction'` — conjunction would add "and" plus the Oxford comma and silently
  reword shipped English. Unit keeps en byte-identical while still deferring punctuation to the locale.
- **Interpolate, never concatenate.** Sentences that were glued together (`${label} — used in ${diagram}`,
  `New ${diagram} created.`, the `{n}. {step}` ordinal) are single catalogue functions taking the parts, so
  word order around them belongs to the translator. Build-time values (the security-audit date, version,
  copyright year) are parameters rather than baked into the string.
- **No user-visible English changed anywhere in this work.**

### Verification

- **Pseudo-locale.** `pseudo` derives every string from `en` and wraps it in `⟦…⟧`, so text a converted
  surface renders *without* brackets is a literal that never went through `useT`. Reached only through the
  registry's dynamic import — a ~200 B chunk production never loads.
  `tests/i18n/pseudoLocale.test.tsx` renders **twelve surfaces** and asserts every visible string is
  tagged, with a per-surface allow-list so a new hardcoded string has to be argued for rather than blending
  into a permissive filter. Eleven are at `[]`; the twelfth, the Building-Blocks rail, allows exactly the
  `ENTITY_TYPE_META` labels and meanings — **derived from that module rather than transcribed**, so the
  exception names its cause, cannot drift as the palette is edited, and still fails on a string hardcoded
  in the component. Two narrow, semantic exemptions: `<kbd>` content (key combos are keyboard input, built
  per-platform from `${M}`) and bare digits.
  **It does not test layout** — it brackets but does not expand length, so it catches a missing translation
  and not a longer one overflowing a control. Recorded in `docs/I18N.md`.
- It earned its keep: it caught a hardcoded ordinal separator, strings living in a shared sub-component
  (`MarkdownField`'s Edit/Preview), and the "Method path" strip label — none of which a read-through found.

### Converted

Eleven surfaces render with an empty allow-list: the four Settings tabs, the Document Inspector, Help,
About, the diagram-type picker, the Analysis-journey dialog, the toolbar title badge and the method-path
stepper — plus the Building-Blocks rail with its derived allowance. The Templates dialog is converted but
deliberately **not** asserted: its cards render the 222 parked pattern strings, and an allow-list that
large would rot faster than it guards. Alongside them: the full CLR pipeline, the
method checklist, the keyboard shortcuts, the scrutiny stepper, the journey questions, the shared
doc-links, the Start surface's per-diagram chrome and reader-mode coaching — roughly **635 strings**.
No component reads an English label view any more; `DIAGRAM_SHORT_LABEL` was deleted outright once its
last caller was converted.

### Other

- **`TPDocument.locale?`** — a reserved seam. Persisted and soft-validated like `cloudType` (an
  unrecognized value drops, so a doc from a newer build still opens), but nothing reads it yet. Purely
  additive: stays `schemaVersion 10`, no migration.
- **`<html lang>`** follows the locale (a fourth effect in `useThemeClass`) — React 19's metadata hoisting
  covers `<title>` but not attributes on `<html>`, and the CSP forbids a pre-hydration script.
- **Bundle went DOWN.** Eager `index` measured 106.4 KB gz before, ~101.5 KB after: deduplicating the
  coaching copy, dropping `logicTypeMismatch`'s `READING` map and removing the per-card `short` duplicate
  more than paid for the catalogue. No budget re-pin. `src/i18n/` is deliberately **not** in `manualChunks`
  (see the Session 135 note at `vite.config.ts:313-332`).
- **One real bug found and fixed mid-refactor:** `AllTreesGallery`'s search `useMemo` filters on the
  diagram tag, which became locale-dependent, but its dependency array still listed `[trees, q]`. A locale
  switch would have left results filtered against the previous locale's tags — invisible to tests, because
  only one locale ships.

### Closing bug hunt — the i18n diff

A multi-agent sweep over the branch before merge. It also ran a broader pass over persistence, store,
graph and exporters, which found enough that it became its own piece of work — see the next section.
Findings in the i18n diff itself:

- **Two hardcoded English strings survived in surfaces the docs claimed were guarded** — the
  Building-Blocks rail's "Browse templates & examples", and the Analysis-journey dialog's start blurb,
  which was rendered inline in JSX while an identical, orphaned `journeyDialog.startBlurb` sat in the
  catalogue. Both fixed. **The interesting part is why they survived**: `docs/I18N.md` listed thirteen
  surfaces as pseudo-locale-guarded, the test rendered ten, and neither of these was among them. The
  claim was the bug; the two literals were its symptom. Both surfaces are now in the test, and the doc
  says what the test actually does.
- **Two doc comments in `src/i18n/` asserted behaviour the code didn't have.** `useClrText`'s "a warning
  whose key is missing from a partially-translated locale still shows real copy" was false — the resolver
  returned `undefined`. Rather than delete the claim, both resolvers now take the English fallback the
  types already promise (`Warning.message` / `WarningAction.label`), so the documented contract is
  behaviour. `pseudo.ts`'s "preserves every key and every function arity" was half-true: the wrapper is
  variadic, so `.length` is 0. Comment corrected; the cast it justified still holds on value KIND.
- **Two latent traps with one-line fixes.** `pseudoValue` had no `Array.isArray` branch, so an
  array-valued catalogue entry would have come back as `{0: …, 1: …}`; and the `Intl` caches in
  `format.ts` keyed on the locale alone while hard-coding their options at the construction site — the
  first ordinal plural or conjunction list would have silently shared a cached formatter. Neither is
  reachable today, which is exactly when they are cheap to close.
- **`Applied: {action}` was an English sentence wrapping a translated label**, in two converted files, with
  the same event worded two different ways ("No handler for" / "No handler registered for"). One
  catalogue entry now covers both.

Findings recorded rather than fixed, because fixing them would half-convert a surface or needs a design
call, are in NEXT_STEPS: `CreationWizardPanel`'s three English-constant reads (its resolvers exist and its
Document-Inspector twin already uses them, but the rest of that wizard is unconverted), the concatenation
debt inventory, and `ENTITY_TYPE_META` as the next block to move.

### Parked deliberately (see NEXT_STEPS)

Three items stopped for structural reasons, not effort: the **pattern picker metadata** (222 strings,
9.2 KB gz, currently on the lazy `patterns` chunk — moving it into the eagerly-imported `en.ts` would
breach the index budget, so it needs a lazy catalogue *segment*); **toast copy** (~25 sites firing outside
any render, needing the same `(messageKey, params)` seam `Warning` uses); and **generated prose**
(`verbalisation.ts`, `edgeReading.ts`), where word ORDER is the translatable thing and per-locale sentence
templates are required rather than a string swap.

## Session 209b — the app-wide bug program (26 fixes, mostly silent data loss)

The broader review that ran alongside the i18n merge check came back with far more than a merge check
warranted, including several ways to lose a document without being told. Fixed here rather than filed,
each with a regression test. Nothing below is i18n-related; these are all pre-existing.

### Losing documents

- **A custom entity class made a document permanently unloadable.** `paletteForDoc` feeds every
  `customEntityClasses` key into the Inspector's Type picker, which writes it onto the entity — but
  `validateEntity` admitted only the 14 built-ins and hard-threw on anything else, rejecting the WHOLE
  document. With backup rotation, the second save left committed, live and backup all unparseable and
  the tree disappeared from the tab strip AND from Start → All trees, silently. `resolveEntityTypeMeta`
  has always had a graceful branch for an unknown type, so the render path was already total; the strict
  guard bought a typo check at the price of total document loss.
- **The quota cascade fired once per failed WRITE, not once per save.** One keystroke issues 2 writes and
  a debounced commit issues 4, and the in-flight latch cleared in a `finally` — so with the cheap tiers
  exhausted, typing a single character evicted 10 closed trees and a commit evicted 20. Invisibly:
  `showToast` deduped on `(kind, message)` and the message never varied. The latch now clears on a task
  boundary, tier 3 has a wall-clock floor, and its toast carries a running total.
- **Eviction deleted the documents it could NOT parse first** — `updatedAt ?? 0` sorted them to the front
  of the queue, and the likeliest reason a doc is unparseable is that a newer build wrote it. A stale PWA
  shell destroyed the user's newest work first.
- **Deleting or evicting a tree left its revision history behind** — up to 50 full document snapshots,
  the largest per-doc payload — so tier 3 freed almost nothing and re-fired.
- **Undo/redo across a document swap never rewrote the tabs manifest**, so the undo was silently reverted
  on reload. Same hole `performDocumentSwap` closed in Session 206, via the other path that rekeys the
  active tab.
- **`setDocument` lacked `openTab`'s id-collision guard**, so a replace-mode load whose id names a
  background tab overwrote that tab's in-memory doc and deduped its slot out of `tabOrder`.
- **A tab whose body failed to parse vanished with no signal**, and a boot that fell back to a fresh CRT
  never rewrote the manifest — so every reload minted another blank doc while the user's real doc sat
  unreferenced.
- **`writeTextToHandle` committed a failed write.** `createWritable()` opens an empty swap file and
  `close()` commits it, so `finally { close() }` truncated the user's linked file on disk. The existing
  test asserted the broken behaviour by name.

### Telling the truth

- **"JSON (redacted)" is now an ALLOWLIST.** It blanked five named fields and passed everything else
  through a `...rest` spread, so every optional field added since leaked by default — assumption text,
  entity owner, attribute values, evidence descriptions and URLs, working assumptions, system scope,
  comments — from a feature whose entire job is not leaking.
- **Revisions no longer claim more history than storage holds.** Writes discarded their success boolean
  and published regardless; the quota listener, which runs synchronously inside the failing write, would
  trim the stored map and reload — and the caller's unconditional `set` then overwrote the trimmed list.
- **`restoreSnapshot` stopped failing silently**, and a toast carrying an ACTION is never deduped —
  deleting two trees both titled "Untitled" collapsed the second toast and with it the only remaining
  copy of that document body.
- **CSV import reported success while dropping edges.** A row's own identity was keyed by title, so a
  repeated title made the second row's edge attach to the first row's entity.

### Correctness under scale and punctuation

- **`validationFingerprint` was not injective.** Entity records were an unescaped concatenation joined by
  `|` with free text interpolated raw, so `{n1:"A", n2:"B"}` and `{n1:"A:|n2:effect:B"}` hashed
  identically — and the LRU is module-global and shared across tabs and saved docs, so one document
  rendered warnings targeting entity ids it does not contain.
- **`findCycles` was O(V²) and blew the stack.** A full Tarjan pass per vertex: 11.7 s on a plain ACYCLIC
  chain of 7000 entities, `RangeError` past ~8000 — on the canvas render path. SCCs are computed once and
  both searches are iterative.
- **A quoted `schemaVersion` was treated as version 1**, re-running the whole v1→v10 chain and renumbering
  every annotation. Hand- and LLM-authored JSON is a first-class input and quoting a number is the
  commonest way to get it wrong.
- **CSV formula injection** — a title beginning `= + - @` became a live formula in the tracker or the
  board deck the file was handed to.
- **XML control characters** made OPML and Flying Logic files that simply don't open.
- **OPML dropped entities and whole subtrees** — an entity whose edge pointed at a note was neither child
  nor root and vanished (one effect plus one note produced an empty `<body>`), and cycle members were
  unreachable from any root.
- **DOT / Mermaid / VGL emitted edges to nodes they never declared**, which the receiving tool
  auto-creates under the mangled internal id — something all three file headers already claimed not to do.
- **Mermaid broke on ordinary punctuation**: a `]` in a title made re-import report "no nodes found", and
  an unquoted YAML frontmatter title meant `Rev 2: the sequel` failed to render anywhere.
- **Mermaid import produced documents the app itself cannot produce** — no self-loop or duplicate-pair
  guard, unlike `connect`.
- **Cross-doc link writes bypassed the debounce scheduler**, so an in-flight write could land afterwards
  and overwrite the link while the target kept its mirror — the asymmetric corruption `preserveLinks`
  exists to prevent, with no history entry to undo.
- **`mergeDocIntoActive` flattened nested groups**, dropped any group whose members were all groups, and
  left merged entities without their custom-class definitions.

### The tail

`clearLocalStorage` missed the legacy live-draft slot · an unsafe evidence URL was accepted at entry and
deleted at load with nothing said · `v6ToV7` mutated its input against the registry's documented purity ·
`v9ToV10` left group members pointing at entities it had removed · non-Latin titles all downloaded as
`untitled.<ext>` · the PDF appendix broke pages once per entity rather than per line, so a long block
marched off the bottom invisibly.

### Also fixed by the reasoning outline

A document made only of a cycle reported "*No structural entities yet.*" with entities and edges plainly
present — the one message guaranteed to read as a bug.

## Session 208 — touch interactions (bottom-sheet inspector · long-press menu · touch canvas)

The deeper half of the mobile work — making the *canvas itself* usable with a finger, not just fitting the
chrome onto a small screen. Additive + pointer/viewport-gated; desktop is byte-identical (verified with
rendered screenshots at 390 / 1280 px, plus 10 new unit/component tests).

- **Bottom-sheet inspector on phones.** Below `sm` the inspector renders as a draggable bottom sheet
  (`InspectorSheet`) instead of the 320px side slide-over, which on a phone would cover the whole canvas.
  Two snaps — half (52vh) / full (88vh) — via a grabber drag; swipe the grabber down to dismiss (clears the
  selection, same contract as the desktop X / backdrop). The tab bar + scrollable body are shared verbatim
  with the desktop `<aside>`, so both surfaces edit identically. Gated by a new SSR-safe `useMediaQuery` hook
  (`useIsPhoneViewport` / `useIsCoarsePointer`, built on `useSyncExternalStore`).
- **Long-press context menu.** Touch has no right-click, and a long-press didn't surface through React
  Flow's `onNodeContextMenu`, so the rename / delete / group / comment actions were unreachable on touch. A
  new `useLongPressContextMenu` pointer detector opens the *same* menu on a 500ms stationary touch/pen hold
  — resolving the pressed element to an entity / edge / pane target and swallowing the trailing tap so the
  menu isn't immediately closed. Mouse keeps React Flow's native right-click path untouched.
- **One-finger pan on touch.** With a coarse pointer, left-drag now pans the canvas (`panOnDrag` /
  `selectionOnDrag` are pointer-aware) — panning is the primary touch navigation gesture, and marquee-select
  has no natural one-finger equivalent. Fine pointers keep the desktop marquee default.
- **Finger-sized targets.** `@media (pointer: coarse)` grows React Flow connection handles (28px hit box,
  8px visible dot unchanged — so edges can be drawn with a finger) and the selection-toolbar buttons.
- **SelectionToolbar hidden on phones** — redundant with the bottom sheet (full editing) + the long-press
  menu (same quick verbs), and it would overlap the sheet.

## Session 207 — mobile-friendly chrome pass

Closing the phone/tablet gaps in the editor chrome. The chrome already collapsed gracefully across the
desktop 1024–1920 px band (the S182 content-priority rules), but below `sm` a handful of affordances were
either unreachable or crowded off-screen. All changes are responsive-only — no domain, schema, store, or
canvas-logic changes; verified with rendered screenshots at 375 / 700 / 1280 px.

- **The command palette is reachable on phones again.** `CommandSearch` was `hidden lg:flex` and the
  overflow ⋮ carries no palette entry, so below `lg` the ⌘K surface was keyboard-only — i.e. unreachable
  on a touch device. It now renders a compact search-icon button below `lg` (40 px touch target) that
  opens the same palette; the full field is unchanged at `lg+`.
- **Zoom / fit controls show on phones.** `CanvasNav` was `hidden sm:flex` and the MiniMap is also
  `sm`-gated, so a phone had *no* zoom UI at all — only pinch. The chip is now visible at every width; its
  `ml-28` MiniMap-dodge offset is dropped below `sm` (where the MiniMap is hidden and the corner is clear).
- **Building Blocks rail no longer crushes the phone canvas.** At 236 px the rail ate most of a phone
  screen, and it defaults to expanded. Hidden below `sm` (returns at `sm+`); creation stays available via
  canvas double-click and the palette.
- **Tab close (✕) is usable on touch.** It was `opacity-0` until hover — invisible on touch. Now always
  visible below `sm`; the hover-reveal is kept at `sm+` to stay clean on the desktop layout.
- **Bigger touch targets.** A `@media (pointer: coarse)` block grows the floating canvas-nav chip and the
  top-bar action buttons to a comfortable hit size — scoped so the fixed-height tab strip and the dense
  inspector body are untouched.

## Session 206 — Cohen's break hint outlives the wizard (and a backlog item declined)

**Declined: the EC per-TYPE verbalisation reading order.** The last open backlog item asked the
verbalisation strip to read a cloud in an order chosen by its `cloudType`. Reconned before building, and
the premise doesn't survive contact with the doctrine or the code:

- The guide gives **one type-agnostic reading** (`05-evaporating-cloud.md:43`, Goldratt's A-first). Cohen's
  Ch24 Table 24-9 ties the type to **build order + break hint only**. The one reading variation we
  document is keyed to **audience** — the `D′-first` toggle — which already shipped in D5.
- The "ready seam" wasn't one. `EC_CLOUD_TYPE_ORDER` is a **build/fill** order — a flat 5-slot sequence
  for a wizard that commits one box per step. `verbaliseEC` composes two need→want **arcs**, never slots.
- Forced through it's mostly a no-op: `ude` already *is* the default reading, `consolidated`/`core` are
  A-first which the reading already does; `dilemma`/`conflict` would need a new generator inverting
  necessity direction, and `firefighting` interleaves the arcs, which the arc model can't express.

The item traced back to a **forward-reference prediction in this changelog** (S197: "deferred to backlog
D5, which will consume it") rather than to Cohen. D5 shipped only the per-SIDE toggle; Session 206 fixed
that line's status but inherited its premise and promoted the assumption to a backlog item. Reasoning
preserved in NEXT_STEPS "Declined" so it isn't re-derived. *Lesson: don't write changelog
forward-references that assert what a future session will do.*

**Shipped instead — the itch underneath.** `cloudType` genuinely did nothing after creation, and Cohen's
per-type **"best arrow to break"** hint (`EC_CLOUD_TYPE_BREAK_HINT`, shipped S197) rendered *only* in the
creation wizard's completion panel — so it vanished the moment the wizard closed. Breaking the cloud is
what you do *afterwards*, while working the assumptions; the hint was gone exactly when it was wanted.
This is the same failure mode Session 197 fixed for the guiding questions by lifting them into the
inspector ("they vanish when the wizard closes").

A typed EC now carries its break hint in the **Document Inspector**, under the Cloud type dropdown
(amber `InsetCard`, `data-component="ec-break-hint"`, mirroring the shipped `ec-guiding-question` card).
Read-only and derived from `cloudType` — no schema change, no store action, nothing on the canvas, so the
canvas==export invariant and every visual baseline are untouched. Untyped clouds and non-EC diagrams
render exactly as before.

Four tests, each verified to fail against a *different* mutation: removing the card fails the two
"hint shows / tracks the selected type" cases; rendering it unconditionally fails the two "absent when
untyped / absent on a non-EC" guards. Also swept the now-false claims that the type is "just a label" —
`document.ts` (both doc comments), `ecGuiding.ts`, the DocumentInspector help text, USER_GUIDE, and guide
ch.5 (three places, including the Core-cloud "nothing changes" line).

## Session 206 — the hover-fan's last two exclusions (a gate that hid its own bug)

The convergence hover-fan spread only *direct-route* convergence in *flow* layouts. Detours and radial
mode were listed on the backlog as needing "a re-route, not just a bezier offset". That reason was wrong,
and the wrongness was the bug: the fan wasn't refusing to re-route — it was **replacing** the routed path
with a straight bezier, which erased the obstacle detour the router had computed. The
`routeWaypointCount <= 2` gate didn't protect detours; it hid the damage by excluding them.

`routeEdge` already builds its path as `bezierThroughWaypoints(waypoints)`, so the fix is to nudge the
final waypoint and re-run that same pure helper (`offsetLastWaypoint`): the arrival spreads, every corner
the router computed survives, and no A* runs. The gate is gone — route shape was never the fan's business.

Radial fell out of the same insight rather than needing a second mechanism. A flow layout stacks causes
below their effect, so they all arrive heading due north — and the perpendicular of due north *is*
lateral X. The lateral spread the fan always used was the perpendicular-to-approach spread all along,
just in the one orientation where the two coincide. So radial is the general case, not a special one:
`fanPerpendicularOffset` spreads across each edge's own approach heading (reproducing the flow fan
byte-identically for a vertical approach), and `fanRankByAngle` ranks slots by approach angle — the
property that actually generalises, since around a hub two sources on opposite sides can share an X while
arriving from opposite directions, making X order meaningless there.

Verified in a real browser (Chromium, both layouts, 3 causes → 1 effect). At rest all three edges arrive
at one point. On hover in flow: −16 / 0 / +16, pure lateral, middle unmoved. On hover in radial: the same
16px magnitude but along *different* vectors per edge — (+13.0, +9.3) and (+9.6, −12.8) — each
perpendicular to its own approach. The dispatch-driven hover used for radial was first validated against
flow, where it reproduced the real-pointer numbers exactly.

## Session 206 — an arrowhead into empty canvas (the last hunt bug)

A junctor edge whose effect sat inside a collapsed group drew its arrowhead ~49px past the node, into
blank canvas. Two layers were deriving the same predicate and disagreeing:

- `useGraphEdgeEmission` had it right — an edge is aggregated when it bundles several edges **or** when
  an endpoint is a collapsed-group stand-in, so a junctor edge crossing that boundary is not a junctor
  edge, and it keeps its arrowhead (there's no junctor circle left to hand the arrow to).
- `TPEdge` re-derived it as `isJunctorGroup && aggregateCount <= 1` — and *could not* get it right: the
  synthetic-endpoint half never reached it, and `aggregateCount` isn't even stamped when the count is 1.
  So it redirected the endpoint onto a junctor circle positioned for the now-hidden target, while
  emission had already stamped an arrowhead.

Rather than pass the missing input down, emission now stamps its **verdicts** (`isJunctorEdge`,
`isAggregated`) into the edge's `data` and `TPEdge` reads them. That deletes the duplicate derivation
instead of patching it — this was the third defect of that exact shape this session (`TPEdge` vs
`JunctorOverlay` on the junctor's centre-X, then its centre-Y, now `TPEdge` vs emission here), so the
fix targets the class, not the instance. Both flags are omitted when false, leaving every other edge's
`data` byte-identical (the memo comparator shallow-compares `data`, so absent-vs-false is the
difference between no churn and re-rendering every edge).

Folded in the same drift's quieter half: `TPEdge` also re-derived `isAggregated` as `aggregateCount > 1`
to gate the causality label, so a collapsed-group stand-in edge captioned itself "because" / "in order
to" — borrowing one arbitrary sample edge's label to speak for the whole bundle, while emission had
already stripped that edge's assumptions, route and badges for exactly that reason.

## Session 206 — CLR warning-id collisions: one dismissal silenced a different reservation

> **One-off reset (Dann's call).** Stored "resolved" marks for **`ec-completeness`** and
> **`additional-cause`** are invalidated by this change — those warnings come back once, to be
> dismissed on their own terms. No other rule is affected. There is no migration because a faithful one
> is impossible: the old key recorded *that* something was dismissed, never *which* of the rule's
> reservations, so the information needed to migrate was never stored. That is precisely why a reset
> was the only honest option.

A warning's id was `${ruleId}:${target.kind}:${target.id}`, and `resolvedWarnings` is keyed by it. Two
*different* reservations from one rule against one target therefore shared an id, and dismissing either
dismissed both:

- **`ec-completeness`** collided *simultaneously*. A fresh cloud trips both "Objective (A) is empty" and
  "No injection yet" — both targeting slot A — so dismissing one silently dismissed the other. Same for
  a Want pointing at the wrong Need when that edge also carries no assumption, and for a B≡C duplicate
  that also supports something other than A. Three colliding pairs across the rule's six reservations.
- **`additional-cause`** collided *across time*, which is worse. Its three reservations are mutually
  exclusive per entity, so they never co-fire — but resolve "No causes captured", add a cause, and the
  quite different "Only one cause — could an independent cause also produce this?" inherited the
  resolved id and **never surfaced**. The user was denied a reservation they had never seen, with no way
  to get it back.

`makeWarning` now takes an optional `variant` that extends the id to
`${ruleId}:${variant}:${target.kind}:${target.id}`. It is **opt-in by design**: omitting it reproduces
the original id byte-for-byte, which is what confines the reset to the two rules that needed it rather
than resetting all forty-odd. A test pins that scoping, because the id format is a persisted key and
changing it silently discards people's dismissals.

## Session 206 — findCycles rewritten as Tarjan SCC + Johnson (the last Session-205 carry-over)

`findCycles` reported a cycle *basis*, not every elementary circuit. The DFS marked nodes `visited`
globally and never unmarked them, so a second loop arriving at an already-finished node found nothing
on the recursion stack and was silently dropped. `loopsWithPolarity` (the R/B loop badges) and
`effectiveBackEdgeIds` (the auto-drawn loop closers) both inherited the blind spot.

**The recorded symptom — "misses cycles that share a closing edge" — turned out to understate it.** A
differential test against brute-force enumeration shows the old walk finding **10 of 84** circuits on a
complete 5-node digraph: it only ever found the 2-cycles, missing every longer circuit once the graph
overlapped at all.

Now Tarjan SCC + Johnson's algorithm, which is complete by construction: vertices are searched in a
fixed order and each start considers only the subgraph above it, so every circuit is enumerated exactly
once — when the start is its minimum vertex. Because that order is the sorted entity ids, each circuit
also arrives already rotated to start at its smallest id, which is precisely the canonical form
`backEdges` documents a dependency on. Johnson's blocking map keeps it to O((V+E)(C+1)) rather than a
naive exponential search, and `MAX_CYCLES` caps enumeration so a pathological document degrades (some
loops lose a badge) instead of hanging the canvas — unreachable for real diagrams.

Tested differentially against an exhaustive reference over 300 random digraphs plus a dense case whose
84 circuits match the closed form for K₅ — because the defect being replaced passed every test the repo
had, and shaped examples alone wouldn't have caught it. (A by-catch: the store rejects self-loops, but
`importFromJSON` accepts them, so the self-loop path is reachable via a hand-edited file / share link /
FL import and is now pinned as such.)

## Session 206 — bug fix: undo silently broke one half of a cross-doc link

Linking two entities across tabs deliberately pushes **no history entry** — a link is metadata, not
content (the same rationale as `markSystemScopeNudgeShown`). The consequence went unnoticed: undoing
some *earlier* content edit restored a snapshot taken before the link existed, which stripped the link
from that document — while the reciprocal mirror survived in the other one, which was never on this
undo stack. The two docs then disagreed about a link the user never asked to remove, and no further
undo could reconcile them.

Since links are off the history stack *by design*, the consistent reading is that they must survive a
restore: undoing a title edit has no business destroying a link, least of all only one half of it.
`preserveLinks` now carries the live links onto any restored snapshot of the same document (undo and
redo alike). A replace-mode restore of a *different* document is left alone, an entity being restored
by undoing its deletion keeps what it carried, and an unchanged doc returns by identity so the
memo gates don't fire. The explicit removal path (`unlinkEntity`) is untouched — that's the one that
*is* meant to drop a link, and it still clears both halves.

## Session 206 — bug hunt: PRT-plan drop + an FL prototype hole

Both regression tests were run against the reverted source to confirm they fail pre-fix.

- **The PRT plan silently dropped objectives caught in a cycle whenever a note was an edge target.**
  `orderedIntermediateObjectives` excludes notes from `entities` but let note-terminated edges into the
  graph, so a reached note picked up an `inDegree` entry, got popped into `order`, and inflated
  `order.length`. The recovery guard compares that against `entities.length` — two different
  populations — so each reached note masked exactly one cycle-trapped IO, which vanished from both the
  CSV and the "Exported N objectives" toast (it re-calls the same function). That broke the function's
  own "nothing is silently dropped" contract, and the existing cycle test passed only because its
  fixture had no notes. The graph is now restricted to structural endpoints. Notes have been freely
  connectable since Session 136 and FL imports tether them to entities, so the shape is reachable.
- **A Flying Logic `entityClass` could smuggle a Function in as an entity type.** `mapEntityType`
  indexed a plain object, so `entityClass="toString"` (or `constructor` / `valueOf` /
  `hasOwnProperty`) resolved to the INHERITED `Object.prototype` member; `??` only guards
  null/undefined, so the function passed straight through as `entity.type`. TypeScript couldn't catch
  it — `Record<string, EntityType>` asserts the index already IS an EntityType. Now guarded with
  `Object.hasOwn`.

## Session 206 — bug hunt tier 2: three more, each firing on the app's own content

Every regression test below was run against the reverted source to confirm it fails pre-fix.

- **The Core Driver finder gave up on any CRT whose causes sit in a reinforcing loop.** The fallback
  pool was "entities with no structural incoming edge" — inside a cycle nobody qualifies, so the pool
  came back empty and `findCoreDrivers` returned `[]`, while `udeReachCounts` (computed two lines
  earlier) happily reported those same entities reaching UDEs. The panel then told the user their CRT
  "needs at least one UDE reached from a root cause" about a CRT that has exactly that — **including on
  the shipped `crt-fixes-that-fail` pattern**, a pure 4-node cycle, so the app's own template made its
  headline feature look broken. Loop-closing edges are now discounted via `effectiveBackEdgeIds` — the
  same auto-detection the canvas uses to draw the loop arrow, so the entry point we score is the one a
  reader already reads as the loop's start.
- **`indirect-effect` was registered on Goal Trees, where it contradicted the rule beside it.** It's a
  causal nudge ("≥3 direct causes into one effect"), but `goalTree-csf-count` *enforces* Dettmer's 3–5
  CSFs, all pointing at the single Goal — precisely the shape `indirect-effect` flags. A
  textbook-correct Goal Tree was warned for being textbook-correct, the shipped example included. Now
  filtered out for `goalTree`, exactly as `st` already does for the same reason.
- **The junctor circle drifted height/2 off its edges in horizontal (EC) layouts** — the Y-axis twin of
  the centre-X drift fixed earlier this session, and the same root cause: handle-vs-box geometry.
  `JunctorOverlay` looked only for a *bottom* target handle; a horizontal diagram renders a *right* one,
  so the lookup missed and fell through to the box bottom while TPEdge kept terminating the cause-edges
  at the right handle's centre Y. The axis is now derived from which handle exists, so no diagram type
  needs threading through.

## Session 206 — bug hunt tier 1: three silent data-loss / layout defects

The three highest-value findings from the hunt, each with a regression test **verified to fail against
the pre-fix code** (the test was run against the reverted source, not just asserted to be right).

- **A reload silently reverted the document you just opened.** `performDocumentSwap` rekeyed
  `activeDocId` + `tabOrder` via `setActiveDoc` but never called `persistTabsManifest`, and
  `persistActiveDoc` explicitly disclaims manifest ownership — so nobody wrote it. The manifest kept
  naming the OUTGOING doc, and boot restored that. Palette → "New diagram" routes through the same
  helper, so this hit every user with no pref flip needed. Now persists the post-swap ids (taking
  `tabOrder` from the swap result, never `[doc.id]` — that would drop every background tab).
  *(The naive "reload and see" repro falsely passes unless a manifest is seeded first: with none
  stored, boot falls through to the legacy single-doc migration path and lands on the right doc for
  the wrong reason. The tests assert on the manifest directly.)*
- **A Flying Logic round-trip rewrote every necessity edge to sufficiency**, corrupting the logic of
  an Evaporating Cloud or Goal Tree — reachable by double-clicking a `.logicx`, which the PWA file
  handler imports straight into a tab. The writer never emitted `edge.kind`, and the reader rebuilt
  every edge through `createEdge`, whose hardcoded `'sufficiency'` won. This contradicted the writer's
  own "lossless" docblock and the v6→v7 migration, which forces `necessity` on EC for exactly this
  invariant. Now round-trips via `tp-studio-kind` (emitted always, so a TP-Studio-authored sufficiency
  edge is distinguishable from a native FL file carrying no attribute — which falls back on the
  diagram's primary logic). **`Edge.isMutualExclusion` died to the same gap** and is fixed with it.
- **Revealing an archived group stacked its entities at (0,0).** The layout fingerprint omitted
  `showArchivedGroups`, so flipping the pref widened the visible set (via `useGraphProjection`) without
  moving `fp` — the dagre effect early-returned and the revealed entities never got positions, leaving
  `useGraphNodeEmission` to fall back to the origin. `useEdgeRoutes` already listed the pref as a cache
  dep and *claimed* to mirror `useGraphPositions`; the mirror is now real.

## Session 206 — adversarial bug hunt (8 lenses → 17 candidates → 13 confirmed) + 3 fixes

Ran an 8-lens adversarial hunt (60 agents; every candidate had to survive 3 skeptics trying to refute
it on correctness / reachability / intent). 13 confirmed; the three cheapest-and-clearly-ours shipped
here, the rest are recorded in NEXT_STEPS with repros rather than rushed.

Fixed, both in code the ID feature shipped hours earlier:

- **The Time-lost input had no accessible name.** `InterferenceMetricSection` passed a JSX
  `aria-label`, but `TextInput` forwards the camelCase `ariaLabel` prop — so the attribute was silently
  dropped and the spinbutton was nameless to a screen reader (the `Field` label isn't wired to it via
  htmlFor/id). This also explains why the component test had to query by role instead of label; the test
  now asserts the accessible name directly.
- **The interference Pareto column didn't add up.** Rounding each share independently made the shipped
  constraint-exploitation pattern (90/60/45/30/30) export **101%** — on the very sheet the method uses to
  settle "which interference do we attack first". Both the CSV and the ranking toast now read whole
  percentages from a new `wholePercents` helper (largest-remainder/Hare), which sums to exactly 100 by
  construction.

## Session 206 — bug fix: junctor terminus drifted off its circle in horizontal layouts

Fixes one of the two defects the Session-205 adversarial hunt recorded but didn't rush
(`src/components/canvas/edges/useJunctorCenterX.ts`).

`useJunctorCenterX` fed React Flow's `props.targetX` into `junctorCenterX`, but that's the target
**handle's** X — while `JunctorOverlay` fed the target's **box centre**. On a vertical tree the target
handle is Bottom, so its X ≈ the node centre and the two agreed by accident. On a **horizontal (EC)**
layout the handle sits on the node's RIGHT edge (centre + width/2), so the cause-edges' meeting point
slid `nudge × width/2` — **width/8**, i.e. 27.5px at the default 0.25 nudge and a 220px card — away from
the AND/OR/XOR circle the overlay drew. The circle and the edges visibly disagreed.

Both sides now derive the centre identically from the node box (`positionAbsolute.x + measuredWidth/2`)
via `nodeLookup`, falling back to the handle X until React Flow has measured the node. `targetId` is now
a required hook param so no caller can silently regress to the handle X. Regression test pins the exact
drift (asserts 300, not 300 + width/8) and was verified to fail against the pre-fix code (327.5).

## Session 206 — Interference Diagram (the 10th diagram type)

Added the **Interference Diagram (ID)** from Sproull & Nelson's *Epiphanized* (App. 4) — the fast,
intuitive tool for "what to change" without a full CRT: a central objective at the hub with the
interferences that block it radiating around, each optionally quantified and paired with a fix. Its
arrows are non-logical intuition arrows, so no causal CLR runs on it; it opens forced-radial.

- **Type registration.** `'id'` is the tenth `DiagramType`, reusing `obstacle`/`intermediateObjective`/
  `goal` (no new entity type). Landed the full exhaustive-map cascade (palette, labels, colour, default
  entity, initial-doc seed of one central objective, print/PPTX labels, guards Set, type-picker card,
  Start tile, method checklist for both modes, worked example, `tp-studio-import` skill example).
- **Forced radial.** A behaviour-preserving prep commit routed the three `layoutMode` reads through a new
  `effectiveLayoutMode(diagramType, mode)` helper; `FORCE_RADIAL.id = true` then makes an ID always render
  radial (objective centred via inward edges) with the flow/radial toggle suppressed.
- **Per-interference time/impact.** A bespoke "Time lost" inspector control on ID obstacles, stored under
  the reserved `id-impact` int attribute (no schema change).
- **Curated CLR + two ID checks.** Only the non-causal hygiene rules run; added `id-interference-no-io`
  (an interference with no paired fix) and `id-multiple-central-objectives` (document-anchored).
- **Pareto ranking + CSV.** `rankInterferences` ranks by lost time with share-of-total; the
  **Rank interferences by impact** command highlights + toasts them, and **Export → Interference ranking
  (CSV)** writes the sheet (ID-only, obstacle-gated).
- **ID/IO Simplified Strategy spawns.** `Spawn Prerequisite Tree from this ID` (radial → dependency plan)
  and `Spawn Goal Tree from this ID` (the IO map). The ID also joins the Analysis Journey's "what" stage
  as the book's faster route to "what to change".
- **Starter patterns.** Two Pattern-library entries — constraint-exploitation (time-quantified, J40 line)
  and strategy-development (event-driven revenue obstacles).
- **Selection-toolbar slot verbs.** An ID entity offers Mark as interference / Mark as fix / Add fix for
  this interference (reusing the PRT re-type commands), with unit + e2e coverage.
- **Docs + tests.** USER_GUIDE section + spawn-bridge + toolbar-verb entries, README counts (nine → ten),
  features.json rows, a full book-guide chapter (**18 — Interference Diagram**), Flying-Logic reader
  round-trip (`id` added to `KNOWN_DIAGRAMS`), and an `id.test.ts` registry-coverage guard mirroring the
  NBR one.

## Session 205 — Adversarial bug hunt: 13 fixes

A multi-agent bug hunt (8 area finders → 3-skeptic adversarial verification, reading the real code)
surfaced 15 confirmed defects. 13 are fixed here, each with a regression test; 2 are recorded for a
focused follow-on (see NEXT_STEPS).

- **Exporters crashed on any custom entity class** (VGL, OPML, Flying Logic, PPTX). They read the
  built-in-only `ENTITY_TYPE_META[type]` and threw on a custom class id — a user with any custom class
  couldn't export via these formats. Now resolve through `resolveEntityTypeMeta`.
- **`reverseEdge` corrupted junctor groups.** Reversing one edge of an AND/OR/XOR group re-pointed its
  target, leaving a persisted mixed-target group that rendered an incoherent junction. Now strips the
  junctor membership on reversal and prunes the group left with one member.
- **`openTab` duplicated an already-open id.** Re-importing a doc that kept its id pushed a duplicate
  `tabOrder` entry — closing it dropped both copies (the doc vanished). Now replaces the tab in place.
- **Flying Logic round-trip reset Goal Tree / NBR docs to CRT** — the reader's known-diagram list omitted
  both; import fell back to CRT, losing the type / palette / method checklist. Added both.
- **Cascade delete left assumption-anchored comments dangling** — three delete mutators called
  `pruneComments` without the freshly-pruned assumptions, so a comment on an orphaned assumption survived.
- **Junctor cause-edges detached from their AND/OR/XOR circle on hover** — a junctor edge sharing its
  target with plain edges was wrongly given `fanSiblings` and computed a negative fan offset. Junctor
  edges are now excluded from the `fanSiblings` stamp (plus a defensive rank clamp).
- **Lower-severity:** `st-tactic-fold-in` no longer false-fires on legacy goal-node S&T patterns (counts
  only tactic/injection children); the JSON importer's rebuilt annotation counter now includes assumption
  numbers (no more duplicate `#N` badges); `deleteSavedDoc`'s Undo now restores journey membership too.

Recorded for follow-up (NEXT_STEPS): `findCycles` misses simple cycles that share a closing edge (needs
Johnson's-per-SCC); junctor terminus X vs circle X disagree in horizontal (EC) layouts.

## Session 204 — Perf-trace gate: best-of-N metric (fixes `all-actions` too)

- **The perf-trace gate now uses best-of-N, so neither scenario false-fails on runner noise.** The
  Session-203 re-baseline fixed `edit-heavy`, but the verification run then tripped `all-actions`: its p95
  swung **2.8 → 12 ms within a single run** (2 of 3 iterations were contention spikes), so its median-of-3
  was itself a spike (10.08 ms) — a median can't outvote a *majority* of spikes. Fixed by changing the
  gate metric from median-of-3 to **best-of-5 (minimum p95)**: CI perf noise is one-sided (contention / GC
  / JIT only *add* time), so the fastest iteration is the least-contaminated estimate of true cost and is
  near-immune to spikes (P(all 5 spike) is tiny). `all-actions` re-baselined to its ~2.5 ms floor (the old
  6.45 was a contention-inflated median); both scenarios carry a per-scenario threshold for the residual
  **between-runner-host** variance that no within-run aggregation can remove. The aggregator and gate are
  unit-tested and verified end-to-end against the failing run's own samples (they now pass). Informational
  totals / long-tasks stay median. Measurement infrastructure only — no app change.

## Session 203 — Perf-trace `edit-heavy` gate: re-baseline + per-scenario threshold (backlog)

- **The `edit-heavy` perf-trace gate no longer false-fails.** It had been tripping for two reasons: its
  baseline (9.2 ms, Session 131) was **stale** — the real cost grew legitimately to ~15 ms as features
  landed on the 100-node reconciliation — and its p95 varies **between** CI runner hosts, not within a run
  (the three within-run samples on 2026-07-13 were near-identical: 15.12 / 15.25 / 15.14), a floor that
  running the spec more times can't shrink. Fixed by re-baselining `edit-heavy` p95 to the cross-run
  central value (**16.7 ms**) and giving it a **per-scenario 35 % threshold** covering the observed
  ~14–21 ms host-to-host floor with margin — a genuine 1.35x+ regression still fails, and `all-actions`
  keeps the global 25 %. The regression checker (`check-perf-regression.mjs`) gained a `thresholdPct`
  per-scenario override (unit-tested `scenarioThreshold`, entrypoint-guarded so it's importable). No
  app-code change — the hot path was already clean (Session 190); this is measurement infrastructure.
  The residual `edit-heavy` cost is mechanically the **inherent O(N) node-array rebuild + React
  reconciliation of 100 nodes per edit** — irreducible, not rot. If you find 16.7 ms pinned in
  `perf-baseline.json` and assume it's decay, it isn't: don't re-chase it. (Re-baseline + threshold were
  **Dann's call**, not an autonomous loosening of the gate.)

## Session 202 — Hover-fan: crossing-free slot order (backlog polish)

- **Converging edges fan without crossing.** When several edges converge on one node and you hover the
  group, they spread apart so an overlapping one can be grabbed. The slot order used to be by source id
  (position-blind), so when the id order didn't match the sources' left-to-right layout the fanned edges
  could cross. The slots are now ordered by each edge's **live source X** — a left-hand source always gets
  a left-hand slot — so the fan never crosses.
- **No perf-boundary cost.** The fan is hover-only over a static layout (node drags don't fan), so the
  position sort runs only while a group is hovered — the edge-emission memo stays structural-only (no node
  positions), exactly as before. Emission stamps the convergence group's source ids (`fanSiblings`); the
  render layer (`TPEdge`) refines the left-to-right order from live positions at hover time, read
  imperatively with no new subscription (so a node drag pays nothing). Falls back to the stable source-id
  order if a position is momentarily unavailable. *(Closes the backlog hover-fan slot-sort item; the
  detour / radial-mode fanning item stays deferred.)*

## Session 201 — Open Flying Logic files by double-click (PWA file handling)

- **Double-click a Flying Logic file → it opens in TP Studio.** The web manifest now declares a
  **`file_handlers`** association for **`.xlogic`** (Flying Logic 4's saved extension), **`.logicx`** (what
  our own exporter writes), and **`.logic`**, and a `launchQueue` consumer (`registerLaunchFileHandler`)
  imports the launched file via the existing `importFromFlyingLogic` and opens it in a new tab — the same
  result as *Import → Flying Logic file*, just triggered by the OS. A parse failure surfaces a toast; an
  empty launch is ignored.
- **Chromium only, and after install.** File handling is a Chrome / Edge capability that requires **TP
  Studio to be installed as an app** (*Install TP Studio…* in the palette / the browser's install prompt);
  the OS association is offered when you install and updates once the new manifest deploys. The consumer is
  a safe no-op where the API is absent (Firefox / Safari, or a plain browser tab), so nothing else changes.
  The extension list is a single shared constant (`fileHandlerTypes.ts`) used by both the manifest and the
  runtime handler, so the two can't drift.

## Session 200 — Analysis journey: guided multi-tree flow (backlog §C)

The chained multi-tree "project" workflow (§C), built as an opt-in **Analysis journey** — a guide over
the several trees of *one* analysis, walked through **Barnard's five questions** (*Handbook* Ch. 15
Table 15-3; the stage→tree mapping also draws on Ch. 19, Dettmer). It's the "connective tissue" the gap
analysis called for: it ties the already-shipped
pieces — the method stepper, the CRT→FRT / Goal Tree→CRT spawn bridges, the multi-tab engine — into one
narrative, without a new kind of document.

- **The five stages** map to the trees they need: *Why change?* → Goal Tree · *What to change?* → CRT ·
  *What to change to?* → EC / FRT / NBR · *How to cause the change?* → PRT / TT · *How to sustain it?* →
  S&T. Each stage shows its status (done / active / to-do, derived from which member trees exist), the
  diagram types it covers, and a context action: **Open** an existing tree, **Spawn** the next one via
  the shipped bridge (FRT from a CRT, CRT from a Goal Tree), or **Create** it. A progress bar tracks the
  five; a per-stage "Mark done" covers stages handled outside a tree; "End journey" drops the grouping
  (the trees are untouched).
- **Opt-in, zero-default, no schema change.** Nothing exists until you start a journey from the palette
  (*Analysis journey (guide the multi-tree flow)…*, Review group). The journey is **app-level state in
  localStorage** (`tp-studio:journey:v1`), never on a `TPDocument` — so `schemaVersion` stays 10 and every
  existing surface is byte-identical when no journey is running. A deleted tree is pruned from the journey.
- Built on shipped machinery — "Create" mints a normal tree, "Spawn" reuses `spawnFRTFromCrt` /
  `spawnCRTFromGoalTree` — so there's nothing new to learn. Pure model + derivations in
  `domain/analysisJourney.ts`; state in `store/journeySlice.ts`; UI in `components/journey`.

## Session 199 — S&T template extension + CLR-scrutiny nudge (backlog G, A tails)

- **Four new Strategy & Tactics templates** on the corrected directional-facet model (backlog B), each a
  valid, position-clean facet-card tree that opens without noise:
  - **Mafia offer — consumer goods** and **Mafia offer — projects**: the un-refusable-offer / Decisive-
    Competitive-Edge family (*Handbook* Ch. 22, Lang), abstracted with original wording. The consumer-goods
    offer removes the retailer's two shelf fears at once (guaranteed availability via consumption-driven
    pull + no overstock risk via consignment returns); the projects offer sells schedule certainty (a firm
    date backed by a penalty, made real by a single project buffer + releasing work to the capacity
    constraint). Two-leaf offer trees.
  - **Healthcare Viable Vision (3-level)**: a care-provider VV (*Handbook* Ch. 31/34), abstracted — treat
    more patients to better outcomes on the current beds by managing flow to the bottleneck (a buffer of
    ready patients, piloted then spread) rather than adding capacity. Middle step carries all four facets.
  - **Retailer Viable Vision (6-level)**: the deep form of the retail VV, the same pull-replenishment
    transformation decomposed six layers down (data → buffers → cadence → pilot → rollout → the sustaining
    review). A long spine of full-facet intermediate steps, each with a leaf sibling — the fullest S&T shape
    in the library, and the reason the pack now shows genuinely different tree depths, not just different
    prose.
- **CLR-scrutiny "environment" nudge** (backlog A). The Entity-existence category in the guided CLR
  scrutiny now asks whether the cause and effect exist *in the environment you are examining* — not just in
  general — and the hint reminds you a condition that holds elsewhere may not hold in this system. One-line
  wording change to the static reference data; no behaviour change.

## Session 199 — Negative Branch readability (backlog E)

- **Turning-point guidance.** A Negative Branch Reservation walks an injection → … → UDE *spine*; the
  **turning point** is the edge where it flips from "so far so good" to "yes, but…". A new pure
  derivation (`nbrBackbone`) traces the longest directed injection→UDE spine and finds its first
  negative-polarity edge, and the Edge Inspector now surfaces it: select the turning-point arrow on an NBR
  and it's called out in rose ("this is where the branch turns negative"); on any other NBR arrow, a hint
  ties the (already-wired) negative polarity to the method — mark the arrow where the chain first turns
  against you. Read-only, derived (nothing stored); the ± polarity itself has been rendered on NBR edges
  since Session 180 (*Handbook* Ch. 24, Cohen, **Fig 24-16** — the source diagram this rendering is
  modelled on; go back to it to check fidelity or extend). *(The entity type already labels each node's role —
  Injection / Effect / Desired Effect / UDE — so the "typed roles" ask is met by the existing node label.)*
- **On-canvas spine emphasis.** The canvas now draws the branch the way you read it: the injection→UDE
  spine stays at full strength while **side branches dim** (0.4 opacity, arrowhead included), and the
  turning-point edge carries a rose **"turning point"** badge. Stamped NBR-only in the edge emission
  (`nbrBackbone` computed once, like the loop-polarity pass) via two optional `TPEdgeData` fields that are
  absent on every non-NBR edge — so all other diagrams render byte-identically and no export / e2e visual
  baseline changes.

## Session 199 — Prerequisite-Tree Obstacle/Objective intake table (backlog E)

- **Obstacle/Objective intake table.** A new palette command (*Add obstacles + objectives (intake
  table)…*, Prerequisite Trees only) opens an editable table — one row per Obstacle and the Intermediate
  Objective that overcomes it, plus an optional "show-stopper?" flag and a "blocking factor" note. **Apply
  mints every row in a single undo step**: each row becomes an obstacle + an IO + the `objective → obstacle`
  necessity edge, and when the tree has a single apex goal, each obstacle is also wired to it so the pairs
  aren't left unrooted. The show-stopper flag rides a boolean attribute on the obstacle and the
  blocking-factor note its description — no schema change (*Handbook* Ch. 24, Cohen, Tables 24-10/11). Turns
  a workshop's obstacle brainstorm into a wired PRT skeleton in one paste, instead of one pair at a time.
  The batched-create store action is **`addObstacleIoRows`**, deliberately modelled on **`trimBranch`**'s
  one-`applyDocChange` pattern — that's how batched creates are done in this codebase; follow it rather
  than re-deriving a new shape.

## Session 199 — CLR sharpening (backlog A1)

First slice of the Categories-of-Legitimate-Reservation backlog (Section A). All strictly additive, soft,
and dismissible; new reservation IDs render in the existing tiered Logic-check panel (*Handbook* Ch. 25
App. B, Scheinkopf, unless noted):

- **"Not a complete statement" check** (`entity-fragment`, clarity tier). A single-word entity title on a
  causal / necessity tree gets a nudge — a cause or effect should state *what is happening* ("Backlog
  grows"), not name a thing ("Backlog"). Self-excludes the terse-by-design diagrams (Evaporating Cloud,
  Strategy & Tactics, Freeform) and exempts `unspecified` placeholders. The sharpest, lowest-false-positive
  half of the entity-existence reservation (Fig 25-B2).
- **Additional-cause magnitude prompt.** The `additional-cause` rule now also fires at **exactly two**
  ungrouped causes — the gap between `cause-sufficiency` (one cause) and `indirect-effect` (three or more):
  is each cause enough on its own (leave them separate, or model as an OR), or only enough together (group
  as an AND)? Silent at three-plus, where `indirect-effect` owns the shape.
- **Cause-effect-reversal reworded** to pose the diagnostic question directly: does the cause *make* the
  effect happen, or is it only *how you know* the effect is there? (Fig 25-B6 — "ask why" on symptoms.)
- **Predicted-effect reworded** to ask for a *collateral* effect the injection must also produce (then go
  and check for it). Its companion **timing counter-example** — an effect that appears before its cause
  can't be caused by it — has no structural signal, so it now rides the per-edge scrutiny stepper rather
  than firing as an always-on warning (Fig 25-B7).
- **Compliance-as-CSF warning** (`goalTree-compliance-csf`, clarity tier). A Critical Success Factor whose
  title reads as compliance (law / regulation / GDPR / audit / certification…) gets a soft nudge:
  compliance is usually a Necessary Condition a few layers down — a threshold you must not breach — not a
  make-or-break CSF the goal is built around (Ch. 19, Dettmer).

**Standing decision — our CLR list is 8, and that is deliberate.** The *Handbook*'s canon is 7 categories
in 3 ordered levels and omits `tautology`; we follow **Dettmer's** eight. Keep the 8th — this is not a
removal. Full rationale: **ADR `docs/decisions/0003-clr-list-is-eight-not-the-handbooks-seven.md`**.

Also deliberate: the *"doesn't exist in this environment"* half of entity-existence is **not** a validator
rule — it has no structural signal, so it lives in the per-edge scrutiny stepper. Don't re-propose it as a
"missing rule".

## Session 199 — Entry-point rule (backlog A2)

- **Entry-point rule** (`entry-point`, existence tier; Future Reality Trees + Negative Branch
  Reservations). A cause-only node — one that has effects but nothing causing it — must be either an
  **injection** you'll deliberately introduce or a condition asserted **true in current reality** (its
  `state` tag). Anything else is an unstated assumption holding the branch up, so it's flagged with a
  three-way fix: make it an injection, mark its state as holding today, or connect the cause that produces
  it. Scoped to FRT/NBR — a Current Reality Tree's entry points are its root causes, which are *supposed*
  to be uncaused (*Handbook* Ch. 25, Scheinkopf — the NBR entry-point discipline).
- **Cache-fingerprint fix (behind it).** The validator cache's `validationFingerprint` didn't encode
  `Entity.state`, so this new rule — the first to read `state` — would have returned stale warnings on a
  cache hit (toggle a node to "true" and the warning wouldn't clear). `state` is now part of the
  per-entity fingerprint, with a regression test pinning it.

## Session 199 — Opt-in modes (backlog A4)

- **Jonah quick-check.** A palette command (*Jonah quick-check (fast 4-question pass)*) opens a small
  stepper dialog with four read-aloud questions on the two axes a Jonah checks first — entity vs. causality
  × existence vs. clarity — as a fast on-ramp before the full Categories-of-Legitimate-Reservation walk.
  Read-only guided surface: it reads nothing from the doc, mutates nothing, and the "considered" ticks
  reset when it closes (*Handbook* Ch. 25, Scheinkopf).
- **Progressive CLR gating (Focus mode).** A new opt-in toggle in the Logic-check panel header focuses the
  walk one tier at a time — Clarity → Existence → Sufficiency. When on, a later tier is de-emphasised
  (collapsed to its header + an "N to review · clears after …" line) until the earlier tiers have no open
  reservations left. It never *hides*: a gated tier expands on click, and the toggle is off by default, so
  the panel is unchanged until you ask for the focus. Local view state — nothing persisted
  (*Handbook* Ch. 25 App. B).
- **Goal-Tree NC-depth mode.** The `goalTree-nc-depth` rule normally holds Necessary Conditions to
  Dettmer's two layers — right when the Goal Tree feeds a Current Reality Tree. An opt-in
  `ncDepthMode: 'conflict-resolution'` (palette: *Toggle conflict-resolution NC depth (Goal Tree)*) relaxes
  the cap to five layers for a deeper stand-alone conflict-resolution tree. Doc-level, omitted from JSON
  when unset (strict is byte-identical); a corrupt import drops to strict. The validation fingerprint now
  keys on the mode so a toggle re-runs the depth check rather than serving a stale result (Ch. 19,
  Dettmer). *(More A4 opt-in modes — progressive CLR gating, the Jonah quick-check — follow.)*

## Session 199 — Two AND connectors (backlog A3)

An AND junctor now carries a **flavour** that names which reservation it answers (*Handbook* Ch. 25
App. B, Scheinkopf):

- **Conceptual AND** (the default, the "banana") — the grouped causes are *jointly required*; any one
  missing breaks the effect. This is the *cause-insufficiency* reservation and every existing AND group
  reads this way, byte-for-byte unchanged.
- **Magnitudinal AND** (`andMode: 'additional'`) — the causes each *contribute independently* and each is
  removable. This is the *additional-cause* reservation — the opposite question.

Two palette commands flip a selected AND group between the two (*Mark AND group as additional cause
(magnitudinal)* / *…as jointly required (conceptual)*); the flavour applies to the whole group. The
magnitudinal connector is drawn as a **dashed AND⁺** ring — same geometry as today, so the canvas==export
invariant and all five text/graph exporters are untouched; a conceptual AND stays a solid ring. Stored as
an optional edge field, emitted only when magnitudinal so untouched diagrams round-trip identical; a
hand-edited value is validated (only `'additional'` is legal) and dropped if it has no AND group. *(The
text exporters describe both flavours as an AND group — the distinction is a canvas / teaching aid.)*

Rendered per **Dann's "distinct connector, same geometry" call** — the *independent-arrows* mockup was
rejected to keep the canvas==export invariant intact. Geometry-sameness is a decision, not an
implementation convenience. Full rationale: **ADR
`docs/decisions/0004-magnitudinal-and-distinct-connector-same-geometry.md`**. *(Ch25 App.B.)*

## Session 198 — Cross-tree spawn bridges (backlog C)

Two new command-palette actions that seed one tree from another, following the same **unlinked-spawn**
posture as the existing "Spawn Evaporating Cloud" — each mints a **brand-new document in a new tab and
never touches the source**, so a single diagram stays fully usable standalone (no cross-doc coupling):

- **Spawn Future Reality Tree from this CRT (invert the UDEs).** On a Current Reality Tree, turns each
  undesirable effect into a desired-effect seed titled *"Reverse: &lt;effect&gt;"* (for you to rewrite to the
  positive form) plus one starter injection — the book move that a solution tree's desired effects mirror
  the problem tree's undesirable effects *(Handbook Ch. 20, Goldratt-Ashlag — **Layer 4** of the
  buy-in model)*.
- **Spawn Current Reality Tree from this Goal Tree (benchmark shortfalls).** On a Goal Tree, turns each
  Critical Success Factor / Necessary Condition into a candidate undesirable effect titled
  *"&lt;standard&gt; is not met"* — the shortfall you'd then diagnose *(Handbook Ch. 19, Dettmer:
  a Goal Tree sets the standard, a CRT explains why reality falls short — **Fig 19-10**)*.

Both validate the source diagram type and surface a friendly toast when there's nothing to seed from.
*(The U-Shape cross-tree overview export stays a documented follow-on in NEXT_STEPS §C — it needs
cross-document link-walking, which the unlinked-spawn model deliberately avoids.)*

## Session 198 — Prerequisite / Transition Tree refinements (backlog E)

- **Ongoing-vs-done toggle.** An optional `ongoing?` flag on a Prerequisite-Tree / Goal-Tree objective
  (intermediate objective or goal): an inspector checkbox (in Advanced) marks continuous work, and the
  canvas node shows an **"↻ ongoing"** chip so it doesn't read as a one-time, completable step (Newbold,
  Ch. 5 "What is Done?"). Round-trips through JSON; omitted when unset.
- **Transition-Tree "appropriate condition" test.** A new `tt.appropriate-condition` method step: for each
  action, can you actually take it (span of control + precondition true) and will it avoid serious
  negative side-effects (spin off a Negative Branch if unsure)? The "why" of each action already lives in
  its Need field. *(Ch. 20 Layer 7; Ch. 25.)*

*(At the time of writing, the Obstacle/IO intake table and the fuller NBR typed-roles/polarity work were
still open — both needed net-new UI + a batched-create store action.)* **Correction, Session 206:** both
shipped in **Session 199** — the intake table (`addObstacleIoRows`) and the NBR readability/turning-point
work, each with its own entry above. Nothing from §E remains open.

## Session 198 — Terminology / method / UX polish (backlog F)

Four small, additive quality-of-life items:

- **Goal-vs-Necessary-Condition definitions** — an inspector note on a Goal Tree's goal / CSF / NC nodes
  spelling out the most common modelling mistake: a **Goal** is an optimizing objective (*more is better*),
  a **Necessary Condition** is a threshold (*enough is fine*). *(Ch. 38.)*
- **Goal-Tree tier labels** — an optional `tier?` field (Conceptual / Functional / Operational, Dettmer's
  altitudes) with a picker in the inspector's Advanced section. Advisory; round-trips through JSON,
  omitted when unset. *(Ch. 19 Fig 19-7.)*
- **Six Success Criteria checklist** — a collapsible checklist on an injection (excellent / win-win-win /
  low-risk / simpler / fast-feedback / won't self-destruct) to pressure-test a proposed solution. Stored
  as reserved boolean entity attributes — no schema change. *(Ch. 15 Table 15-4, Barnard; Ch. 34.)*
- **Feedback-loop terminology reconciliation** — the reinforcing/balancing (R/B) loop badge tooltip now
  names the "positive/negative feedback" synonyms and flags that a balancing loop is *not* the same as a
  Negative Branch, reconciling the systems-dynamics and TOC vocabularies. *(Ch. 23, Mabin & Davies.)*

## Session 198 — Strategy & Tactics template pack (backlog G)

Six new Strategy & Tactics starters in the pattern library, built **on the corrected directional model**
(backlog B) — each step is a first-class facet card (strategy + necessary ↑ / parallel ↔ / sufficiency ↓),
authored so it opens position-clean (the apex carries no necessary assumption, leaves carry no sufficiency
one, every decomposition fans out to ≥2 children, and the intentional-leaf rollup nudges are pre-resolved):

- **Reliable Rapid Response**, **Vendor-Managed Inventory**, **Pay-Per-Use**, and **Gain-Sharing** — four
  Decisive-Competitive-Edge / un-refusable-offer templates (Handbook Ch. 22, Lang), abstracted: sell a
  delivery guarantee backed by operational slack; take the stockout-vs-overstock risk off the customer's
  shelf via consumption-driven replenishment; swap the upfront licence for pay-per-use; price on the
  customer's realised gain with your fee at risk.
- **Viable Vision — Build / Capitalize / Sustain** — the generic three-phase Viable-Vision scaffold
  (Ch. 34/18, Ferguson), a reusable skeleton for reaching an ambitious vision on existing resources.
- **Retailer Viable Vision (3-level)** — a deeper retail Viable-Vision tree (central pull replenishment,
  piloted then rolled out, plus re-pointed incentives) whose **middle step carries all four facets** — the
  fullest illustration of the directional model (a necessary assumption up AND a sufficiency assumption down).

Shared recursive `buildSTFacetDoc` builder (arbitrary nesting depth); a test pins that each pattern is a
valid, position-clean facet tree. *The remaining book set stays a documented extension in NEXT_STEPS §G.*
**Correction, Session 206:** the last two Mafia-Offer templates and the healthcare Viable-Vision shipped in
Session 199 (below) — only the 5 generic Viable-Vision trees + the Base/Enhanced scaffold
(*Ch34 Tables 34-1…6*) are still deferred, on curation-over-completeness grounds.

- **Review follow-ups (B + G).** An adversarial review of the S&T change surfaced two real defects, now
  fixed: (1) the `indirect-effect` structural rule (a *causal* "≥3 direct causes → missing intermediate?"
  nudge) fired on the Viable-Vision template's 3-way apex — a wide fan-out of jointly-sufficient sub-steps
  is idiomatic S&T, not a causal smell, so the rule no longer runs on `'st'` diagrams (the template test
  now asserts the full open-warning set is empty apart from the by-design per-edge nudge); (2) the guide
  chapter's deep-dives + worked example + sidebars (and the USER_GUIDE S&T section) still taught the pre-B
  model — the apex with a necessary assumption, leaves with sufficiency assumptions, "every node has all
  five facets", the six-step checklist, and one sidebar that inverted the sufficiency direction — all
  reconciled to the shipped directional/position-aware model. The rules reference in **`appendix-c`** was
  reconciled to the corrected model in the same pass.

## Session 198 — Strategy & Tactics model correction (backlog B)

A Strategy & Tactics tree cascades strategy through nested strategy/tactic pairs; each step carries three
assumptions that the tool previously treated as an undifferentiated, position-blind checklist with cryptic
"NA / PA / SA" labels. Corrected toward Ferguson's directional model (Handbook Ch. 34), strictly additively
— no schema change, the four stored facet keys untouched, existing docs load and render unchanged.

- **Position-aware validators.** The assumptions rule (`st-tactic-assumptions`) is now directional: the
  **necessary** assumption is asked for only when a step has a parent (the apex, with nothing above it, is
  no longer nagged for one), the **sufficiency** assumption only when a step has children (a leaf is no
  longer nagged for one), and the **parallel** assumption on every step. A new `st-tactic-fold-in` rule
  flags a step that decomposes into exactly one sub-step — a real decomposition needs two or more
  jointly-sufficient children, else the single child should fold back in.
- **Directional, plain-language labels + read-aloud.** The tactic card and inspector drop "NA / PA / SA"
  for spelled-out, directional labels — **Necessary** (points up to the parent), **Parallel** (bridges
  strategy ↔ tactic), **Sufficiency** (points down to the children) — each with a hover tooltip. The
  inspector reorders to that sequence, rewrites its placeholders to the directional meaning, and adds a
  read-aloud line built from the filled facets.
- **Analysis-first method gate.** The S&T method checklist gains a leading step — run the full Current
  Reality Tree / Evaporating Cloud / Future Reality Tree analysis first; every assumption should already
  be a validated fact of life; the Strategy & Tactics tree replaces the Prerequisite Tree — and the six
  build steps are reworded to encode the up/bridge/down directions.

## Session 198 — Evaporating Cloud craft (backlog D2–D6)

Finishing the "EC craft" backlog section — a set of opt-in, default-preserving enhancements to how
Evaporating Clouds are built, checked, presented, and diagnosed (Cohen Ch. 24 + Cheng Ch. 27 of the
*TOC Handbook*).

- **D5 — audience-specific verbalisation order.** The verbalisation strip gained an opt-in
  **`D′-first`** toggle: it re-reads the cloud leading with the D′ (own) side's need + tactic before
  the B/D side, following Cohen's advice to present to the listener's own side first so they feel
  heard. `verbaliseEC` grew a `leadWithC` option; default (off) is the canonical B-first reading,
  byte-for-byte as before (pinned by an explicit "matches default token-for-token" test). The
  generator was refactored into two reusable need→want arcs, with "also" attached to whichever arc
  reads second.
- **D2 — storyline pre-step.** The EC creation wizard gained an optional, default-collapsed
  **"Storyline"** field (Cohen's step 2): write the incident factually — "Who / what / when / where?
  What did I want to do? Why? What did I feel forced to do? Why?" — to gather the raw material
  before filling the boxes. Saved to the document's description; EC-only; nothing changes unless
  it's opened.
- **D3 — box-syntax checks.** A new soft clarity rule **`ec-box-causal-words`** flags any cloud box
  whose title reads as a cause-and-effect sentence — it contains *if / because / therefore / in order
  to / sure to* — because a box should be a clean statement and the reasoning belongs on the arrow as
  an assumption (Cohen's syntax rule). Two companion EC method-checklist steps make the judgment calls
  a lint can't: **"Tidy the box wording"** (clean statements; D/D′ are actions, B/C are needs) and
  **"Read the diagonals"** (does D jeopardize C, and D′ jeopardize B?). Warning only, never blocks.
- **D6 — reframe your Need + alternative means.** Cheng's Ch. 27 craft, in two additive surfaces.
  (1) A **"Need or position?"** hint on the two EC Need boxes (B/C) in the inspector: a Need is an
  interest, not a demand — reframe *"prove my point"* → *"be understood"*, because the cloud usually
  only breaks once the real need is named. (2) An **"Alternative means"** brainstorm list on **Want**
  and **injection** nodes: a Want is only one means to its Need (an injection only one way to break
  the conflict), so the list captures other candidates beside the node — one may dissolve the conflict
  without the fight. Stored in a new optional `alternativeMeans` entity field (round-trips; omitted
  when empty; blank rows trimmed away on load).
- **D4 — flipping clouds.** The Rapid 3-cloud diagnosis wizard's consolidation step is now a
  **grid**: each captured cloud shows its D and D′ sides with a one-click **⇄ Flip** button that
  swaps them. Cohen's "Flipping Clouds" (Ch. 24) — consolidation only works when the three clouds
  point the same way (every D the same kind of move, every D′ its opposite), and capturing on the
  fly often lands one back-to-front. Flipping realigns it before you read down the columns. Pure
  `flipConflict` domain helper (involutive); all local wizard state, nothing persists until you
  create the core cloud.
- **Section-D review follow-ups.** An adversarial multi-agent review of D1–D6 surfaced two real
  defects, now fixed: (1) the EC creation wizard's per-session `mode` / `wizardOrder` state leaked
  across sessions (the panel never unmounts), so a cloud type picked for one EC reappeared on the
  next — it now re-seeds from the target doc's `cloudType` on each fresh session, restoring the
  "fresh wizard = generic default" invariant; (2) `summariseConflicts` numbered survivors by
  original index, so a blank non-last conflict produced a gap ("2." with no "1.") — it now numbers
  after filtering. Plus test-hardening: a golden byte-identity string for the default verbalisation,
  `leadWithC` anchor edge/count wiring, malformed `alternativeMeans` imports, flip→create
  provenance, and the two D3 method-step ids.

## Session 197 — Cloud-type wizard modes (backlog D1)

The EC `cloud-type` tag was a dead label — nothing keyed off it. Now the **creation wizard**
optionally reads it to walk Cohen's per-type recipe (*TOC Handbook* Ch. 24, Table 24-9 + the
per-type question tables): each cloud type gets its own **build order**, its own **guiding
questions**, and a **"best arrow to break" hint**.

- **Default preserved (the hard requirement).** A new EC opens in **Generic** mode — the shipped
  A-first/D-first walk, the generic prompts, `doc.cloudType` left unset — byte-for-byte as before.
  The per-type modes are opt-in via a new "Cloud type" selector in the wizard; a
  default-preservation test pins this.
- **Per-type walks:** dilemma/conflict build D→D′→C→B→A (reusing the D-first order, different
  questions each); **fire-fighting** B→D→D′→C→A and **UDE** B→D→C→D′→A are new orders (the
  endangered need is the entry point); consolidated/core build A→B→C→D→D′. Picking a type tags the
  doc (`setCloudType`) and hides the A/D toggle (the type prescribes the order); switching back to
  Generic clears the tag.
- Data: `EC_CLOUD_TYPE_ORDER` + `EC_CLOUD_TYPE_BREAK_HINT` (`domain/ecGuiding.ts`) +
  `EC_STEPS_BY_CLOUD_TYPE` (per-type prompt copy, original app-voice paraphrases of Cohen's tables,
  beside the other wizard copy). The DocumentInspector cloud-type help no longer says "nothing else
  changes." (A per-type *reading* order for the verbalisation strip is deferred to backlog D5, which
  will consume it.) **Correction, Session 206:** D5 did *not* consume it — it shipped only the per-SIDE
  `D′-first` toggle, which never reads `cloudType`. The per-TYPE reading order remains unbuilt and is
  tracked in NEXT_STEPS.
- Tests: `tests/domain/ecGuiding.test.ts` (spec shape) + `CreationWizardPanelECOrder.test.tsx`
  (default preservation, type-switch walk/prompt/tag, restore-to-generic). Docs: `features.json`
  (`ec-cloud-type-wizard`, reviewedThroughSession → 197), USER_GUIDE + guide ch. 5.
- **Incidental fix (found while verifying D1 in-app):** the print reasoning companion
  (`PrintReasoning`) keyed its `<li>` list by the sentence text, so any diagram with repeated
  readings — e.g. a fresh EC whose five empty boxes all read "…Untitled entity…" — tripped React's
  duplicate-key warning ("may cause children to be duplicated and/or omitted"). Now keyed by list
  position; guarded by a `console.error`-spy regression test.

## Session 196 — TOC Handbook (Cox & Schleier) starter bench (18 new templates, 91 → 109)

A read of the *Theory of Constraints Handbook* (Cox & Schleier, McGraw-Hill 2010)
Thinking-Processes chapters, filtered against the shipped library, added a book-sourced
starter bench — 18 patterns broadening coverage into personal, education, rehabilitation,
and change-management domains, plus the library's **first Freeform pattern**.

**The sets:**
- **Evaporating Clouds (11)** — daily-management + personal/education/rehab clouds, Barnard's
  three change-core-conflict meta-clouds, and a fire-fighting cloud: `ec-expedite-vs-hold`
  (Ch. 24), `ec-life-goals-vs-necessities` / `ec-study-vs-enjoy` (Ch. 38), `ec-tease-vs-respect`
  / `ec-standing-vs-safety` / `ec-survival-vs-conscience` (Ch. 26), `ec-reconcile-vs-self-protect`
  (Ch. 27), `ec-when-to-change` / `ec-what-to-change` / `ec-how-to-change` (Ch. 15),
  `ec-contact-vs-procedure` (Ch. 24).
- **CRT (2)** — `crt-forecast-error-supply` (Ch. 22, Lang), `crt-why-change-stalls` (Ch. 5,
  Newbold — an AND-junctor onboarding meta-example).
- **NBR (1)** — `nbr-contact-customer` (Ch. 24), the negative branch of the fire-fighting
  injection; a worked EC → NBR handoff.
- **Goal Tree (2)** — `goalTree-personal-life` (Ch. 38, five life facets),
  `goalTree-fabrication-shop` (Ch. 19, Dettmer — a valid four-CSF IO map).
- **PRT (1)** — `prt-raise-class-performance` (Ch. 26, a TOC-for-Education Ambitious Target Tree).
- **Freeform (1, the library's first)** — `freeform-buffered-todo` (Ch. 38), a red/yellow/green
  buffer board; `'freeform'` joins `TYPE_BLOCK_ORDER` and auto-surfaces a filter chip.

**Dedup → enrich, not discard.** Where a book item overlapped a shipped pattern, its additive
value was folded into the existing pattern rather than added as a duplicate:
`ec-speak-up-vs-stay-safe` gained the Ch. 38 athlete/coach assumptions + injection;
`ec-cost-vs-throughput` gained Barnard's "an idle resource is a major waste" (challengeable)
assumption + a DBR injection note. The Ch. 15 Five-Question CI "bundles" were **not** added —
their CRT/FRT halves duplicate the Session-193 canon and the shipped DBR / Critical-Chain /
pull-replenishment FRTs, and the Barnard Why/What/To-what/How *chaining* belongs to a future
workflow feature, not a template.

**Legal posture** (same as Session 193): every node text is original abstracted wording; no
company / character / person names from the Handbook's worked cases (the plant-floor,
label-printer, welding-shop, and change-case company names, and the education / prison personal
identifiers, are all dropped); each builder's TSDoc references the Handbook chapter + author
factually without retelling scenes and ends "Node text is original."

**S&T deferred.** The Mafia-Offer "decisive competitive edge" pack + the Viable-Vision trees are
held for a later delivery, after the S&T assumption-model correction (they'd otherwise be built
on the current model and need rework).

Tests: a new `TOC Handbook set (Session 196)` block in `patterns.test.ts` hard-lists the ids and
spot-checks the assumption / note / AND-junctor / CSF / obstacle shapes and the enrichments.
Docs: `features.json` (`patterns-toc-handbook-set`, `reviewedThroughSession` → 196), guide
sidebars (ch. 6 / 7 / 9 / 11 counts), library totals (ch. 2, USER_GUIDE, glossary).

## Session 195 — Dettmer figure fold-in: Efrat's assumptions + IO-Map build discipline

Two figures from Dettmer's *The Logical Thinking Process* (2007), folded in as
data + validators + docs (all wording paraphrased, lineage credited):

**Fig 8.3 — "Efrat's Cloud" (used there with Efrat Goldratt's permission):**
- `ec-efrats-change-cloud` now ships **fully assumptioned** — the 14 published
  assumptions attached as first-class `Assumption` records behind the four
  support arrows (3 B→A, 4 D→B, 4 C→A, 3 D′→C), numbered #8–#21 in the
  figure's order. The D′→C three arrive `challengeable` — exactly what
  breaking channel 1 attacks — and the channel notes now cross-reference the
  assumption numbers they break (#19–#21) or build on (#11–#14). First
  library pattern to exercise the assumption layer end-to-end.
- `buildECPattern` grew an optional zero-default `assumptions` spec field
  (per-arrow text + status); every other cloud is untouched.

**Fig 3.14 — the abbreviated IO-Map construction checklist:**
- Three new dismissible clarity validators: `goalTree-ncs-per-csf` (more than
  five direct NCs under one CSF), `goalTree-nc-depth` (an NC deeper than two
  layers below a CSF — that detail belongs in a PRT), and `goalTree-junctor`
  (AND/OR/XOR groups have no place in a single-arrow necessity tree — the
  grouping verbs aren't diagram-gated, so this was reachable).
- Goal Tree method checklist synced 5 → 7 steps: prepended "Define the system
  boundary", appended "Enlist outside scrutiny" (pointing at share link +
  comments), and folded the owner-consensus + 3–5-per-CSF + two-layer bounds
  into the existing hints.
- Guide: ch. 9 gained a "Dettmer's construction checklist" section (+ sidebar
  sync), ch. 5's Efrat section now points at the shipped assumptions,
  appendix C documents the three new rules.

## Session 194 — Technology-value Goal Tree pattern (90 → 91)

Added `goalTree-new-technology-outcome` to the Templates library — Dann's own
MindManager-era technology-value map, poured into Goal-Tree necessity form.
Apex: *New technology brings increased outcome*; two arms, each necessary:

- **The technology diminishes a limitation** (Goldratt's *Necessary But Not
  Sufficient* dictum, carried as a description on the CSF) — needs the new
  technical opportunities plus the ability to use them, which decomposes into
  seeing the limitations, breaking them, and implementing new rules.
- **The system is used** — needs a working system (functions properly + can be
  adapted) and user adoption.

Second two-arm Goal Tree after `goalTree-it-function` (same own-work verbatim
carve-out; the soft 3–5-CSF nudge fires by design), and the first pattern to
exercise **nested NCs** (NC → NC necessity edges, 5 of the 11 links) — pinned
by a registry shape test. Guide chapter 9's starter list was stale at "six"
(missing the two Session-193 trees); now lists all nine.

## Session 193 — Goldratt canon + published-case pattern set (21 new templates, 69 → 90)

A deep-research pass first established what can honestly be derived from the TOC
literature, then shipped it: 21 curated patterns in `src/domain/patterns/`, wired
into the unified Templates library.

**Research findings that shaped the set** (adversarially verified, multi-source):
the five classic TP tools postdate *The Goal* — they debut as a codified suite in
*It's Not Luck* (1994), with the EC first published in the 1990 non-fiction *What
Is This Thing Called TOC* — so all *The Goal* / *Critical Chain* diagrams are
labelled **retrospective reconstructions** in their TSDoc. The Goal Tree is
Dettmer's post-2002 tool (after Oded Cohen's IO Map) and the S&T tree appears in
no Goldratt novel, so the T/I/OE Goal Tree credits Goldratt for content and
Dettmer/Cohen for form, and no new S&T or TT patterns were attempted (no
node-complete published example of either exists — even Mabin & Cavana 2024
omits both).

**The sets:**
- ***It's Not Luck*** (the novel that showcases the tools): `ec-divest-or-grow`,
  `crt-commodity-price-trap`, `frt-market-offer` + `nbr-market-offer` +
  `prt-market-offer-rollout` (the un-refusable-offer trilogy),
  `frt-pull-replenishment` (also crediting *Isn't It Obvious?*), and the
  `ec-teenager-trip` everyday cloud.
- ***The Goal*** (retrospective): `crt-failing-plant`, `frt-plant-turnaround`,
  `nbr-robot-efficiencies`, `goalTree-money-now-and-future` (T/I/OE).
- ***Critical Chain***: `crt-why-projects-slip`, `frt-critical-chain`.
- ***The Choice***: `crt-forecast-committed-fashion`, `ec-forecast-vs-react`.
- **Mabin & Cavana 2024 public-policy suite** (*System Dynamics Review* 40(4),
  open access; the only node-complete published TP analysis found): CRT, EC,
  Goal Tree, NBR, FRT, and PRT on the NZ supermarket-alcohol question —
  `crt-alcohol-availability`, `ec-alcohol-policy`, `goalTree-alcohol-policy`,
  `nbr-alcohol-ban`, `frt-alcohol-policy-mix`, `prt-alcohol-ban-rollout`.

**Legal posture** (researched against *Twin Peaks v. PIL* / *Nichols*, which
killed scene-level paraphrase as an option): every node text is original
abstracted wording; no character or company names from the novels; TSDoc
references the books factually without retelling scenes; the Mabin & Cavana
(CC BY-NC-ND) and Gupta & Kerrick material is paraphrased, never copied, with
citation. `ec-project-task-safety`'s TSDoc now cites Gupta & Kerrick (JITIM
23(3/4), 2014) as independent published validation of its cloud.

Tests: registry-guard block pins all 21 ids + structural spot-checks (condensed
alcohol PRT 11/10-necessity, alcohol NBR shape, failing-plant double-AND). Docs:
USER_GUIDE Templates-library section + book ch. 2 count, `features.json`
(`patterns-goldratt-set`, reviewedThroughSession → 193).

## Easter eggs (remote session) — Goldratt's dice game + the cloud that actually evaporates

Two hidden rewards for people who know their TOC lore. Deliberately
undocumented in USER_GUIDE/README — an easter egg advertised is an easter
egg wasted; this entry is the only paper trail.

**Goldratt's dice game** (`src/domain/diceGame.ts` +
`components/dice-game/DiceGameDialog.tsx`): the match-bowl game from *The
Goal* ch. 14, playable. Five stations in a line, one die each per round,
each station passes `min(roll, upstream inventory)` downstream with
same-round flow-through (the book's passing rule). Scoreboard, per-station
starvation tinting, cumulative actual-vs-3.5×rounds SVG chart, auto-roll,
and a punchline card at round 20 ("now go find your Herbie"). The sim is
pure + seeded (mulberry32 carried in the state — no `Math.random` in
domain), so tests assert exact games. Reached two ways:

- **Hidden palette command** — new `Command.hidden` (excluded from the
  empty-query browse view; still matched by queries and still surfaces in
  Recent once run) + `Command.keywords` (extra `paletteScore` terms beyond
  the label, best score wins). Typing `dice`, `herbie`, `goldratt`,
  `the goal`, `bottleneck`, or `matchsticks` reveals "Play the Dice Game…".
  Both fields are generic palette features, usable beyond the egg.
- **Five clicks on the About dialog's version line** (styled as plain text
  on purpose; counter resets when the dialog closes).

Dialog is `React.lazy` like every other dialog, so none of it ships in the
eager `index` chunk (new chunk is `unbudgeted` — reported, not gated).

**The cloud that actually evaporates** (`src/domain/cloudResolution.ts` +
`components/canvas/hooks/useCloudEvaporation.ts`): on an EC doc, when an
assumption on the D↔D′ conflict arrow is first challenged by an
**implemented** injection, the two Want cards play a 2.4s wisp-up-and-
settle-back animation (`tp-evaporate` keyframes, `--anim-speed`-scaled so
reduced-motion collapses it) + a "You evaporated the cloud. Goldratt would
be proud." toast. Earned, not triggered — it fires only on completing the
method properly. `resolveCloudState(doc)` deliberately reuses the
Injection Workbench's existing semantic (ONE broken assumption evaporates
the cloud — TOC-correct), so the two surfaces can't drift. Rising-edge
only, baseline keyed by doc id: mount/tab-switch onto an already-broken
cloud replays nothing, no persisted flag needed; un-implement +
re-implement re-arms it. Transient state lives in a new
`uiSlice/effectsSlice.ts` (one-shot canvas effects — not modal-ish, so not
`dialogsSlice`); TPNode reads membership via its existing shallow selector
(a derived boolean, so only the two Want nodes re-render).

No schema change (nothing persists), no new dependencies. Tests: exact
seeded-game + conservation/starvation invariants for the sim; predicate
matrix for `resolveCloudState`; rising-edge/tab-switch/re-arm contracts
for the hook; hidden/keyword palette behaviour; the About 5-click trigger.

## Docs coverage review (remote session) — USER_GUIDE + practitioner book accuracy pass

A full coverage audit of the user manual and the book against the current
feature surface (command registry, UI components, validators, exporters,
settings), followed by the fixes. Docs-only — no code changes.

**USER_GUIDE.md — staleness corrected:**

- **Assumption removed from every palette listing** (six spots): it's an edge
  annotation via the Assumption Well / `A` key, not a Type-grid entity.
- **Per-diagram palette commands** (`New Current Reality Tree`,
  `Load example Evaporating Cloud`, …) replaced with the current
  `New diagram…` / `Load example…` picker form; individual
  `Export as X` / `Import from X` commands rerouted through the
  **Export…** / **Import…** pickers; share link → the top-bar **Share**
  button; history panel → the top-bar clock button; Browse Lock → the
  ⋮ overflow (the standalone lock button and `Toggle Browse Lock`
  command no longer exist).
- **"No TT/PRT-specific CLR rules yet" claims corrected** — documented
  `complete-step` + `tt-action-locus-unset`, `prt-obstacle-no-io` +
  `prt-io-no-obstacle`, `goalTree-csf-no-ncs` + `goalTree-csf-count`,
  and `st-tactic-rollup`.
- **Removed `cycle` rule references**; documented back-edge auto-detection.
- **`ec-completeness` description** aligned with the actual five checks.
- **Settings section rewritten for four tabs** — added the per-document
  **Layout** tab (Direction / Compactness / Bias), Layout density, Edge
  routing, and the three Creation-wizard toggles (the CRT wizard was
  undocumented).
- **"Pattern library…" → unified Templates library** wording.

**USER_GUIDE.md — gaps filled:** a **Negative Branch Reservations** section
(the diagram type had no home); Group **Presets**; archive/unarchive +
show-archived-groups; *Select all entities of the same type*; **Risk
Register CSV** and **EC Workshop Sheet** export descriptions; selection-
toolbar TT/PRT verb rows; keyboard rows for `Cmd/Ctrl+\`, `F2`, `A`,
`Cmd/Ctrl+D`; click-to-type zoom; the Start-page landing in "Starting up".
Also: ToC renumbered (it had drifted), and session-number stamps stripped
from headings/prose (changelog-speak removed from user-facing docs).

**Book (`docs/guide/`) — same accuracy pass across all 17 chapters +
appendices:** assumption-as-annotation rewrite (ch 1, 4, 5, 12 + glossary);
cycle-rule removal + loop auto-detection (ch 3, 13 + glossary); unified
Templates library + `New diagram…` command form (ch 2, 4, 5, 7–11);
group-preset table corrected (Negative Branch is rose; NSP Block is the
S&T NA/SA/PA triple; Step is the TT triple wrapper); Assumption Well
unified in the Edge Inspector (ch 5, 12); EC verbal style lives in the
Document Inspector (ch 15); removed `Open history panel` /
`Branch from current revision` / `Compare with revision…` phantom
commands (ch 14) and documented **Auto-snapshot while editing**;
chapter 16's export groups realigned to the picker's real five
categories (+ copy-image-to-clipboard, last-used memory); count fixes
("three supports" → four, "Five gestures" → six, "All five" → six).
**Structure:** chapter 6 gains a standalone-NBR callout (the NBR
diagram type was absent from the book); chapter 13 gains a **Logic
chip / Logic-check panel** section and the per-type rule-family map;
appendix B gains the missing shortcuts (arrow-walk, group keys,
`Cmd/Ctrl+\`, `F2`, `Cmd/Ctrl+D`/`+A`) and drops the phantom `?` key;
appendix C gains the six missing rules + matrix rows and drops the
stale "PRT rules are parked" note; appendix D rewritten for the real
four-tab Settings dialog (the "Behavior — advanced" section it
described doesn't exist); appendix E glossary entries corrected
(Assumption, Back-edge, CLR count, Templates library, + Start page);
appendix G gains PRT / Goal-Tree / feedback-loop smell rows. Foreword
+ AUTHORING version notes bumped v9 → v10.

## Session 192 (cont.) — Improvement-review batch 5 (last item): linked-file staleness + write-through Save

Closes the final open item from the improvement-review backlog.

- **The linked-file chip flags unsaved changes.** A document linked to an
  on-disk file (File System Access "Save to file") shows its filename in the
  title bar; that chip now turns **amber with "· unsaved"** once you edit past
  the last write, and returns to the calm green "linked" state after a save.
  Backed by a `savedAt` timestamp recorded on every write and the pure
  `isDirtySinceSave` predicate.
- **Ctrl/Cmd+S writes through to the linked file.** Previously ⌘S only flushed
  the localStorage autosave; now, when the document is linked to a file, it
  re-writes that file on disk (and re-stamps `savedAt`, clearing the chip). With
  no linked file it falls back to the localStorage flush + "Saved to this
  browser" exactly as before. The write path is shared with the "Save to file"
  palette command (`saveToLinkedFile`) so the two can't drift. (File System
  Access is Chromium-only; other browsers keep the localStorage flush.)

## Session 192 (cont.) — Improvement-review batch 7 (part 2): manual sibling ordering

Auto-layout (dagre) ordered sibling nodes by its own crossing-minimization
heuristic, with no way to override the left-to-right (or top-to-bottom) order.

- **Reorder siblings in an auto-layout diagram.** Right-click a node →
  **Move earlier / Move later in layout** shuffles it among the nodes sharing
  its rank. The order sticks (persisted per entity as `ordering`) and survives
  re-layouts. It's a post-dagre pass that permutes a *fully-ordered* rank into
  its manual order using the nodes' own slots — rank + spacing untouched — and a
  **strict no-op** for any diagram that doesn't use it, so nothing else moves.
  The `ordering` field already drove Presentation mode + the TT step badge; it
  now drives layout too. The menu items appear only for auto-layout diagrams and
  only when the node actually has a sibling to swap with.

## Session 192 (cont.) — Improvement-review batch 7 (part 1): compose from templates + faster capture

- **Insert a template into the current diagram** (not just open it in a new tab).
  Pattern Library cards of the same diagram type as the open doc now carry a
  "+ Insert here" action that merges the template's whole subgraph into your
  diagram — fresh ids, continuing annotation numbers, a small offset so it
  doesn't land on existing content, and (unlike a clipboard paste of a partial
  selection) its AND/OR/XOR junctors and entity groups are carried over with
  remapped ids so the pattern's logic survives. One history step — Ctrl/Cmd+Z
  removes the insert. New `mergeDocIntoActive`.
- **Filter the "All trees" gallery in place.** The All-trees view gained an
  inline search box that narrows the grid by tree title or diagram-type tag
  (e.g. "crt", "sales") as you type — distinct from the header's ⌘K palette
  search. Client-side over the already-loaded trees, so it's instant.
- **Quick Capture into a selected group.** With a single group selected, the
  whole captured list is dropped into that group as members (the dialog says so
  up front), instead of only being able to attach roots to a selected entity.

## Session 192 (cont.) — Improvement-review batch 6: visual / UI consistency

Four canvas + inspector polish items, shipped as one slice.

- **The colour palette now recolours node stripes and the minimap, not just
  edges.** The Appearance setting (renamed **Edge colors → Color palette**) is
  now one accessibility switch: `Default` / `Colorblind-safe` (Wong) /
  `Monochrome` applies to node stripes, edges, the minimap, and the building-
  blocks rail together. `Default` reproduces the existing colours exactly, so
  nothing changes until you opt in. New `NODE_STRIPE_PALETTES` + a palette-aware
  `resolveEntityTypeMeta`; custom entity-class colours are never overridden.
- **Corner badges no longer overlap.** A pinned node that also shows the
  reverse-reach pill, or a numbered (ordered) node that also has open comments,
  previously stacked two badges in the same corner. The second badge now offsets
  along the edge (a fixed, width-independent lift) so both stay readable.
- **The entity inspector's secondary controls are collapsible.** The
  **Appearance** (title size + per-entity icon — the tallest block) and
  **Advanced** (unspecified-placeholder + locus) groups fold into collapsible
  sections, collapsed by default, so the core Title / Type / Description / State
  fields sit above the fold. Open/closed state persists per-section across entity
  switches and reloads.
- **State chips are now direct pickers, not forward-only cycles.** The
  Assumption Well (status + kind) and Evidence list (source + strength) chips
  became compact colour-coded `ChipSelect` dropdowns — any value in one pick,
  keyboard- and screen-reader-navigable — instead of click-to-advance-one-step.

## Session 192 (cont.) — Improvement-review batch 4: last-used export + non-Latin-1 caution

Two rough edges in the export/print flow.

- **The Export picker remembers your last format.** Reopening Export now
  auto-focuses the format you last exported (so Enter repeats it) and marks that
  card "Last used". Persisted best-effort in `localStorage` via a small
  `recentExports` helper (single id, degrades to session memory if storage
  throws); a fresh picker with no history looks and focuses exactly as before.
- **Print / Save-as-PDF warns about characters the built-in fonts can't draw.**
  jsPDF's standard fonts are Latin-1 only, so a diagram with Cyrillic / CJK /
  Greek / emoji text printed blank or garbled glyphs with no warning. A new pure
  `hasNonLatin1` scans the text bound for the PDF; the Print dialog shows an
  amber caution under the export buttons (pointing users to the browser's own
  Save-as-PDF for full Unicode), and the EC workshop-sheet export appends the
  same caution to its success toast. Browser print is unaffected and stays
  silent.

## Session 192 (cont.) — Improvement-review batch 4: PPTX tall-diagram tiling

The PowerPoint deck's diagram slide `contain`-fit a single image, so a tall
(portrait) tree shrank to an unreadable postage stamp in the middle of the slide.

- **Tall diagrams now tile across multiple crop-band slides.** A new pure
  `pngDimensions` (decodes width/height from the captured PNG's IHDR) + a pure
  `computeCanvasBands` decide, from the diagram's aspect ratio, whether it fits
  one slide (the common landscape case — unchanged `contain` behaviour) or needs
  N vertical bands, each shown at full slide width via `sizing: 'crop'` and
  titled "The diagram (k / N)". Both helpers are unit-tested; the pipeline test
  asserts a tall capture yields multiple cropped slides.

## Session 192 (cont.) — Improvement-review batch 5: auto-snapshot while editing

A facilitator who works in one tree for a two-hour workshop without swapping
tabs accumulated ZERO snapshots — the compare / branch / diff machinery was
useless for exactly the session with the most change, since snapshots only fired
on document swap.

- **New opt-out "Auto-snapshot while editing" Behavior setting (default ON).**
  A committed edit now captures an `Auto` revision, gated so it fires at most
  once per interval (~3 min) AND only when the doc actually differs from the
  newest snapshot (`computeRevisionDiff` / `isEmptyDiff`). The cheap time gate
  keyed on the newest revision's `capturedAt` runs on every edit (one
  `Date.now()` compare); the heavier diff runs only once the window elapses, and
  the gate respects manual snapshots + survives reloads.
- Wired at the central `applyDocChange` persist seam in `docMutate.ts`;
  `captureSnapshot` writes to the separate revisions store, so there's no
  mutation recursion. Preference persisted alongside the others; a Behavior-tab
  toggle + the revision-panel help text explain it. (`resetStoreForTest`
  disables it so unit-test edits stay deterministic.)

## Session 192 (cont.) — Improvement-review batch 5: in-app prompt dialog

The revision panel's **Branch** action was the one place still using a native
`window.prompt` — a jarring, un-themed, thread-blocking box that some PWA/WebView
embedders reject outright, against the app's own in-app-dialog convention.

- **New async `prompt()` store action + `<PromptDialog>` shell + `PromptDialogHost`**,
  the exact sibling of the existing `confirm()` / `ConfirmDialog` split (store-free
  vendorable shell + app-layer host). `prompt(): Promise<string | null>` resolves
  the entered string on submit (Enter), `null` on Cancel / Esc / backdrop. The
  input auto-focuses + selects its seeded value; `promptDialog` joins the global
  Esc cascade right after `confirmDialog`.
- Branch-from-snapshot now `await prompt('Branch name?', …)` instead of
  `window.prompt`. The lone `window.prompt` call in the app is gone.

## Session 192 (cont.) — Improvement-review batch 4: copy diagram image to clipboard

The single most common report/slide action — copy the picture, click into the
doc, paste — didn't exist; every image export was a file download requiring a
find / insert / delete dance.

- **New "Copy image to clipboard" export** (first item under Images). Reuses the
  in-memory PNG capture (`capturePngDataUrl`), converts it to a Blob, and writes
  a `ClipboardItem({ 'image/png' })`. Graceful fallbacks: browsers without the
  async Clipboard image API (older Firefox/Safari) fall back to a normal PNG
  download with an explanatory toast; an empty canvas or a denied permission
  toasts accordingly. `copyPngToClipboard(nodes)` in `exporters/image.ts`.

## Session 192 (cont.) — Improvement-review batch 5: delete-tree Undo

Deleting a saved tree from the Start library used to be instant and
irreversible — one misclick on the hover trash button destroyed the tree, with
only a modal between the user and permanent loss (starkly asymmetric with the
app's otherwise-meticulous three-tier crash recovery).

- **`deleteSavedDoc` now fires an Undo toast.** It captures the full doc body
  before removal (open tab → in-memory; closed library doc → `loadSavedDoc`) plus
  the pre-sweep versions of any docs whose inbound cross-doc links get stripped,
  then shows `Deleted "…"` with an **Undo** action that re-persists the body +
  restores those links and refreshes the Start library. Reuses the existing
  ToastAction rail — no storage-format change.
- The delete-confirmation copy is softened from "this can't be undone" to point
  at the Undo toast.

## Session 192 (cont.) — Improvement-review batch 8c: PRT + Goal-Tree structural validators

PRT and Goal Tree previously had NO type-specific structural validators (PRT ran
only the generic structural set; Goal Tree added just the multi-goal + logic-type
nudges) even though their entity models fully define the structure. Four new pure
graph-query rules, each mirroring a shipped CRT/NBR rule:

- **`prt-obstacle-no-io`** — an Obstacle with no Intermediate Objective
  overcoming it (no incoming `IO → obstacle` edge). The PRT is incomplete until
  every obstacle has a plan to remove it.
- **`prt-io-no-obstacle`** — the symmetric check: an IO that overcomes no
  obstacle (no outgoing edge to an `obstacle`).
- **`goalTree-csf-no-ncs`** — a Critical Success Factor with no Necessary
  Conditions beneath it (no incoming `NC → CSF` edge); a rollup-sufficiency gap.
- **`goalTree-csf-count`** — a Dettmer-pattern scope nudge (typically 3–5 CSFs),
  the Goal-Tree analogue of `crt-ude-count`; document-targeted, silent below one.

New `ClrRuleId`s + registration on the `prt` / `goalTree` sets; full unit tests.

## Session 192 (cont.) — Improvement-review batch 8b: additional-cause + S&T-assumptions validators

Two more CLR validators were validating the wrong thing:

- **`additional-cause` now implements its own reservation.** It previously fired
  ONLY when a terminal effect (UDE / desiredEffect) had *zero* incoming causes —
  a cause-*existence* check misfiled under the additional-cause name, and already
  covered for CRT by `crt-ude-no-upstream`. It now ALSO fires the real reservation
  on a terminal effect with exactly one ungrouped cause — "only one cause is
  captured — could a *different*, independent cause also produce this? model the
  alternatives as an OR" — and self-silences once a second cause or an OR/XOR
  junction is added (mirroring how `cause-sufficiency` stops on AND-grouping). The
  zero-cause nudge is kept (NBR/FRT rely on it).
- **`st-tactic-assumptions` now reads the canonical facet representation.** It
  counted incoming `necessaryCondition` *entities* — a representation nothing else
  in the app uses — so a tactic with all three assumption facets filled on its
  5-facet card was still flagged "missing 3," while three unrelated NC children
  passed with empty facets. It now counts the reserved `stNecessaryAssumption` /
  `stParallelAssumption` / `stSufficiencyAssumption` attributes and names which of
  NA / PA / SA is missing.
- **Validation fingerprint** now encodes each S&T facet's filled state (was a
  single "has any facet" bit) so a 1- vs 2- vs 3-facet tactic re-validates instead
  of colliding on a stale cache — the same class of bug fixed for or/xorGroupId in
  8a, and necessary for the count-based rule above to be correct on a cache hit.

## Session 192 (cont.) — Improvement-review batch 8a: CLR validator correctness fixes

A TP-methodology review surfaced real correctness bugs in the CLR validators
(two rules read the wrong thing about junctors, one skipped a diagram whose
logic is unambiguous, and the validation cache silently defeated the first two):

- **`indirect-effect` and `cause-sufficiency` now exempt ALL junctor kinds**,
  not just AND. An explicit OR or XOR group is the same deliberate "these causes
  converge directly" commitment as AND, so a legitimate ≥3-way OR fan-in no
  longer spuriously trips "could some chain through intermediate effects?" Both
  rules switch from `!edge.andGroupId` to `!junctorGroupId(edge)`.
- **`logic-type-mismatch` now covers Evaporating Clouds.** EC support edges are
  uniformly necessity-typed by design, so a sufficiency-typed EC support edge is
  the same novice error the rule catches on Goal Trees — it was silently
  accepted. `ec: 'necessity'` added; the D↔D′ mutual-exclusion edge is skipped
  (it isn't a causal support link).
- **Fixed the validation fingerprint** to include `orGroupId` / `xorGroupId`
  (it only encoded `andGroupId`). Without this the validation cache returned a
  stale result when only OR/XOR grouping changed — which would have silently
  defeated the two junctor fixes above on a cache hit. New fingerprint test
  locks that OR/XOR grouping invalidates the cache.

## Session 192 (cont.) — Improvement-review batch 3: semantic minimap + select-all-of-type

- **Minimap thumbnails are now coloured by entity type** (its stripe colour)
  instead of a uniform grey, so the minimap reads as a semantic map. Groups keep
  the indigo tint; custom / unknown types fall back to neutral grey. Uses the
  static `ENTITY_STRIPE_COLOR` table so the callback stays a stable module
  constant (no per-render identity churn).
- **"Select all entities of the same type as the selection"** palette command —
  type is a primary TP navigation axis ("show me every UDE / obstacle / IO").
  Matches on the raw `type`, so custom classes work like built-ins.

## Session 192 (cont.) — Improvement-review batch 3: command palette jumps to entities

The prominent "Type a command…" field returned "No matches" when a user typed
an entity title — the top navigation intent on a large tree only worked via the
separate, less-discoverable `Cmd/Ctrl+F`.

- **Command palette now offers "Go to: <title>" rows** for entity + group title
  matches (capped, deduped) below the command matches, so typing a node's name
  jumps the viewport + selection to it. Implemented as synthetic `goto:` commands
  so they reuse the palette's existing render / keyboard / ARIA machinery.
- **Extracted a shared `jumpToEntity` helper** (expand collapsed ancestors →
  unhoist if needed → select → centre, honouring reduced-motion) used by BOTH
  the palette and the Find panel, so the two navigation surfaces can't drift.
  The Find panel's inline jump logic now delegates to it.

## Session 192 (cont.) — Improvement-review batch 3: Find covers assumptions + comments

Find (`Cmd/Ctrl+F`) was the document's single locator but ignored two shipped
first-class record types that carry substantial user text:

- **Find now indexes assumption text and review-comment bodies** alongside
  entity titles/descriptions, group titles, and edge labels. Jumping to an
  assumption selects its host edge (its assumptions surface in the Edge
  Inspector); jumping to a comment selects the anchored object and opens the
  comments panel.
- **Result rows show the entity type** for entity hits (via a new
  `entityType` field on `Match`), so a "Quality UDE" reads as `UDE · title`.
- Removed the dead `field: 'author'` `Match` variant (a "reserved for Phase 6"
  slot the code never produced). USER_GUIDE's stale field list corrected.

`useSearchDimming` is unaffected (the new kinds' ids simply don't match any
canvas node/edge). New unit tests cover assumption/comment indexing + the
entity-type field.

## Session 192 (cont.) — Improvement-review batch 2: accessibility

Three accessibility fixes so the WCAG-AA promises match the code:

- **Honour `prefers-reduced-motion`.** There was zero handling despite the AA claim. On the
  `Normal` animation speed the app now leaves `--anim-speed` to CSS, and a new
  `@media (prefers-reduced-motion: reduce)` rule collapses it to 0 — so the OS "reduce motion"
  setting minimises canvas transitions automatically. An explicit Instant/Slow/Fast choice still
  overrides. JS-driven camera moves (React Flow `fitView`) read a new `prefersReducedMotion()`
  helper and pass `duration: 0` under the setting. Behavior-tab note + USER_GUIDE corrected.
- **One arrow-key navigation model.** Two handlers used to bind the arrows — a causal
  ↑effect/↓cause variant in `useSelectionShortcuts` and the geometric nearest-neighbour walk in
  `useArrowKeyNodeNav` — with the winner decided by whether the node had DOM focus (Tab) or was
  merely click-selected, contradicting the printed shortcut reference. The causal branch is
  removed; `useArrowKeyNodeNav` is now the sole owner and gained a store-selection fallback so a
  click-selected node (no DOM focus) navigates identically. Shortcut labels + USER_GUIDE aligned;
  the registry-link test now also scans the arrow-nav hook.
- **Reading-order canvas Tab traversal.** Entity nodes are emitted top-to-bottom, left-to-right by
  on-screen position (new pure `readingOrder` helper, rank-quantized for a valid total order)
  instead of creation order, so keyboard / screen-reader Tab tracks the diagram the way the eye
  reads it. Nodes don't overlap and stacking is zIndex-driven, so the change is visually inert.

## Session 192 (cont.) — Improvement-review batch 1: core authoring hot path

A grounded product/UX review flagged constant friction in the single most-used loop — sketching
cause/effect chains. Four additive fixes, all opt-in-free (no schema change):

- **Drag a connection into empty canvas now creates a connected node.** Releasing a connection
  drag in empty space was a silent no-op; it now mints a fresh entity at the drop point and wires
  it, with direction from the grabbed handle — a bottom (cause) handle extends to a new child, a
  top (effect) handle to a new parent (mirrors `Tab` / `Shift+Tab`). The new node opens in edit
  mode. Manual-layout diagrams (EC / freeform) seed the drop coordinate; auto-layout lets dagre
  place it. The pure drop-resolver (`resolveConnectEndTarget`) gained a `create-and-connect`
  variant so the priority order (node → junctor → edge → empty) stays unit-tested.
- **Paste now offsets each copy** by a diagonal step instead of dropping it exactly on the source
  (previously hidden behind the original). Repeated pastes of the same clipboard fan out via a
  cascade counter that resets on every fresh copy.
- **Duplicate (`Cmd/Ctrl+D`)** — clone the entity selection in place (one step offset) *without*
  touching the copy/paste clipboard, so duplicating never clobbers what was last copied. Surfaced
  as a palette command and on the selection toolbar / context menu (single + multi entity).
- **Select All (`Cmd/Ctrl+A`)** — select every entity in the document, the fast gateway into the
  multi-selection bulk actions. Skipped while typing so native text-select still works.

Clipboard logic was refactored to a shared `cloneIntoDoc(payload, offset)` core behind both paste
and duplicate. New tests cover the offset cascade, the copy-buffer isolation of duplicate, and
both create-and-connect directions; `shortcuts.ts` + the registry-link test carry the two new
keys.

## Session 192 — `@studio/ui` extraction prep + app-wide accent token

Groundwork for vendoring `src/components/ui/` into a shared `@studio/ui` + `@studio/tokens`
package (consumed by `mece-studio` / `mindmap-studio` via git sync). No package created, no
build config changed — the app is left functionally + visually identical.

- **Audit + docs.** `src/components/ui/README.md` (export contract — "components in `ui/` never
  `useDocumentStore()`; they take all state as props" — + readiness checklist), `INVENTORY.md`
  (per-primitive catalogue + gaps), and `EXTRACTION_AUDIT.md` (store / tokens / hooks scans).
- **Decoupled `ConfirmDialog` from the store.** It's now a pure, prop-driven shell
  (`open`/`children`/`confirmLabel?`/`cancelLabel?`/`onConfirm`/`onCancel`); the store wiring
  moved to a new app-layer host `components/ConfirmDialogHost.tsx`. After this, **zero** store
  imports remain anywhere in `ui/`.
- **App-wide semantic accent token.** Added a full `accent` colour scale
  (`--color-accent-50…950`, = the existing indigo values) to the Tailwind `@theme`, paired with
  `ACCENT` in `tokens.ts` for JS/SVG/export. Swept **157 `indigo-*` utility lines
  across 66 files** to `accent-*` and migrated the raw indigo hex/rgb literals (CSS focus
  outline / selection glow / prose link / entity-ref bg → `var()`/`color-mix()`; JS minimap,
  junctor OR, splice-target, HTML + EC-workshop exports → `ACCENT`). The brand is now one knob.
  Categorical indigos are deliberately left alone — the `indigo` group tint (`groupColors`), chip
  palette (`chipColors`), `desiredEffect` entity stripe, and the `indigo` tones in `InsetCard` /
  `StatusStrip` are colours-among-peers, not the accent. A guard test
  (`tests/components/ui/accentToken.test.ts`) keeps the accent-carrying primitives off raw
  `indigo-` and asserts the CSS token + `ACCENT` stay in sync. Because the token equals the old
  indigo, rendering is pixel-identical.

## Session 191 (cont.) — EC-completeness hardening + a dead-code trim

- **Tests — five more `ec-completeness` cases** killing real mutation survivors in the EC
  validator's most complex rules: the mutual-exclusion exclusion in Rule 2 (a B↔C conflict edge
  must NOT trip "connects to something other than A") and Rule 3 (a D↔D′ conflict edge isn't a
  support edge), the correct-target negative for Rule 3 (D→B is fine), the with-assumption
  negative for Rule 4 (an arrow carrying an assumption is silent), and Rule 4's reverse-direction
  mutex match (a D′→D edge still satisfies the D↔D′ arrow). A scoped Stryker run confirms the
  file's mutation score rose **65.7 % → 71.1 %**.
- **Dead code — removed the vestigial `incoming` filter** in Rule 2: it ran an O(E)
  `Object.values(doc.edges).filter(…)` per Need on every `validate()` only to `void` the result
  (the missing-incoming-want case is Rule 3's job). Behaviour-identical; one fewer edge scan per
  EC validate.

## Session 191 (cont.) — Reader mode survives a reload

A final adversarial sweep over the last un-swept areas (shortcut dispatch, search/library,
creation wizards, markdown/settings/deep-link) surfaced one real persistence bug:

- **Fix — Reader mode silently reverted to Expert on reload.** `readInitialPrefs` validates the
  persisted `appMode` against `VALID_APP_MODES`, but that whitelist listed only
  `expert`/`guided`/`workshop`/`presentation` — it omitted `reader`, a fully-shipped fifth mode
  (Session 180/E6). So switching to Reader, then reloading, failed the `.has()` check and fell
  back to `expert` — while `browseLocked` (auto-engaged by Reader) persisted independently,
  stranding the user in a browse-locked Expert state. `reader` added to the set. A parametrized
  test now asserts every `AppMode` round-trips through persistence (the `reader` case failed
  pre-fix), guarding against any future mode being added to the type + setter but forgotten in
  the validation whitelist.

## Session 191 (cont.) — Paste preserves entity content + graphCore tests

A follow-up hunt over the remaining domain logic (state-propagation, patterns, cross-doc links,
EC/injection) surfaced the entity-side twin of the edge paste bug below:

- **Fix — paste dropped every entity field except `description`.** `pasteClipboard` minted each
  copy via `createEntity` and re-attached only `description`, so a copy/paste silently lost the
  entity's `position` (hand-positioned **Evaporating Cloud** boxes all collapsed to (0,0)),
  `attributes` (S&T facets + custom key/values), `evidence`, `spanOfControl`, styling, and the EC
  want/need text. Paste now carries all of the entity's self-contained content and only re-mints
  identity + timestamps. The fields that bind or refer OUTSIDE the entity are intentionally
  dropped — `ecSlot` (binds to one of the EC's five fixed roles → would duplicate a slot),
  `links` (cross-doc references → back-links would desync), `coreProblem` (the doc's single
  core-problem marker), and `importedFrom` (provenance of the original, not of a fresh local
  copy). Two tests pin it (content carried; binding fields dropped), the first failing pre-fix.
- **Tests — `graphCore` now has a dedicated suite** (`tests/domain/graphCore.test.ts`, 22 cases):
  the WeakMap-cached `edgesArray` / `entitiesArray` / `edgeIndex` (hit returns the same reference,
  a new map reference rebuilds), `junctorGroupId` precedence, self-loop counting in
  `connectionCount`, the stable frozen empty-array sentinels, `isStNodeFormat` (injection +
  facet-attribute gating), and `assumptionsForEdge` grouping. The last foundational graph module
  without its own test.

## Session 191 (cont.) — Copy/paste no longer strips edge properties

An adversarially-verified bug hunt over the un-swept complex areas (layout, geometry/routing,
history/undo-redo, selection/clipboard) surfaced one real, high-severity data-loss bug:

- **Fix — paste discarded every edge property except its endpoints.** `pasteClipboard`
  reconstructed each copied edge with `createEdge({ sourceId, targetId })`, which hard-codes
  `kind: 'sufficiency'` and ignores all other fields. So a routine Ctrl+C / Ctrl+V silently lost
  the edge's `weight`, `label`, `description`, `isBackEdge`, `isMutualExclusion`, `delay`,
  `loopName`, `loopNarrative`, and `attributes` — and **downgraded `kind: 'necessity'` →
  `'sufficiency'`**, corrupting the semantics of EC / Goal Tree / PRT edges (which would then
  spuriously trip the `logic-type-mismatch` validator). The entity paste path already preserved
  `description`, so the edge path dropping everything was an asymmetric oversight. Paste now
  carries the source edge's `kind` plus all metadata (conditional spreads for
  exactOptionalPropertyTypes); the junctor group ids (`and`/`or`/`xorGroupId`) are intentionally
  dropped — they reference a cross-edge group, so pasting a subset would dangle or alias it.
  Two tests pin it (metadata preserved; group ids dropped), the first failing pre-fix.

## Session 191 (cont.) — Two bugs from an adversarial cache/round-trip hunt

A deep bug hunt (adversarially verified, 13 of 15 candidates rejected) surfaced two real,
unrelated correctness bugs:

- **Fix — `setActiveDoc` could duplicate a tab id.** When the active tab is rekeyed to a doc
  whose id matches ANOTHER open tab (e.g. a replace-mode load of a JSON export of an
  already-open tree), the `tabOrder.map(old → new)` produced a duplicate id (`[X, B]` →
  `[B, B]`) and overwrote the background tab's doc — corrupting the tab strip (duplicate React
  keys; `closeTab` removing both occurrences), and the bad order persisted across reload. Now
  dedups the rekeyed `tabOrder`, keeping the active tab's slot. Unit test reproduces it.
- **Fix — VGL export silently flattened OR / XOR junctor groups.** `exportToVgl` bucketed edges
  only by `andGroupId`; OR- and XOR-grouped edges fell through to plain `edge A -> B` lines,
  losing the grouping (the sibling DOT + Flying Logic exporters already handle all three kinds).
  Generalised the bucketing to AND/OR/XOR, emitting `edge_or` / `edge_xor` blocks mirroring
  `edge_and` (AND output byte-identical). VGL is a one-way human-readable format — no user data
  loss, but an export-fidelity defect. Tests added for both kinds.

## Session 191 (cont.) — `edgesSlice` split into focused sub-modules

`edgesSlice.ts` (561 lines) split into an `edges/` subfolder of `create*Actions(deps)`
factories, mirroring the `entitiesSlice` + `entities/` and `docMetaSlice` + `docMeta/`
pattern: `connect.ts` (connect / trim / update / delete / reverse / reconnect),
`junctor.ts` (AND/OR/XOR group + ungroup + add-co-cause + the `JunctorKind` constants),
`splice.ts` (the two splice gestures), `attributes.ts` (polarity + edge attributes), and
`shared.ts` (`EdgesFactoryDeps`). The composer keeps `createEdgesSlice` + `EdgesSlice` and
re-exports `JunctorKind` (consumed by `JunctorOverlay` + the Flying Logic writer), so no
consumer import moved. Pure move — verbatim action bodies, zero behaviour/test changes.

## Session 191 (cont.) — Projection memo gated on a collapse signature (+ an edge-staleness fix)

`useGraphProjection` (pipeline stage 1 — the visible-entity set + remap consumed by
positions + emission) keyed its memo on the raw `doc.entities` reference, so a
title / description / state edit rebuilt the O(N) visibility set (and its F7 collapse
BFS) on every keystroke. Now gated on **`entityCollapseSignature`** (each entity's id +
F7 `collapsed` flag — the only entity content the projection reads), mirroring the
shipped routing / reach signatures, so non-structural edits reuse the cached projection.

It also adds **`doc.edges`** to the memo deps, fixing a latent staleness: the F7
entity-collapse BFS walks the edge graph to find what's hidden behind a collapser, but
the memo wasn't keyed on edges — so adding/removing an edge under a *collapsed* entity
left `hiddenCountByCollapser` (and the hidden set) stale until an entity edit. A
render-hook test reproduces it (fails on the old deps). Behaviour-preserving otherwise;
memo-identity + sensitivity tests pin the gate.

## Session 191 — CLR validator test sweep + a stale-fingerprint fix it surfaced

A test-hardening pass over the CLR validators (sitting at ~64.7 % mutation score with many
rules covered only collectively). Added dedicated, mutant-killing tests for 16 previously
under-tested rules plus the two most complex ones, and filled the Flying Logic reader's
fallback/skip branches — and the sweep surfaced a real correctness bug.

- **Fix — the validation fingerprint omitted `edge.kind` and `edge.isMutualExclusion`.**
  `validate(doc)` is memoized via a 32-entry LRU keyed on `computeValidationFingerprint`, whose
  per-edge signature encoded `id:source>target:andGroupId:weight:isBackEdge:delay` but NOT the
  edge's `kind` (read by `logic-type-mismatch`, `long-arrow`, `cause-sufficiency`) or
  `isMutualExclusion` (read by `ec-missing-conflict`, `ec-completeness`). So two docs differing
  ONLY in one of those fields collided on the cache key and `validate` returned the prior doc's
  warnings: flipping an edge sufficiency↔necessity, or ticking/unticking the EC conflict edge's
  Mutual-exclusion flag, left the relevant warning stale until an unrelated edit perturbed the
  key. The fingerprint's own header comment warns about exactly this omission class. Both fields
  added to the per-edge signature; a fail-before/pass-after regression test pins it.
- **Tests — 18 new validator suites** under `tests/domain/validators/` (one per rule), covering
  the positive trigger (exact target + message + action), the off-by-one boundary, negative
  shapes that must NOT fire, and diagram-type gating: `longArrow`, `ecCompleteness`,
  `externalRootCause`, `crtUdeCount`, `crtUdeNoUpstream`, `crtDeadBranch`, `crtCoreDriverChecks`,
  `crtUdeWording`, `logicTypeMismatch`, `loopPolarity`, `reinforcingNoDelay`, `completeStep`,
  `ttActionLocusUnset`, `ecMissingConflict`, `stTacticAssumptions`, `stTacticRollup`,
  `goalTreeMultipleGoals`, `nbrBranchIntegrity`.
- **Tests — Flying Logic reader edge cases** (`tests/domain/flyingLogic/reader.test.ts`): the
  diagram-type fallback, invalid-weight rejection, OR/XOR junctor synthesis on a raw import,
  group colour/collapsed parsing, malformed-vertex/edge skips, and flat-over-`documentInfo`
  metadata precedence.
- **Result — validator mutation score 64.7 % → 72.4 %** (a fresh full run over
  `src/domain/validators/**`, 1096 mutants: 788 killed + 5 timeout, up from the prior pass). The
  residual survivors are concentrated in `index.ts` (the registry's unused `ruleId` label arg and
  the `validate()` LRU-cache internals — equivalent mutants that don't change output) and
  `ecCompleteness.ts` (a five-sub-rule validator); the high-value, output-affecting mutants are
  now killed.

## Session 190 (cont.) — Edit-heavy round 2 + a backup-cache fix + housekeeping

Follow-ups in the same unattended optimization pass. The routing gate (below) cut the
edit-heavy perf-trace from +98.6 % to +56.1 % over baseline and made `all-actions` ~3.4×
faster; this round chases the residual and lands three smaller wins.

- **Perf — the reach-count BFS no longer re-walks the graph on an entity edit.**
  `useGraphNodeEmission` hoists the UDE-reach / root-cause-reach counters into a
  topology-keyed memo, but it keyed on the raw `doc.entities` reference, so an *entity*
  title/description/state edit (the edit-heavy hot path) busted the WeakMap reach cache and
  re-ran both O(V·(V+E)) walks every keystroke — the earlier narrowing only spared a
  *document*-title edit. Now keyed on **`entityTypeSignature`** (each entity's id + type, the
  only fields the walks read) + `doc.edges`; an entity-content edit leaves it unchanged, so
  the BFS is skipped. Behaviour-preserving (reach values are unchanged); new signature
  stability/sensitivity unit tests.
- **Fix — backup cache isn't poisoned by a quota-failed write.** `saveToLocalStorage`
  advanced its in-memory `lastCommittedRaw` cache even when the main-slot write failed
  (quota), so the next save copied a never-committed payload into the legacy `docBackup`
  slot. Now the cache only advances when the write lands. Regression test added.
- **Fix — Flying Logic import no longer drops forward-referenced nested groups.** The
  `.vgl` reader resolved group members in a single pass, so a parent group whose vertex
  preceded its child group's (the writer emits groups in insertion order, parent-first)
  looked the child up in a half-built map and silently dropped the nesting — a round-trip
  data loss. Now resolved in two passes (create every group, then resolve members), so
  entity *and* forward-referenced nested-group members both survive. Found by an
  adversarially-verified bug hunt; new round-trip test reproduces it (fails on the old
  single-pass reader).
- **Refactor — `EdgeInspector`'s three identical AND/OR/XOR junctor-group rows** collapse
  into one `JunctorGroupField` component (behaviour-preserving; existing tests cover it).
- **Refactor — `docMetaSlice` (1029 lines, the repo's largest file) split into `docMeta/`
  sub-modules**, mirroring the `entitiesSlice` + `entities/` pattern: `tabs.ts` (the tab engine
  + document swaps), `metadata.ts` (the `applyDocChange` setters + markers), `crossDocLinks.ts`
  (U-Shape linking), and `shared.ts` (the `DocMetaFactoryDeps` bag). The composer keeps the
  boot-time tab restore + recovery signal and its public exports
  (`createDocMetaSlice` / `DocMetaSlice` / `bootRecoveryStatus` / `docMetaDefaults`) unchanged,
  so no consumer import moved. A pure move — verbatim action bodies, zero behaviour/test changes;
  the slice presented to Zustand stays one flat object. Landed in three gated commits.
- **Docs/tooling — feature catalogue caught up to Session 190** (the collapsible method-path
  strip and the per-tab diagram-type colour dot get rows), and `docs/features.json` is now
  excluded from biome so its hand-maintained compact one-line-per-feature format survives the
  lint-staged formatter.

## Session 190 — Perf: title edits no longer re-run the edge router (edit-heavy regression)

The scheduled Perf-trace workflow flagged the **edit-heavy** scenario (repeated title
edits over a 100-entity diagram) at p95 **18.3 ms — +98.6 % over the 9.2 ms baseline**,
while `all-actions` was unchanged. Root cause: `useEdgeRoutes` keyed its memo on the raw
`doc.entities` reference (and on `projection`, itself rebuilt every mutation), so a
title-only edit — which moves no obstacle box and changes no visibility — still re-ran the
full smart router (visibility-graph build + A\* per edge + the O(E²) decross scan) on every
keystroke. `useGraphPositions` already sidesteps this with a structural fingerprint; the
router was the one pipeline stage that didn't.

- **New `entityRoutingSignature(doc, opts)`** (`graphViewConstants.ts`) — a `===`-stable
  string of every entity's *routing-relevant* content and nothing else: its obstacle size
  (via `nodeSizeFor`) plus its F7 `collapsed` flag. Those are the only two channels through
  which an entity reaches the router (geometry + visibility), so two docs with an identical
  signature route identically.
- **`useEdgeRoutes` now keys its memo** on that signature plus the structural inputs the
  router actually reads — `doc.edges`, `doc.groups`, `diagramType`, the laid-out
  `positions`, `backEdgeIds`, and the projection scalars (`hoistedGroupId`,
  `showArchivedGroups`) — instead of the churning `doc.entities` / `projection` references.
  A cache HIT can never be stale: every input that affects routing is reflected in a listed
  dep. Title / description / state / colour edits now skip the router entirely; collapse,
  add/remove, resize (S&T format), grow-to-fit height changes, hoist, and layout changes
  still recompute.
- **Strictly behaviour-preserving** — the route *values* are unchanged (the same `doc`
  flows into `computeEdgeRoutes` on every recompute); only the *frequency* of recompute
  drops. Pinned by new unit tests (`nodeSizeFor.test.ts`: signature stability vs
  sensitivity) and render-hook memo-identity tests (`useEdgeRoutes.test.tsx`: the routes ref
  holds across a title edit, and recomputes on collapse / add / grown-card height).
  `perf-baseline.json` is left at 9.2 ms — the next Perf-trace run confirms the fix restores
  it.

## Session 189 — Brand mark replaces the "TP" monogram (favicon + PWA icons)

The browser-tab favicon **and** the PWA / installed-app icons now use the app's brand
mark — the lucide `git-branch` glyph on a dark rounded square, the same mark shown in the
top bar (`HomeLogo.tsx`) and the Start workspace (`StartSidebar.tsx`) — replacing the
older white "TP" monogram on indigo. Dann's request.

- **New `public/favicon.svg`.** Geometry mirrors the in-app mark exactly: a 32px
  `rounded-md` (rx=6) square with the 24-unit `git-branch` glyph scaled to 16px and
  centred. Colours adapt to the browser's colour scheme the same way the in-app square
  does — neutral-900 square + white glyph in light mode, neutral-100 + neutral-900 glyph
  in dark — via a `prefers-color-scheme` block, with light-mode presentation attributes
  as a fallback for renderers that ignore the embedded `<style>`.
- **PWA / manifest icons regenerated.** `scripts/generate-pwa-icons.mjs` now renders the
  `git-branch` glyph on a neutral-900 square instead of the white-"TP"-on-indigo monogram.
  The glyph has curves (two rings + a quarter-arc), so the generator switched from the
  old 5×7 bitmap-font path to a signed-distance-field rasteriser supersampled 4× for
  clean anti-aliasing. `icon-192/512.png` keep the rounded-square look (transparent
  corners); `icon-192/512-maskable.png` are full-bleed so a platform mask never reveals a
  transparent corner, with the glyph held inside the maskable safe zone.
- **`index.html`** points `rel="icon"` at the SVG (crisp at any size, colour-scheme
  adaptive) with `icon-192.png` as a `rel="icon"` fallback; `apple-touch-icon` uses the
  full-bleed `icon-192-maskable.png` (opaque — Safari ignores SVG, and iOS expects no
  transparency).
- **Unchanged on purpose:** the manifest `theme_color` / `<meta name="theme-color">`
  stays indigo (still the app's accent colour throughout the UI), and `og-image.png`
  keeps its share-banner wordmark — both are separate from the square icon mark.

## Session 188 (cont.) — Dashboard load coverage

The live dashboard (`public/dashboard.html`) — a standalone static page that lives outside the React
app and the type system — had no automated coverage, so a renamed element id or a dropped data fetch
could break it silently. Verified it renders end-to-end (the live GitHub repo pulse, the Chart.js
charts, and the `stats.json` CI metrics all populate) and added two layers of "does it load" coverage:

- **Structural guard** (`tests/dashboard.test.ts`, unit suite): asserts the HTML ↔ inline-JS contract —
  every element id the script writes into exists in the markup AND is targeted by the script, the page
  fetches `stats.json` / `stats-history.json`, both loaders are wired to `window.load`, and the
  live-fetch failure path degrades gracefully.
- **Browser load test** (`e2e/dashboard.spec.ts`, Playwright): loads `/dashboard.html` in real Chromium
  with the GitHub API + Chart.js CDN stubbed (hermetic — no network, no rate limits), and asserts the
  `stats.json` metrics populate (`#stats-body` shown, headline numbers filled, code/coverage rows
  rendered), the section scaffolding renders, and no uncaught JS errors fire.

## Session 188 — Method-path strip is collapsible

The method-path strip under the top bar is now collapsible, so it stops claiming a full row when you
don't need it (Dann's request). Layered on the existing stepper — **no change** to the method sequence,
the next-step logic, or any other behaviour.

- **Collapse from the strip, reopen from the ⋮ menu.** A chevron at the strip's right edge hides it
  completely (the row is fully reclaimed, not just slimmed); the top-bar overflow ⋮ gains a **Show /
  Hide method path** toggle to bring it back. The choice is a persisted `methodPathCollapsed` preference
  (default expanded) that mirrors the Building Blocks rail's `blocksRailCollapsed` exactly — remembered
  across reloads and documents.
- The next-step suggestion chip moved into a right-aligned cluster next to the new collapse control; its
  appearance and behaviour are unchanged.
- Tests: the MethodStepper spec gains a collapse-button case and the KebabMenu spec a show/hide-toggle
  case. Docs: USER_GUIDE's "What you see" table + Method-path section note the collapse + reopen path.

## Session 187 — Design-handoff fidelity pass (UX Redesign mockup)

A Claude Design handoff bundle (`TP Studio UX Redesign.html` + its `redesign/*.jsx` source) was imported
and audited against the live app. The finding: the redesign's seven moves — Building Blocks rail,
surfaced Logic check, regrouped top bar, method-path stepper, the Workspace Start page, registry-driven
Templates, and per-card logic status — were **already shipped** across Sessions 182–186 (and in places the
app went beyond the mockup). A four-surface fidelity comparison surfaced a short list of genuine gaps; the
ones below were closed — each an additive, behavior-preserving change with **no** domain-logic, validator,
token, or export changes.

- **Entity meanings now teach in the inspector.** The one-line plain-language `meaning` for each entity
  type (the single source of truth on `EntityTypeMeta.meaning`, already shown in the Building Blocks rail)
  now surfaces as a native tooltip on every button in the inspector's **Type** picker — fulfilling the
  redesign's "reused by tooltips" intent and making the `entityTypeMeta.ts` docstring true. Custom classes
  (which carry no meaning) simply get no tooltip.
- **Logic-check panel gains a one-line CLR explainer.** The Logic-check (CLR) panel header now opens with a
  one-sentence "every cause-and-effect link is checked against Goldratt's Categories of Legitimate
  Reservation — walk them tier by tier" line above the open/resolved counts, so the product's
  differentiator explains itself in place. New dedicated `CLRPanel.test.tsx`.
- **Tab strip shows a per-tab diagram-type colour dot.** Each open tab now carries a small dot in its
  diagram's brand colour (CRT red, EC fuchsia, FRT indigo, …) so trees are tellable apart at a glance.
  Backed by a new canonical **`DIAGRAM_TYPE_COLOR`** map in the domain (`entityPalettes.ts`, beside
  `DIAGRAM_TYPE_LABEL`); the Start surface's `DIAGRAM_META` is de-duped to read from it — one colour
  source, no new values (each maps to an existing entity-stripe token).
- **Centre command/search field collapses below `lg`.** The ⌘K search field now follows the redesign's
  content-priority responsive rule — it tucks away on narrower viewports so the title + right-hand action
  clusters never wrap; the `Cmd/Ctrl+K` shortcut and the overflow ▾ keep it reachable at any width.
- **Deferred by decision:** the mockup's single prominent "Resume" card on Start (vs. today's equal-weight
  recent-tree grid) was reviewed and left as-is — logged in NEXT_STEPS.

Docs: USER_GUIDE notes the tab colour dot + the responsive search field; NEXT_STEPS logs the deferred
Resume card.

## Session 186 — Templates + Patterns unified into one "Templates" library

The app had two parallel libraries of curated starter diagrams: the Start "Templates" gallery's 10
`TEMPLATE_SPECS` (Goal Tree / EC / CRT only) and the editor "Pattern library"'s ~60 `PATTERNS` (all 8
diagram types). They overlapped conceptually but were separate definitions. Now there's **one**
registry, shown identically everywhere under the name **Templates**.

- **One registry.** The 10 templates are folded into `PATTERNS` (each surfaced as a Pattern built via
  `buildTemplate`); the 3 EC templates (build-vs-buy / quality-vs-speed / centralize) supersede their
  near-duplicate patterns, which are deleted. The combined set (69 entries) is stably grouped by
  diagram-type block. Registry guards stay green (≥5 per type, unique ids, all build at the current
  schema).
- **Both surfaces show it.** The Start "Templates" gallery + hero strip render the unified set (was 10
  across 3 types → now 69 across all 8) via a generic `groupByDiagramType`; the editor library reads
  the same `PATTERNS`. Verified live (Edge): the Templates page shows all 8 type groups (Goal Trees …
  Negative Branch Reservations), 69 cards.
- **One name.** The editor "Pattern library" dialog + its palette command are renamed **Templates** /
  "Browse templates…" (the Start sidebar already said Templates). User decisions: "Templates"
  everywhere; dedupe the overlaps keeping the richer templates.
- The legacy "New from template…" thumbnail picker — a third, redundant surface that still showed the
  old 10 — is **retired**: its palette command now opens the unified Templates dialog, the
  `TemplatePickerDialog` + its store flag / actions / Esc-wiring are removed, the orphaned
  `TemplateThumbnail` is deleted (the live-document `DocumentThumbnail` stays), and its e2e visual
  test + baseline are dropped.

## Session 185 — Hover-fan + closed-library hygiene

When 2+ edges converge on one entity you couldn't grab one to re-route it — a click took
whichever sat on top (the Session-177 edge-picker addressed the click; this is the promised
"fan later" direct-manipulation follow-up). Now hovering any edge in a convergence group spreads
the group's endpoints apart at the shared target so each is grabbable; they snap back on leave.
**No domain-logic changes** — emission metadata plus a render-time endpoint offset.

- **Groundwork (behavior-preserving).** `useGraphEdgeEmission` groups the fan-eligible visible edges
  — real, non-aggregated, non-junctor (a junctor's siblings converge at the junctor circle, not the
  target) — by target and stamps each with its `fanRank` + the group `fanCount`, only when 2+
  converge. Position-free, so rank is a stable sourceId order.
- **Render.** `onEdgeMouseEnter` stashes the hovered edge's target (`hoveredEdgeTargetId`); `TPEdge`
  fans when its own target matches and its group has 2+ members, offsetting its bezier endpoint by
  `(fanRank − (n−1)/2)·16` around the shared point and dropping its routed path so the offset
  renders. Gated to **direct** routes (≤2 waypoints): a detoured edge stays put so it doesn't pop
  from its obstacle detour to a straight bezier. The 16-unit spacing stays under the 56px edge
  hit-tolerance, so the hovered edge doesn't slip out from under the pointer (no flicker).
- **Tested + verified.** Gating + offset are a pure `hoverFan` helper (unit-tested: only a hovered
  2+ direct group fans; symmetric spread, middle of an odd group unmoved); emission stamping is
  unit-tested. End-to-end spread/snap-back verified in a real browser (Edge): 3 edges converging on
  one node go from 0px endpoint spread at rest to a symmetric fan on hover, back to 0 on leave.
- Polish (same session): the spread now anchors on the routed path's own endpoints, so hover-in
  moves only the X — no vertical jump from the route→bezier swap — and eases in over 120ms (the
  `transition` is gated to the active hover, so node drags, which also change the path `d`, don't
  rubber-band). Remaining follow-ups at the time of writing: fans only direct-route convergence in flow
  layouts (smart-routed detours + radial keep their path); sourceId slot ordering — a render-time
  position sort would guarantee crossing-free fanning but would couple edge emission to per-frame
  drag positions (a deliberate perf boundary). **Correction, Session 206:** both follow-ups have since
  shipped — slot ordering by live source X in **Session 202** (the emission memo stayed position-free),
  and detours + radial in **Session 206**. Nothing from the hover-fan remains open.

**Closed-library hygiene.** "Forget closed documents" (palette) used to scan only the revisions
map, so a closed tree that was never snapshotted — the common case since Session 184 keeps every
closed body — survived the sweep. It now also enumerates the committed-only bodies (`listSavedDocIds`)
and drops the closed ones, bumping `savedDocsVersion` so the Start "All trees" library refreshes. The
confirm copy + toast say so (it clears the closed-tree library, not just revision history). And the
localStorage-quota cascade gained a final tier — when trimming revisions + dropping inactive backups
frees nothing, it evicts the oldest *closed* trees (never an open tab) to keep the app saving, a small
conservative batch per trigger with a clear toast (this is the only tier that drops a primary saved
document, so it's last). Also a small internal tidy: the byte-identical cross-doc link chip in
`EntityLinksSection` and the injection flower is now one shared `LinkChip`.

## Session 184 — Start by default + a persistent tree library

Two follow-ups to the Session-183 Start page, both layered on the existing engine — **no domain-logic changes**:

- **Start is the default landing.** `startSection` now initialises to `'start'` for real users, so opening TP Studio shows the workspace instead of a blank editor. Gated to `null` (editor) under vitest (`import.meta.env.MODE === 'test'`) and the e2e hook (`?test=1`) so the whole suite keeps booting onto the canvas, and on a `#!share=` boot so a shared link opens its document. The editor-expecting e2e specs that used a bare `goto('/')` now pass `?test=1`; a new smoke test pins the bare-`/` Start boot.
- **"All trees" is a real library.** Closing a tab no longer deletes the document — its body stays in storage, so the Start galleries ("All trees" / "Recent" / "Needs review") list every tree you've made, not just the open tabs. `closeTab` keeps the body; new `listSavedDocIds` / `loadSavedDoc` persistence helpers; store actions `openSavedDoc` (switch to the tab if open, else load the body from storage into a new one) and `deleteSavedDoc` (remove the body for good, snapshotting/restoring `startSection` so a delete from the workspace stays on it). `useOpenTrees → useSavedTrees` reads the whole library — open docs live from the store, closed ones from storage — each with the same cached `validate(doc)` count, so the cards / badges / hero never disagree with the editor. Tree cards gained a confirm-gated Delete button. Verified live (Edge): a closed tree persists in "All trees", reopens, and deleting one stays on Start.
- **Cross-doc links survive close + reopen** (follow-up fix). `closeTab` used to sweep every cross-document link pointing INTO the closing doc — correct when a close *deleted* the body, wrong once closes persist, since a close + reopen then permanently severed incoming links. The inspector's `EntityLinksSection` already renders a link to a merely-closed doc as a muted "tab closed" chip that revives on reopen, so the sweep was the only thing keeping that intended path unreachable. It now runs only in `deleteSavedDoc` (the doc is gone for good); the pure `linkPrune` helpers are unchanged, and the stale `closeTab` / `stripLinksToDoc` docstrings are refreshed. The link tests flip to assert close KEEPS the link, with a new `deleteSavedDoc` block asserting the sweep.
- **Click a "tab closed" link to reopen it.** Building on the above: the inspector's closed-doc link chip (and the injection flower's) is no longer a dead, disabled label — it shows "Reopen linked tab" with a reopen icon and, on click, reopens the saved tree and follows the link (the reciprocal chip in the target then revives to a live "Go to"). Both surfaces route every chip through `openSavedDoc` (switch if open, else reopen), now returning a boolean + a toast when the tree was already deleted so a dead follow-through select is skipped. Verified live (Edge): link two trees, close one, click its chip → the tree reopens and the linked entity is selected.
- **Coverage + dark-mode polish.** A new `start-library` e2e spec drives the persist → reopen → delete flow on the real build + localStorage (verified locally via the Edge channel). Tree-card thumbnails are now theme-aware (`fill-neutral-50 dark:fill-neutral-900`) — light mode byte-identical, no more harsh white blocks on the dark canvas.
- Docs: USER_GUIDE + book chapter 02 updated (Start is the default landing; "All trees" is the persistent library, deletable per-card or via "Forget closed documents"); the two Start-page caveats in NEXT_STEPS are removed (both now resolved).

## Session 183 — Start page: a workspace home

A new top-level **Start** surface — a workspace shell reached via the top-left logo — built from the "Workspace start" mockup. Sidebar-driven sections layered on the existing engine; **no domain-logic changes** (validators, entity model, tokens, export untouched). Shipped as five gate-green commits.

- **Shell + view state.** A `startSection` UI flag (null = editor) renders a `StartPage` in place of the editor chrome + canvas while the dialog/overlay block stays mounted (so ⌘K, toasts, and the pickers work on Start too). The HomeLogo moved from About → Start (the conventional logo-goes-home); About stays on the palette + the Help footer. Focusing any document clears `startSection` via the shared `activeDocEphemeralReset`, so every doc-entry path (palette New diagram, the pickers, a tree card, the hero) exits Start with no per-call-site bookkeeping.
- **Registry-driven Templates.** A grouped gallery maps over the live `TEMPLATE_SPECS` — adding a TemplateSpec module makes a card appear in the right group with zero edits to the picker (pinned by a test injecting a throwaway spec; an unknown diagram type degrades to a neutral fallback group instead of throwing). A new `DIAGRAM_META` covers all nine `DiagramType`s (label / short tag / token colour / lucide icon) with a canonical method order.
- **Problem-led hero.** Name a UDE and **Build a Current Reality Tree** mints a fresh CRT seeded with that statement as its first entity (verified: one `ude` entity, Start exits into the editor); example chips + a worked-example callout do the same.
- **Tree cards with live Logic status.** The template thumbnail renderer was generalised to live documents (`DocumentThumbnail`, sharing the exact primitives via a `ThumbShape` — template thumbnails stay byte-identical). Each card shows a preview + title + diagram type + relative edited-time + a **Logic pill** that reads the SAME `validate(doc)` as the editor's Logic chip, so counts can never diverge (verified: the Needs-review sidebar badge equals the filtered gallery exactly). Sections: All trees, Recent (compact list), Needs review (the CLR as triage), Learn the method. Trees are the open tabs (the model keeps no saved-doc archive); most-recently-edited first.
- **Polish.** `StartPage` is lazy-loaded into its own 6 KB chunk, out of the first-paint index. Fixed a horizontal-overflow bug — the always-mounted off-screen slide panels (Comments / Revision, `absolute right-0 translate-x-full`) escaped `<main>`'s clip on the Start surface; `relative` on `<main>` makes it their containing block (no document overflow at 1024 / 1366 / 1920 px, editor unchanged). axe scan of the Start sections: 0 serious/critical violations.
- Docs: USER_GUIDE gains a **Start page** section (and the stale logo → About line is corrected); book chapter 02 gains a Start-page section, a de-staled "What's on screen" table (Session-182 chrome), a Start-hero on-ramp, and a new `chapter02-start-page` screenshot; `features.json` gains the Start-page rows; `reviewedThroughSession` → 183.

## Session 182 — Editor UX redesign: building blocks, logic check, regrouped top bar, method path

A four-commit redesign of the editor's information architecture, chrome, and discoverability, built from a mockup — layered on the existing engine with **no domain-logic changes**: the CLR validators, the entity model, `tokens.ts`, and the export pipeline keep their behaviour and outputs. Each change shipped as an independent, gate-green commit.

- **Building Blocks rail (left of the canvas).** A type-led creation surface listing exactly the blocks valid for the current diagram — stripe chip + icon + label + a one-line plain-language meaning, sourced from a single new `MEANINGS` record on `entityTypeMeta` (reused by the rail and the type-picker). Click a block to create that entity at the viewport centre (the existing `addEntity` + `screenToFlowPosition` recipe, coalesced to one undo); built-in types from *other* diagrams render dimmed with a "lives in X" hint. Collapsible, persisted via a new `blocksRailCollapsed` preference. Additive — double-click-to-create is unchanged.
- **Logic check, first-class.** A top-bar **Logic** status chip (emerald "all clear" / amber "N to review") plus a dedicated right-dock **CLR panel** listing every reservation grouped by tier (Clarity / Existence / Sufficiency), with locate-on-canvas, resolve/reopen, one-click remedies (`runWarningAction`), and a guided walk. The chip, the panel, and the inspector's per-selection warnings all read the **same** `validate(doc)` through a new `useDocWarnings` hook, so counts can't drift. The panel shares the right dock with the Inspector via a new transient `clrPanelOpen` flag — mutually exclusive, opening one closes the other.
- **Top bar regrouped into three labelled zones.** Left = home/logo + editable title + type badge; centre = a command-search field (`⌘K`) with a visible hint; right = clusters separated by dividers — Logic chip · undo/redo · history/comments · **Share** (copy share link) · filled **Export**, both previously palette-only · an always-present overflow ⋮ that absorbs Theme / Browse Lock / Help / layout mode. Every icon-only control gained a `title` + `aria-label`. Content-priority responsive collapse (no wrap, no horizontal scroll) verified across 1024–1920 px.
- **Method-path stepper.** A thin strip under the top bar situating the active document in the canonical sequence (CRT → EC → FRT → PRT → TT, with Goal / S&T as a parallel branch): current diagram filled with a green dot, siblings open as tabs outlined "open" (click to switch), the rest dashed "to-do" (click to create + open in a new tab). A new `methodPath.ts` holds the sequence and a `nextStepFor(doc)` milestone→suggestion map that surfaces a contextual next step only when it's earned (e.g. a CRT with a root cause → "break it with an Evaporating Cloud").
- **Render-loop fix, caught by the visual self-check.** The stepper's first cut built its open-tab map inside the `useShallow` selector; the fresh object defeated the shallow compare and spun "Maximum update depth exceeded". Moved the derivation into a `useMemo` over stable store refs; a new `MethodStepper.test.tsx` renders the component (which throws on the loop) as a permanent guard.
- **Share-link lazy-load fix.** The new always-mounted TopBar **Share** button reaches `shareLink` through `shareCurrentDoc`, whose static import would have dragged the share machinery (CompressionStream + doc encoder) into the main chunk. Switched it to a dynamic `import('./shareLink')` inside the async action, restoring the lazy boundary App.tsx already keeps for boot-time share-hash parsing.
- Docs: USER_GUIDE "What you see" table rewritten for the new chrome, with new **Building Blocks rail** and **Method path** sections, the Logic-check panel documented, and three now-stale top-bar references (radial-layout button, theme toggle, narrow-viewport collapse) corrected; `features.json` gains four rows (`blocks-rail`, `clr-panel`, `method-stepper`, `topbar-actions`) and `reviewedThroughSession` is bumped to 182.

## Session 181 (cont.) — Grow cards to fit text (opt-in)

A new **Settings → Display → Grow cards to fit text** toggle (off by default) lets an entity card
grow taller to show its full title instead of clamping to two lines — capped at six lines so a long
title can't expand without bound. Width stays fixed at 220px; short cards stay compact.

- **Pure, deterministic sizing — no DOM measurement.** Card size is computed before render (the one
  `nodeSizeFor` rule feeds dagre layout, the A* edge-routing obstacle boxes, and the minimap), so a
  new `estimateTitleLines` greedy word-wrap counts lines from the title + the effective font (per
  `titleSize` and app mode), and `nodeSizeFor` grows the height one line beyond the 2-line baseline
  up to the 6-line cap. The same count drives the card's `line-clamp`, so the computed box and the
  rendered card grow together — layout and edges stay correct, with the estimate biased generous so
  text is never clipped before the cap.
- Landed as a behavior-preserving prep commit (the estimator + an optional `nodeSizeFor` opts seam
  threaded through the layout/routing helpers, off by default) then the wiring: the app-wide
  `growCardsToFitText` localStorage preference, the Display toggle, the three size hooks reading it
  (folded into the layout fingerprint so toggling relayouts), and the TPNode clamp swap. No
  document/schema change.
- Verified in a real browser: short titles stay at the 72px floor, medium/long titles grow to fit
  with no clipping, a >6-line title caps and clamps with an ellipsis, and no cards overlap after
  growing. Unit tests pin the estimator (newline-exact + wrap/monotonicity), the grown / capped /
  S&T-excluded heights, and that the grown height reaches the routing obstacle geometry.

## Session 181 (cont.) — Review fixes: one custom-class owner + document-level warnings

A max-effort review of the NBR shape-rules commit surfaced nine findings (none crash-grade); all
fixed in two follow-up commits:

- **One owner for "is this entity an X?".** A new cached `entitiesOfBuiltin(doc, builtin)`
  (graphCore) matches raw types AND custom classes via `supersetOf`, cache-keyed on *both*
  `doc.entities` and `doc.customEntityClasses`. The NBR shape rules, `additional-cause`, and the
  whole risk-register exporter (mitigations, BFS, rows, count) now share it — previously the
  validator used `isOfBuiltin` while the exporter raw-matched types, so a custom-class injection
  satisfied the validator while the register showed the same UDE as a permanently open risk.
  `additional-cause` also gained a `(first, ...rest)` signature so a zero-type registration can't
  compile into a silently dead rule.
- **Validation fingerprint knows about custom classes.** Editing a class's `supersetOf` re-classifies
  entities for the `isOfBuiltin`-aware rules but used to be invisible to the fingerprint cache —
  stale warnings until an unrelated edit. `doc.customEntityClasses` joined the cache key and the
  fingerprint string (id>supersetOf pairs only; label/color edits stay free). Pinned by a
  same-references regression test.
- **`{ kind: 'document' }` WarningTarget.** The two genuinely doc-scoped rules (`crt-ude-count`,
  `nbr-no-negative-branch`) used to anchor on an arbitrary "earliest" entity, so deleting or
  re-wiring that entity re-keyed the warning and silently orphaned the user's dismissal. They now
  target the document with a lifetime-stable id; the warnings render in a new **Document-level
  warnings** section of the Document Inspector + the CLR walkthrough (verified live: resolve
  persists `nbr-no-negative-branch:document`). An existing crt-ude-count dismissal reappears once
  and re-dismisses with one click — deliberate, no migration.
- Bundle guard catch: moving `isOfBuiltin`/the new shared `displayTitle` ("(untitled)" fallback,
  previously 8 inlined literals) into `entityTypeMeta` would have dragged the Lucide icon catalogue
  into the main chunk via graphCore (99.7 KB, +16%); both live in the dependency-free
  `entityPalettes` leaf instead (83.9 KB — below the prior baseline, since the exporters dropped the
  icon import too). entityTypeMeta re-exports them, so existing import sites are unchanged.

## Session 181 (cont.) — NBR shape rules close the validator gap

The Session-180 hardening pass flagged that the Negative-Branch ruleset was thinner than the other
types and asked for a human call. Research showed the hedge ("possibly intentional — NBR is
position/flow-based") was unfounded: NBR is a dagre-laid-out sufficiency causality graph; it was
simply the only typed diagram with **zero** diagram-specific rules, while the method checklist
teaches — and the risk-register export structurally assumes — the canonical walk
injection → forward chain → turning point → UDEs. Dann picked the full option:

- **`nbr-no-negative-branch`** (EXISTENCE) — tracing has started (an injection has outgoing edges)
  but no UDE exists: the document still reads as an FRT. Silent until the trace starts, so it
  sequences after `predicted-effect-existence` instead of stacking with it; anchors on the earliest
  injection (no document-level warning target exists — same workaround as `crt-ude-count`).
- **`nbr-ude-disconnected`** (EXISTENCE) — a wired-up UDE that isn't forward-reachable from any
  injection can't inform the adopt/modify/reject call (and the risk register, whose mitigation
  inference follows the same chain, shows it permanently open). Skips causeless UDEs
  (`additional-cause` owns those) and stays silent with no injection in the doc (checklist step 1
  owns that moment). One BFS from all injections via the existing `reachableForward`.
- **additional-cause widened on NBR** — the S134 registry comment claimed the terminal-type target
  was "widened to either `ude` or `desiredEffect`" but the code only ever passed `'ude'`; the
  factory now takes a type list and NBR registers both, so a causeless Desired Effect (the intended
  FRT half) gets the same "no causes captured?" nudge FRT users get.

Judgment steps (turning point, reactive-vs-proactive mitigation, the final decision) deliberately
stay with the checklist — a mitigation is legitimately absent while you're still deciding, so a rule
there would nag during normal use. A new test pins that all shipped NBR content (example + 4
patterns) is clean of both shape warnings. +13 tests; appendix-G + USER_GUIDE rows added; the
NEXT_STEPS flag (the last open item from the S180 hardening pass) is retired.

## Session 181 — Assumptions collapse to a record-canonical model

The assumption dual-representation is gone at the data layer. An assumption used to live **twice**
under one id — a `type:'assumption'` entity in `doc.entities` (title, position) *and* a first-class
`Assumption` record in `doc.assumptions` (edgeId, text, status, …), kept in sync by store
dual-writes. The record is now the **only** home; an assumption is no longer an entity.

- **Store (record-only).** `addAssumptionToEdge` mints just a record (`createEntity` is used only to
  source a collision-free id, then discarded); `attachAssumption` resolves via the record;
  `setAssumptionText` drops its entity-title dual-write; `detachAssumption` removes the record
  outright (the host edge survives the detach, so host-edge-keyed `pruneAssumptions` can't catch the
  orphan — it's dropped explicitly, along with any comment anchored to it). `pruneAssumptions` no
  longer keys on a sibling entity, fixing delete-cascade + splice that otherwise dropped every record.
- **Migration v9→v10.** Moves every `type:'assumption'` entity out of `doc.entities` into
  `doc.assumptions` (back-filling text / edgeId-via-reverse-walk / annotationNumber when an old doc
  lacked the record), re-anchors their comments from `{kind:'entity'}` to `{kind:'assumption'}`, and
  keeps `edge.assumptionIds` (the per-edge index, for now). A **standalone** assumption node (one a
  user made via the old palette, attached to no edge) is re-typed to a `note` rather than dropped.
  Latent fix: the importer hard-coded `schemaVersion: 9` on its output — now stamps the current
  version. The `schemaVersion` literal type drove the bump across every doc-construction site.
- **Canvas + UI.** Assumption cards are now **non-selectable / non-draggable** (annotations, not
  graph nodes; position is derived) — double-click still edits in place, routed to
  `setAssumptionText`. Removed the vestigial "Open assumption" button; the comments panel's jump
  handles the `{kind:'assumption'}` anchor (selects the host edge + centers the card).
- **Palette.** `'assumption'` is no longer a node type in any diagram's palette (it would mint an
  orphan the canvas can't render); a free-floating side-claim is a `note`.

**Phase 4 — full removal (the payoff).** With the data layer record-canonical, `'assumption'` left
the type system entirely:

- **Dedicated canvas node.** A new `TPAssumptionNode` (`tpAssumption` React Flow type) renders
  straight from the record — replacing the shim that synthesized a fake `Entity{type:'assumption'}`
  to feed `TPNode`. Visual parity verified live (violet stripe, HelpCircle, #N badge, dashed anchor).
- **`'assumption'` removed from `EntityType`.** Its rows are gone from every `Record<EntityType,…>`
  table (labels, icons, colors, palettes, coaching, FL type-map — an imported FL "Assumption" node
  now maps to `note`). `isAssumption` is deleted and `isNonCausal` collapses to `isNote`; the ~75
  guards that skipped assumptions in causal traversals (exporters, coreDriver, edgeReading,
  validators, entity iterations) are gone — the skips are now a type-system guarantee.
- **`edge.assumptionIds` removed.** Attachment is solely `record.edgeId`; per-edge lookups use the
  WeakMap-cached `assumptionsForEdge`. `attachAssumption` is deleted (an assumption has one edge);
  splice re-homes records, not an edge field. Surfaced + fixed two latent issues: the
  assumption-placement memo + the validation-fingerprint cache both keyed on `doc.edges`, so an
  assumption add/remove (now only touching `doc.assumptions`) wouldn't re-derive placement or re-run
  EC completeness — both now key on `doc.assumptions`. Also hardened v9→v10 against an
  `Object.prototype`-named id (e.g. `"toString"`) minting a bogus record (`Object.hasOwn`).

~4157 tests; full preflight green at every gated step.

## Session 180 (cont.) — Assumption lifecycle keeps the dual representation consistent

The legacy assumption-Entity (`edge.assumptionIds[]`) and the Session-77 first-class Assumption
record (`doc.assumptions[id]`, sharing the id) desynced on two paths: deleting an assumption-Entity
left the record **orphaned** (`pruneAssumptions` only checked edge survival, not entity survival),
and detaching (the Assumption Well's ✕) removed the id from `assumptionIds` only — floating the
entity (invisible: assumptions aren't canvas nodes) and lingering the record with a stale `edgeId`.
Both leaked into JSON export. Now `pruneAssumptions` also drops a record whose assumption-Entity is
gone, and ✕ removes the assumption **outright** (entity + record + any anchored comment) when it
leaves its only edge — an assumption lives on exactly one edge (single `edgeId`, no re-attach UI),
so detach can only mean remove; if it's still attached elsewhere (reachable only via the unused
`attachAssumption`), it's kept. +2 tests, +1 assertion. The broader two-representation *collapse*
remains a separate, larger effort.

## Session 180 (cont.) — Goal Tree reads in necessity, not "because"

`resolveCausalityWord` fell through to the sufficiency connector "because" for a Goal Tree, so a
goalTree edge read `"Big Goal" because "NC 1"` — backwards. A Goal Tree is *necessity* logic ("in
order to obtain the goal, the condition must hold"), which the codebase already asserts in the
`PRIMARY_LOGIC` map (`goalTree: 'necessity'`). Added goalTree to the "in order to" branch alongside
PRT/EC, so the narrative export, the print/PDF reasoning companion and the canvas read-through now
render `In order to obtain "Big Goal", "NC 1" must hold.` CRT/FRT/TT/NBR stay "because"; PRT/EC
unchanged. Two pinned tests flipped to the necessity wording.

## Session 180 (cont.) — Junctor obstacle box no longer double-padded

`junctorObstacleBoxes` baked an 8px margin into each junctor's routing-obstacle box, then
`computeEdgeRoutes` padded every box again by the uniform 10px `NODE_OBSTACLE_MARGIN` — so a
junctor circle got 18px of edge berth while a same-size node got 10px, bowing routed edges further
around junctors than necessary. Dropped the redundant junctor margin; the box is now the bare
ellipse and gets the same single clearance as a node. Verified with a Pillow geometry render + a
programmatic crossing check (the box still clears the circle by 10px), and the existing clearance
test now pins the bare-ellipse size.

## Session 180 (cont.) — Follow-up batch: five flagged items resolved

An attended pass picking five items off the unattended sweep's flagged list.

- **Exporters keep untitled entities visible.** The PRT-plan / TT-tasks / risk-register CSVs
  dropped untitled linked entities from their secondary columns while the primary cell (and the
  goal-tree exporter) showed a `(untitled …)` placeholder — a reader couldn't tell an
  unnamed-but-present neighbour from a missing one. Every secondary column now placeholders an
  untitled entity (overcomes / depends_on, precondition / outcome, trigger, and the risk
  mitigation set) and skips only a genuinely deleted one.
- **Import drops dangling edges.** `validateEdge` checks an edge's shape but can't verify its
  endpoints resolve, so a malformed / hand-edited JSON could carry half-attached edges. Added
  `pruneDanglingEdges`, run on import before the singleton-junctor tidy, so a loaded doc is
  well-formed (valid exports never have dangling edges, so they're unaffected).
- **DOT export distinguishes OR / XOR groups.** Only AND edges were styled (bold); OR and XOR
  (mutex) groups now render dashed / dotted, with and > or > xor precedence matching the
  import-collapse rule.
- **Print dialog closes after the busy-state reset.** `handleVectorPdf` closed the dialog (an
  unmount) before clearing `pdfBusy` in its `finally` — a setState on a dead component. It now
  flags success and closes after the reset commits.
- **Command palette is an ARIA combobox.** Wired the WAI-ARIA combobox/listbox pattern
  (role=combobox + aria-controls / aria-expanded / aria-activedescendant on the input; a
  role=listbox container — the `<ul>` became a `<div>` since a list can't carry an interactive
  role; role=option + aria-selected per row) so a screen reader announces the active command as
  the user arrows the list. Section headers stay `role="presentation"`.

+9 tests across the five. The print-dialog reorder has no unit test (no existing harness; benign
React-warning fix).

## Session 180 (cont.) — Unattended hardening pass: bugs, performance, maintainability

A self-contained gated sweep — every fix its own commit (verify the finding against the
real code → fix → regression test → full preflight → green CI), judgment calls flagged
for review rather than auto-applied. Nine landed changes across three tracks, plus a
clean-bill audit of the data-integrity core.

**Data integrity (store) — three latent state-corruption bugs.**
- *Compare mode leaked across tabs.* `activeDocEphemeralReset` cleared per-doc UI state
  on a tab/doc swap but missed `compareRevisionId` / `sideBySideRevisionId`, so switching
  tabs with a revision comparison open carried the ghost compare state onto the next
  document. Reset both alongside the other ephemeral fields.
- *`cloneDoc` aliased the comments map.* The revision-snapshot clone shallow-copied every
  record map *except* `comments`, so a snapshot and its live document shared one comments
  object — editing comments after a snapshot mutated the snapshot too. Added the missing
  copy.
- *Splice dropped edge comments + assumptions.* Splicing an entity into an edge (or
  splicing an edge) rebuilt the edge pair but left comments and assumptions anchored to
  the now-removed edge id — they silently vanished. Splice now re-homes both to the
  surviving downstream half via two new pure helpers (`reanchorEdgeComments` /
  `rehomeAssumptions`) and prunes only genuine orphans.

**Export correctness — four exporters disagreed with the on-canvas model.**
- *Spawned EC was structurally wrong.* `spawnEC` built its five boxes without the `ecSlot`
  tags and wired them with `sufficiency` edges; an Evaporating Cloud reads in *necessity*
  and the exporters/readers key off `ecSlot`. Bound the five slots (a/b/c/d/dPrime) and
  switched to necessity edges.
- *EC slide paired the wrong boxes.* The PPTX EC slide picked D / D′ by array position
  rather than `ecSlot`, so a reordered cloud paired the conflict arrows wrong. Select by
  slot with an enumeration fallback.
- *PPTX Transition-Tree deck diverged.* The deck re-implemented the narrative-sentence
  loop instead of calling the shared `buildReasoningSentences`, and the copy lacked the TT
  AND-junctor triple form — a TT exported to PowerPoint read as generic "X because Y" lines
  while the Markdown narrative and the print/PDF companion rendered "in order to obtain T,
  do A given P". Delegated the deck to the canonical builder (non-TT output byte-identical;
  the divergent copy + its now-dead imports deleted).
- *Markdown system-scope swallowed newlines.* A multi-line system-scope value broke its
  Markdown bullet; embedded newlines now collapse to spaces.

**Performance — hot-path allocation trims, output-identical.**
- Two per-edge CLR validators (`causalityExistence`, `logicTypeMismatch`) called
  `Object.values(doc.edges)` on every validation; routed both through the cached
  `edgesArray(doc)` (WeakMap-memoised on the edges reference).
- `computeRevisionDiff` built a throwaway `new Set([...keys, ...keys])` spread per record
  map (entities/edges/groups) on the cached diff path; replaced with an incremental union
  that skips the intermediate arrays.

**Resilience & a11y.**
- The canvas's four lazy strips sat in `<Suspense>` with no error boundary, so a
  chunk-load failure (e.g. a stale service worker after a deploy) took down the whole
  canvas; each now has its own `<ErrorBoundary fallback={null}>` and degrades to hidden,
  matching the per-lazy pattern in `App.tsx`.
- `useFocusTrap` swallowed Tab into a dead-end when a trapped container had no focusable
  children; it now routes focus to the container, mirroring the mount-time fallback.

**Maintainability (behaviour-preserving).**
- Extracted `prunedSpread` — the "include the pruned map only when its reference actually
  changed" conditional spread that five mutation sites (deleteEntity,
  deleteEntitiesAndEdges, deleteEdge, spliceEdge, spliceEntityIntoEdge) had open-coded.
- Removed three `(cur.X ?? undefined) === param` no-op guards in setters
  (`setAssumptionKind`, `setEntityStates`, `setEdgeWeight`); the fields are `T | undefined`
  string-literal unions with no `null`, so a plain `===` is equivalent — the `?? undefined`
  only *looked* like a null-guard.

**Audit (no change).** A focused read-through of the undo/redo, revisions/snapshots,
multi-doc tab, and persistence subsystems found no real correctness bugs — the
`docs[activeDocId] === doc` invariant, history snapshots, undo coalescing, and the
persistence round-trip all hold. Recorded here so the next session doesn't re-walk it.

## Session 180 (cont.) — Lifecycle: cancel transient timers on unmount

Two "show a state for N seconds" timers — `RevisionPanel`'s just-captured-snapshot highlight and
`ReadAllAtOnceDialog`'s copy-state — called `setTimeout` without keeping the handle, so closing the
panel / dialog before the timer fired left a one-shot timer running against a torn-down component (a
no-op `setState` under React 18, but a real leaked timer until it fired). Extracted a small
`useTimeoutFn` hook returning a stable `setTimer(fn, ms)` that cancels any prior pending timer AND
clears on unmount, and wired both sites through it. +3 hook tests (fires after the delay; re-arm
cancels the prior; unmount cancels). Closes the last item from the Session-180 under-the-hood review —
the deferred list is now empty.

## Session 180 (cont.) — Persistence: corrupt cosmetic fields degrade, not fail the load

`importFromJSON` already validated in two tiers — structural fields (id, diagramType, schemaVersion,
the entity / edge / group records) throw and reject the doc, while cosmetic fields (title, style
toggles, metadata) soft-degrade "so a corrupt import still loads." But three cosmetic fields were
misclassified as strict: `resolvedWarnings` (the dismissed-warning set), `author`, and `description`.
A single bad value in any of them failed the WHOLE document load — and since `tryParseDoc` swallows the
throw and falls back to a backup slot, that can cost the user their committed snapshot. Moved all three
into the tier they belong to: a malformed `resolvedWarnings` resets to `{}`; a non-string
`author`/`description` is dropped (the return spread already did this — the throws were redundant). Also
made `nextAnnotationNumber` recoverable — a corrupt counter rebuilds from `max(annotationNumber) + 1`
instead of failing — so the only remaining hard-fails are the genuinely non-recoverable identity +
graph-content fields. +7 tests (the soft-degrade tier + a boundary check that a bad id / diagramType
still throws). No structural validation changed; no existing test touched.

## Session 180 (cont.) — Keyboard: bare-key shortcuts defer to focused controls

Canvas bare-key shortcuts gated only on `isEditableTarget` (text inputs), so when a button / menu /
select owned keyboard focus the keystroke ALSO ran as a canvas command: Backspace deleted the
selection, **Tab minted a child entity** (hijacking focus navigation), Enter started a rename, A added
an assumption, Arrows moved the selection — and in the global hook `e` opened Quick Capture and
`+`/`-`/`0` zoomed. Root-caused as one class rather than patching only the reported Delete: added
`isInteractiveTarget` (`button, a[href], select, [role="button"], [role="menuitem"]`, via `closest`)
and OR-ed it into the gate for **every** bare-key branch in `useSelectionShortcuts` plus the two bare
keys in `useGlobalShortcuts`. App-wide CHORDS (undo / redo / copy / save) and `Escape` stay broad —
they should fire while a control has focus. The primary gesture is untouched: React Flow marks nodes
`role="group"` and the pane `role="application"`, neither in the denylist, so select-and-Delete still
works. +14 tests (the predicate incl. the canvas-role negatives; a "control focused → does not fire"
test per affected key; positive canvas-side regressions).

## Session 180 (cont.) — CSV import: multiline quoted fields

`parseEntitiesCsv` split the file on newlines *before* quote-parsing, so a quoted field containing a
newline — a valid RFC 4180 multiline cell, and exactly what `exportToCsv` emits for a multi-line
description — was torn across rows (a truncated value plus a phantom `Unknown type` row). Replaced the
`split('\n')` + per-line parser with a single-pass, quote-aware **record** tokenizer: commas split
fields and newlines split records only *outside* quotes, `""` stays the escaped quote, CRLF is
normalized, and each record keeps the physical line it starts on so error toasts still point at the
right row. +6 regression tests (multiline cell; line-number accuracy after a multiline field; CRLF
inside a quoted field; comma+newline in one field; escaped quote in a multiline field; trailing
newline → no phantom row); all prior CSV tests unchanged. One deliberate edge change: an *unclosed*
quote now reads to end of file (standard RFC 4180) rather than stopping at the line break.

## Session 180 (cont.) — Under-the-hood: correctness + performance

A review-and-fix pass surfacing latent bugs and hot-path waste — every change gated and
output-preserving, no feature or behaviour changes. Found by a parallel correctness review
plus a hot-path perf audit; each finding verified against the source before applying (one
audit "finding" cited a non-existent file and was dropped).

**Correctness.**
- **Revision diff was blind to most edge edits.** The history panel's edge comparison only
  checked source / target / AND-group / label, so changing an edge's polarity, OR/XOR junctor,
  back-edge / delay / mutex flag, kind, description, or loop name/narrative reported "no
  changes." Now compares every edge field.
- **Bulk delete left orphaned junctors.** Deleting a multi-selection cascaded edges but skipped
  the `pruneSingletonJunctors` step the single-entity delete applies, so removing one of two
  AND/OR/XOR co-causes left the survivor tagged with a vacuous group id (a lone junctor circle).
  Now prunes, matching the single path.
- **"Restore defaults" skipped two preferences.** `resetPreferencesToDefaults` omitted
  `layoutDensity` and `printLayout`, silently keeping (and re-persisting) the user's values for
  those two. Now resets them.
- **Context menu had duplicate React keys.** Label-based keys collided when two rows shared a
  label (several untitled edges in the edge-picker, two "Delete" rows); switched to index-based
  keys so reconciliation is stable.
- **CSV exporters over-counted the toast.** The "N risks / actions / objectives exported" count
  came from `csv.split('\n')`, which an RFC-4180-quoted multi-line cell inflated (a multi-line
  UDE description over-counted the risk register). Now counts the source rows directly.
- **File picker hung on cancel.** `pickFile()` only resolved from `onchange`; a dismissed dialog
  fires `cancel`, not `change`, so the promise never settled and `await pickFile(...)` leaked the
  suspended continuation. Wired `oncancel`.
- **Flying Logic export dropped labels on grouped edges.** The source→junctor edge omitted the
  `label` attribute the direct-edge path emits, so a labelled AND/OR/XOR edge lost its label on
  re-import (the reader was already reading it back). Now emits it, matching the direct path.
- **Walkthrough Space-bar stole button clicks.** The CLR-walkthrough's window keydown handler
  hijacked Space (advance + `preventDefault`) with no target guard; with focus trapped in the card,
  a focused button never received its Space activation. Space now advances only when no control owns
  focus; Arrow keys still always navigate.

**Performance.**
- **PRT-plan topo-sort was O(V·E).** `orderedIntermediateObjectives` re-scanned every edge
  (`edges.filter`) on each node popped from the Kahn queue; built a sourceId→edges adjacency map
  once (O(V+E)). Topological order is identical.
- **Memoized edge badges re-rendered needlessly.** TPEdge handed the memoized TPEdgeBadges inline
  `onOpen` / `onSelect` arrows (React Compiler is off, so nothing stabilises them), defeating their
  `memo`; hoisted to `useCallback`, restoring the Session 135 skip.
- **Anchor-signature memo over-recomputed.** `assumptionAnchorSig` keyed on the whole `doc`,
  re-running on every keystroke / drag frame; narrowed to `[doc.edges]` like its siblings.

+10 regression tests pin the fixes. Each change committed + gated + green on CI separately.

## Session 180 (cont.) — Book: practitioner improvements

Six additions to the practitioner book (`docs/guide/`) that turn it from "explains the method"
into a "do the method" companion — leaning on the fact that the tool is open while you read.

- **"Now you try" exercises** — a hands-on block closing each Part-2 chapter (CRT → Freeform),
  sending the reader into TP Studio with their *own* problem and the right gestures for that
  diagram type. New `✏️ Now you try` sidebar convention, documented in AUTHORING.
- **"Which tree, when?" navigator** (ch1) — a problem → tree starting map ("symptoms with no
  agreed cause → CRT; chronic tug-of-war → EC; …") complementing the existing focusing-steps table.
- **Troubleshooting your diagram** — new **Appendix G**: a smell → CLR-rule → fix reverse index
  ("it reads like a to-do list", "the two Wants don't conflict", …) built on the corrected
  validator registry. Wired into the chapter manifest + README.
- **"Starting from a real problem"** (ch2) — orchestrates the on-ramps (Rapid 3-cloud diagnosis,
  Quick Capture, CSV import, templates / pattern library, the AI skill) by starting state, for the
  "blank canvas, vague problem" moment.
- **"After the workshop — from diagram to commitment"** (ch17) — closing on the next tree, assigning
  owners + exporting the plan CSV, distributing the reasoning, scheduling the re-measure.
- **"Closing the loop — knowing it worked"** (ch1) — the verification half of measurement: re-read
  the CRT for surviving UDEs, re-measure the Performance frame's Low/High, compare against the FRT's
  prediction.

Docs-only (`docs/guide/*` + the chapter manifest). EPUB builds clean (25 chapters); fast gate green.

## Session 180 (cont.) — Book: accuracy + depth pass

An audit-driven refresh of the practitioner book (*Causal Thinking with TP Studio*, `docs/guide/`).
Six parallel chapter auditors flagged drift against the now-100% USER_GUIDE and the validator
registry; this pass fixes it. No `book` flags flipped — this is content accuracy + depth, not a
coverage-% exercise.

**CLR overhaul (the centerpiece).** Appendix C ("The CLR rules in detail") was badly stale: it
promised "one entry per implemented validator" but described a non-existent 4-tier taxonomy and
listed ~12 rules (several renamed or fictional) while ~14 implemented validators were missing.
Rewrote it against `src/domain/validators/` as the authoritative reference — the real **three
tiers** (`clarity` / `existence` / `sufficiency`), all 26 active rules grouped by tier, and a
corrected diagram-type scoping matrix. Fixed Chapter 13's matching 4-tier errors (4 spots), added a
depth subsection on the rule families the classical CLR never named (CRT build-quality + the
system-dynamics lint), and corrected the `cycle`-rule note (retired S176) + `predicted-effect-existence`
scoping (FRT/NBR, not CRT).

**Command / label / shortcut drift.** ~15 "the book says X but the app does Y" fixes: palette
command groups (File / Edit / **View / Review** / Export / Help); "Begin speculation" → "Speculate:
what changes if…"; "Enter Reader mode" → "Switch to Reader mode" (×3); "Open Pattern Library…" →
"Pattern library…"; the Flying Logic extension (`.logicx` / `.logic` / `.xlogic`, not `.fll`);
appendix B's Redo (`Cmd+Shift+Z`) + the missing Save / Print / Swap shortcuts + removal of a
fictional `Cmd+\`; appendix D's `root-cause-reach` badge + the missing action-eligibility / ink-saving
toggles + removal of a fictional "System scope nudge" *setting* (it's an automatic one-time toast);
"Span-of-ctrl" → "Locus"; schema v8 → v9 and 13 → 14 screenshots in AUTHORING; the README
"seven thinking processes" count.

**Method gaps filled.** The CRT system-scope nudge (ch4), the `st-tactic-rollup` validator (ch10),
the Causality-reading setting (ch15), the workshop / presentation app modes + step-through (ch17),
and the conditional **Task tracker CSV** / **Prerequisite plan CSV** exports (ch16).

**Depth.** Deepened the CLR chapter (above) and added a "CLR check" beat to the end-to-end case
study (appendix A) so the worked example *shows* the discipline, not just the CRT → EC → FRT
structure.

Docs-only (`docs/guide/*.md` + this entry); the PDF/EPUB artifacts rebuild on merge via the
Rebuild-book CI workflow. EPUB builds clean locally (24 chapters, 14 images resolved); fast gate green.

## Session 180 (cont.) — Docs: user-manual feature coverage → 100%

Documented the last **23 user-facing features** that the catalogue (`docs/features.json`) had
marked `manual:false`, taking USER_GUIDE.md coverage from 170/193 (88.1%) to **193/193 (100%)**.
The `manual` flag is judgment-maintained — the guard (`scripts/check-feature-coverage.mjs`) only
validates structure + freshness, never the prose — so each flag was flipped only after the real
section was written.

Three new guide sections:

- **App modes** — the five-mode model (Expert / Guided / Workshop / Presentation / Reader) and
  palette-only switching; Guided force-shows the Goal Tree / EC creation wizard, Workshop enlarges
  node text, Presentation hides the chrome + auto-engages Browse Lock + adds the bottom-centre
  step-through control.
- **Entity state and what-if analysis** — the inspector State picker (Unknown / True / False /
  Disputed), the state propagated through the causal graph + the "graph implies…" caption, and the
  **Speculate** what-if overlay with its Commit / Revert banner.
- **Importing** — the unified **Import…** picker, **Import entity from another doc…** + the
  read-only "Imported from" provenance card, and the `tp-studio-import` AI skill.

Extensions to existing sections: the command palette's grouped + Recent structure, the CRT
system-scope nudge, 4-side edge anchoring + crossing-reroute under Smart edge routing, the S&T
assumption-kind chip, the TT task-tracker CSV export, the **Export…** picker framing, the About
dialog + EPUB book download, and the edge custom-attributes round-trip note.

Two corrections surfaced while documenting (and fixed in the docs): the Reader section claimed a
toolbar app-mode switch that doesn't exist (entry is palette-only), and the Prerequisite-plan CSV
export was described as gated to docs with Intermediate Objectives, but that guard was never wired
up — the docs now match actual behaviour, and the code bug is flagged for a separate fix.

Docs-only (`USER_GUIDE.md` + `docs/features.json`); done in an isolated git worktree to stay clear
of a parallel test-coverage session. Gate green — the feature catalogue reports manual 193 (100%).

## Session 180 (cont.) — E3: 3-Cloud rapid-diagnosis wizard

A fast on-ramp alternative to a full Current Reality Tree (a-dato source; Theme E). A
guided overlay (palette: **Rapid 3-cloud diagnosis…**) walks the rapid method in two steps:

  1. **Capture** three undesirable effects and the conflict felt behind each — what you do
     (D) vs what you feel you should do instead (D′).
  2. **Consolidate** the three into one Core Cloud (A/B/C/D/D′) — the single conflict sitting
     under all three symptoms.

On finish it mints a single Evaporating Cloud document tagged `cloudType: 'core'`, opens it
in a tab (honouring the new-tab preference), and preserves the three source conflicts as a
provenance block in the document description.

Why one doc, not four: an EC document is exactly one 5-box cloud (manual layout), so the
three source clouds are captured in the wizard's own local state — shown side by side at the
consolidation step (the pedagogical heart of the method) — rather than spun into three extra
canvas tabs. The overlay never touches the active document; all elicitation is local React
state, committed once, so dismissing mid-flow leaves the workspace untouched.

New: `src/domain/threeCloud.ts` (pure `buildThreeCloudCoreDoc` + `summariseConflicts`),
`src/components/three-cloud/ThreeCloudWizard.tsx`, the `threeCloudOpen` dialog flag +
`commitThreeCloudDiagnosis` store action, and the palette command. Reuses
`createDocument('ec')`, the `ecSlot` tagging, and the canonical EC slot labels / guiding
questions from `ecGuiding`. Tests in `tests/domain/threeCloud.test.ts`,
`tests/store/threeCloud.test.ts`, `tests/components/ThreeCloudWizard.test.tsx`. Full suite
2968 passing.

## Session 180 (cont.) — Theme A: loop delay markers (A4) + loop naming (A3)

Completes the System-Dynamics-lens theme (A1 R/B badge + A2 diagram-aware loop CLR shipped S179).
Both ride additive-optional `Edge` fields — no schema bump.

**A4 — delay markers.** `Edge.delay` renders a `//` mark mid-edge (the SD delay glyph) signalling that
a cause's effect is lagged in time — the variable that governs how a feedback loop behaves. Togglable
from the edge context menu ("Mark as delayed") and the EdgeInspector. A new `reinforcing-no-delay`
validator (CLARITY tier; CRT/FRT/NBR) flags a reinforcing loop none of whose edges carries a delay (it
would escalate instantly — "is a time lag missing?") and goes silent once any loop edge is delayed.

**A3 — loop naming.** `Edge.loopName` + `Edge.loopNarrative` on a back-edge: name the feedback loop
("Burnout spiral") and record a free-text behavior-over-time note ("escalates over 3–6 months, then
morale collapses") — the qualitative temporal story the acyclic sufficiency structure can't hold. The
name renders as a small label by the back-edge (alongside the R/B badge); both edit in the EdgeInspector
(reachable via the context-menu "Name this loop…"). Annotation only — never simulation (stocks/flows
stay explicitly out of bounds).

Touch points: `Edge` type + `validateEdge` + the validation fingerprint (now encodes
weight/isBackEdge/delay so the loop rules re-validate on toggle — also fixes latent loop-polarity
staleness); `TPEdgeBadges` (DelayBadge + LoopNameBadge) + `useGraphEdgeEmission` stamping + `TPEdge`
render; `ContextMenu` + `EdgeInspector` (with `aria-label`'d checkboxes); the `reinforcingNoDelay`
validator + registration. Tests in `tests/domain/themeA.test.ts`. Full suite 2950 passing.

## Session 180 (cont.) — E5: long-arrow / missing-step warning

A new CLR validator (`long-arrow`, EXISTENCE tier) flags a sufficiency edge that jumps past
≥2 causal levels — the depth-twin of `indirect-effect` (which flags breadth: too many causes
converging). Detection is structural and layout-independent: each entity gets a causal level =
the longest chain of forward sufficiency edges ending at it (back-edges excluded via
`effectiveBackEdgeIds`, so feedback loops can't make the longest path infinite), and an edge
whose endpoints differ by ≥3 levels is flagged. Conservative by design — silent on shallow
trees, only fires where the tree is deep enough for "skipping" to be meaningful, every warning
dismissible via `resolvedWarnings`, and the message is framed as a question.

Carries a one-click **Insert a step** action (`WARNING_ACTIONS['insert-step']`): splices a
blank intermediate entity into the flagged edge and opens it for editing, reusing
`spliceEntityIntoEdge` (the same path as the `splice-into-edge` palette command). Scoped to the
four sufficiency diagrams (CRT/FRT/TT/NBR); off for Goal Tree (necessity), EC/PRT/S&T/Freeform.

New `src/domain/validators/longArrow.ts` + registration on the four sufficiency diagrams;
`'long-arrow'` added to `ClrRuleId`; the `insert-step` handler in `services/warningActions.ts`.
`tests/domain/longArrow.test.ts` covers the span threshold, cycle termination, sufficiency-only
filtering, the EXISTENCE tier, registration scoping, and the action. Full suite green.

## Session 180 — E6: Reader / Trainee Mode

**E6** ships all three slices together: a distraction-free `'reader'` AppMode, per-element coaching
tooltips, and a guided "Challenge this arrow" flow that files a CLR-tagged review comment.

### What shipped

**AppMode `'reader'` (Slice 1 — shell + chrome hiding)**

- Added `'reader'` as the fifth `AppMode` value (joining `'expert' | 'guided' | 'workshop' |
  'presentation'`). Entering reader mode auto-engages Browse Lock — same contract as presentation mode,
  no auto-disengage on exit.
- `TopBar` shows a minimal strip in reader mode: a "Reader mode" pill badge, an "Exit" button, and the
  help icon — all edit affordances hidden.
- `Inspector` hidden in reader mode (same guard as presentation mode).
- `StatusStrip` shows an indigo "Reader mode" chip (click to exit) before the Browse Lock chip.
- Command palette `switch-app-mode-reader` wired automatically via the `APP_MODE_OPTIONS` map.
- `App.tsx` adds `app-mode-reader` CSS class for targeted CSS overrides.

**Coaching tooltips (Slice 2 — entity + edge orientation)**

- New `src/domain/readerModeCoaching.ts` — domain registry with coaching copy for all 15 `EntityType`
  values and both `EdgeKind` values. Single source of truth; no UI strings in component files.
- New `EntityCoachingTooltip` component (`src/components/canvas/nodes/`) — renders a `w-56` card via
  the existing `NodeToolbar` (Position.Bottom, 8 px offset) when reader mode is active and the entity is
  hovered. Falls back gracefully for custom entity classes with no coaching entry.
- New `ReaderModeBanner` component (`src/components/canvas/overlays/`) — floating "How to read this"
  pill at top-centre of the canvas, reusing `printLegendFor(diagramType)` for copy. Truncates to first
  sentence; dismissed by ×; renders nothing for freeform diagrams.
- `ChallengeButton` edge overlay includes an edge-kind label pill (orientation label from the coaching
  registry) stacked above the "Challenge?" button at the edge midpoint.

**"Challenge this arrow" (Slice 3 — guided CLR comment flow)**

- New `ChallengeButton` component (`src/components/canvas/edges/`) — rendered via `EdgeLabelRenderer`
  at `labelY + 32 px` (below existing edge badges) when reader mode is active and the edge is hovered.
  Excludes note-edges and mutex arrows. Calls existing `startCommentAt({ kind: 'edge', edgeId })` — no
  new store action.
- `CommentComposer` derives an internal `challengeMode` flag: `isReaderMode && pendingCommentAnchor?.kind
  === 'edge'`. When true: heading changes to "What's your reservation about this arrow?"; CLR picker is
  promoted above the textarea with a hint "Naming the category helps the diagram author respond to your
  specific concern."; the "whole diagram instead" checkbox is hidden.

### Files

| New | Purpose |
|-----|---------|
| `src/domain/readerModeCoaching.ts` | Coaching copy registry (15 entity types + 2 edge kinds) |
| `src/components/canvas/overlays/ReaderModeBanner.tsx` | Floating reading-rule banner |
| `src/components/canvas/nodes/EntityCoachingTooltip.tsx` | NodeToolbar coaching card |
| `src/components/canvas/edges/ChallengeButton.tsx` | Edge midpoint challenge button |
| `tests/domain/readerModeCoaching.test.ts` | Registry completeness tests |
| `tests/components/ReaderModeBanner.test.tsx` | Banner render + dismiss smoke tests |

Modified: `store/uiSlice/types.ts`, `preferencesSlice.ts`, `App.tsx`, `TopBar.tsx`, `Canvas.tsx`,
`TPNode.tsx`, `TPEdge.tsx`, `CommentComposer.tsx`, `StatusStrip.tsx`,
`command-palette/commands/view.ts`, `tests/store/appMode.test.ts`.

Full suite **2924 passing** (1 pre-existing todo); tsc, build, and docs-bundle all green.

---

## Session 179 (cont.) — pattern library: cost-accounting / product-costing CRT

Researched the TOC critique of cost / Activity-Based-Costing "product costing" (Goldratt's "cost
accounting is the number-one enemy of productivity"; Corbett's *Throughput Accounting*; Noreen's
conditions on when ABC costs are relevant) and turned it into a curated CRT starter. The costing
paradigm — assigning every product a fully-loaded cost (truly-variable cost + allocated fixed
overhead) — is the **core-problem root cause**, fanning out into the canonical UDEs: profitable
products dropped, good marginal orders rejected, cost-plus mispricing, inventory built to "absorb"
overhead, capex that adds no throughput, and net profit stalling while local metrics look healthy.
ABC inherits the same root cause (it refines the allocation drivers but still spreads fixed cost onto
products). The root cause is flagged `coreProblem`, so the U-Shape "Create the Core Cloud" flow can
spawn the paired `ec-cost-vs-throughput` cloud; the two now cross-reference each other in the library
(like the tons-per-hour CRT ↔ schedule-adherence FRT pair). Pure content — one build file +
registration; `costAccountingPattern.test.ts` pins the single-core-driver fan-out, acyclic tree, and
completeness. Full suite green; tsc + build + bundle clean.

## Session 179 (cont.) — pattern library: 5 system-archetype starters (external-review E1)

External-review candidate **E1**. Five of Senge's system archetypes join the pattern library as curated
CRT/FRT starters — each a feedback loop the R/B badge reads, bridging System Dynamics (where the archetypes
live) and TOC (where you design the fix):

- **CRT, reinforcing (R):** Fixes that Fail · Escalation · Shifting the Burden · Eroding Goals.
- **FRT, balancing (B):** Limits to Growth — its balancing loop intentionally trips the FRT loop-polarity
  nudge ("an injection may be self-limiting — intended?"), which is exactly the archetype's lesson.

Pure content: five new `build()` files in `src/domain/patterns/` registered in `PATTERNS` — no schema change,
no UI change (the library dialog auto-surfaces them; loops are structural + auto-detected). These are the first
pattern builders to nominate a loop arc with `isBackEdge` and a balancing polarity with `weight: 'negative'`.
New `archetypePatterns.test.ts` pins each archetype's single cycle + intended R/B polarity + back-edge arc so
the defining dynamic can't silently drift. Full suite **2907 passing**; tsc + build + bundle-size green.

## Session 179 (cont.) — crt-tied-core-drivers: one-click "Spawn Evaporating Cloud"

Follow-up to the build batch below. The `crt-tied-core-drivers` warning (two root causes tied for the most
UDEs) was a message-only nudge; it now carries a one-click **Spawn Evaporating Cloud** action via the
`WARNING_ACTIONS` registry. The handler reuses `spawnECFromConflict` + `openDocInTab` — the same flow as the
`spawn-ec-from-selection` palette command — seeding a fresh EC from the tied root cause and opening it in a
new tab (the CRT stays in its own). A store-integration test + the action assertion; full suite green.

## Session 179 (cont.) — external-source build batch: CRT quality + loop polarity + logic-type lint + CLR comments + entity icons

The first build batch from the external-source review (`docs/EXTERNAL_TP_SOURCE_REVIEW.md`). Five themes,
all riding the existing CLR / comment / node infrastructure — no schema bump (every new persisted field is
additive-optional and strictly validated on import).

**Theme B — six CRT build-quality soft warnings** (Dettmer / Mabin / Fedurko construction heuristics),
CRT-scoped, reusing the cached `udeReachCounts` / `findCoreDrivers`:

- `crt-dead-branch` — a non-UDE entity that reaches no UDE (prune or connect it).
- `crt-ude-no-upstream` — a UDE with no incoming cause (the tree is incomplete there).
- `crt-low-core-driver-coverage` — the leading root cause explains < half the UDEs (two clusters?).
- `crt-tied-core-drivers` — two root causes tie for the most UDEs (a hidden conflict / Evaporating Cloud?).
- `crt-ude-wording` — a UDE phrased as the absence of a solution ("lack of…", a leading "No…").
- `crt-ude-count` — fewer than 3 / more than 15 UDEs (scope guard).

**Theme A — loop polarity (the System-Dynamics lens).** New `domain/loopAnalysis.ts` classifies each
detected cycle as **Reinforcing** (an even count of negative edges) or **Balancing** (odd) from the product
of `edge.weight` around the loop. An **R / B badge** rides the loop-closing back-edge on the canvas (stamped
in `useGraphEdgeEmission`, rendered in `TPEdge`). A new `loop-polarity` CLR nudge flags a *balancing* loop
where a reinforcing one is expected — unusual in a CRT/NBR problem tree, and usually a self-limiting injection
in an FRT. Answers "is this loop a feature or a bug?" at a glance.

**Theme C2 — `logic-type-mismatch` lint.** Flags an edge whose `kind` contradicts the diagram's primary
logic (sufficiency: CRT/FRT/TT/NBR; necessity: Goal Tree). EC/PRT/S&T/Freeform are out of scope.

**Theme C1 — CLR-labelled review comments.** A comment can carry an optional CLR category (new
`domain/clrCategory.ts` — the canonical 7), turning "I disagree" into "I have a <category> reservation"
(Mabin's non-threatening disagreement protocol). Composer dropdown, a badge on the rendered comment, and a
category filter in the panel (surfaced only once a doc uses the protocol). Round-trips; strictly validated.

**Theme D — discoverability + per-entity icons.** D1: the existing select-successors / -predecessors actions
now also appear on the right-click menu + selection toolbar (inline-run verbs; palette + keyboard unchanged).
D2: an optional per-entity icon (`Entity.icon`, a Lucide name from the 57-icon catalogue) layered on the
type/class default — picker in the EntityInspector, rendered on the node card, falls back to the default for
an unknown name.

Reviewer pass added a `findCoreDrivers` doc-reference cache (two CRT rules call it per validation pass) and a
`loopsWithPolarity` edge-keyed cache. ~50 new tests across `crtBuildQuality`, `loopAnalysis`,
`logicTypeMismatch`, `entityIcon`, `commentClrCategory`, and the emission + composer suites. Full suite
**2891 passing**; tsc + build + bundle-size all green. (Biome left to CI — the native binary is
AppLocker-blocked locally.)

## Session 179 — print: how-to-read legend in the vector PDF + multi-page clip fix

Closes backlog #2 (legend parity in the vector PDF) and fixes a latent multi-page rendering bug it
surfaced.

**Legend parity.** The per-type "how to read this" legend (Session 178) printed only on the
browser-print path; the vector **Save as PDF** ignored it. The same `printLayout.showLegend` toggle
now drives both. `exportToVectorPdf` gains an `includeLegend` option; when on, the diagram's
one-line reading rule (`printLegendFor(doc.diagramType)`) is wrapped to the usable page width with
the real `pdf.splitTextToSize` and printed in italic #525252 — matching the on-screen `PrintLegend`
— under the header on **every** diagram page. The band it occupies is reserved out of the drawable
height (so the diagram never collides with it); freeform diagrams (no reading rule) reserve and draw
nothing. The jsPDF instance is now created *before* the page-count math so the legend is measured
against real font metrics — the reserved band matches the drawn text exactly, no estimate/draw
drift. Per-page (vs the browser's once-under-the-title) is deliberate: each physical sheet of a
multi-page export stays self-explanatory.

**Multi-page clip fix.** The diagram SVG is drawn at full height on every page, shifted up by one
drawable-height per page, relying on the page edge to clip. But within a page nothing constrained
it, so a genuinely multi-page diagram (a) painted over the header/footer/legend bands and (b)
duplicated the bottom of page *i* at the top of page *i+1*. Each page now clips to its drawable band
before the SVG draws (`saveGraphicsState` → `rect(…, null)` → `clip` → `discardPath` → svg2pdf →
`restoreGraphicsState`). Passing `null` as the rect style adds the clip path *without* stroking a
visible border (a bare `rect` emits an `S`); svg2pdf renders inside that graphics state, so its
output is constrained too. Verified against the real jspdf@4.2.1 + svg2pdf.js@2.7.0 at the
content-stream level: the clip rect lands on the drawable region, the SVG fills nest inside it,
header/footer/legend sit outside, and `q`/`Q` stays balanced per page (no clip leak onto the
appendix/reasoning pages). The slices now tile seamlessly — a bonus correctness win beyond the
furniture overlap.

Tests: 5 new cases in `pdfExportPipeline.test.ts` (legend on/off, freeform draws none, legend
repeats per page, clip-rect geometry + one clip per diagram page). Full suite **2840 passing**; tsc
+ build + bundle-size all green. (Biome left to CI — the native binary is AppLocker-blocked locally.)

## Session 178 (cont.) — book: deepen the five concise per-type chapters

Backlog #3 (deeper per-type book descriptions). The CRT and EC chapters were already flagship-depth; this
brings the other five structured-type chapters — **FRT, Prerequisite Tree, Transition Tree, Goal Tree, and
Strategy & Tactics** — up to the same bar. Each now carries the full arc: a *why this tree exists* premise,
the tool-neutral method, **two** worked examples (the original plus a second from a different domain), fuller
practitioner-tips / common-mistakes sidebars, and type-specific sections — the FRT's prediction-vs-hope
distinction, the PRT's necessity-vs-sufficiency framing and ordered-plan export, the TT's
need→action→expected-effect reasoning layer and action-eligibility readout, the Goal-Tree/CRT overlap and
multi-goal diagnosis, the S&T facet semantics and decomposition-across-levels.

Every TP-Studio gesture cited in the new prose was grep-verified against `src/` (palette labels, entity types,
validators, export options, wizards, method checklists). An editor pass over all five then caught and fixed a
handful of factual slips against the code: the PRT pattern count (five, not four) and Goal Tree count (six — the
IT-function starter was omitted); a wrong export label in the Goal-Tree chapter (the option is **Reasoning as
narrative (Markdown)**); a TT tip that credited the narrative export with the numbered, owner-tagged handoff
that's actually the **Task tracker CSV** (`step / action / precondition / outcome / owner / due_date / status /
success_criteria`); and a PRT reading-direction claim that said the PRT "reads top-down, unlike CRT/FRT" —
contradicting the app's own layout model, where the PRT shares the CRT/FRT bottom-up (`BT`) vertical flow (apex
at top, leaf prerequisites at the bottom).

Markdown only under `docs/guide/**`; the rebuild-book GH Actions bot regenerates the PDF/EPUB on push. No app
code changed.

## Session 178 (cont.) — print: per-type "how to read this" legend

Backlog #2 (per-diagram-type print templates), scoped to a **how-to-read legend**: a one-line, type-specific
reading rule printed under the title so a shared printout explains itself to a reader who doesn't know the
Thinking Process. A CRT prints "Read bottom-up — each arrow means 'because…, therefore…'; the core driver is
the root cause that feeds the most UDEs"; an EC prints the in-order-to / we-must / because conflict reading; a
Goal Tree prints the Goal → CSF → NC necessity chain; and so on for all eight structured types.

- `printLegendFor(diagramType)` (pure, in `domain/printLegend`) returns the line per type; freeform has no
  fixed reading rule and prints nothing.
- A new `PrintLegend` print-only block renders it under the title, gated on `body.print-include-legend` —
  which `usePrintCanvas` sets from the persisted `printLayout.showLegend` pref, so a bare Ctrl+P honours it
  (default on). The fit-one-page box reserves a few extra lines when the legend is on so the footer doesn't
  spill to a second page.
- A "Include how-to-read legend" toggle in the Print dialog flips the pref.

Browser-print only for now — weaving the legend into the vector PDF's per-page header band is a small
follow-up (noted in NEXT_STEPS). Tests: `printLegend.test.ts` (every type's line + freeform empty) and the
`usePrintCanvas` suite extended for the legend class. Verified with a real print-to-PDF (legend under the
title, one page). Full suite green; tsc + knip clean.

## Session 178 (cont.) — print page setup: size · orientation · multi-page

Follow-up to the browser-print fix, adding the page-setup controls the backlog asked for. The Print /
Save-as-PDF dialog grows a **Page setup** row — **Size** (A4 / Letter), **Orientation** (Portrait /
Landscape), and **Scale** (Fit page / Fit width) — persisted as a UI preference so bare `Cmd/Ctrl+P`
honours the last choice.

- **Size + orientation** drive an injected `@page { size }` (so the browser dialog defaults to the chosen
  paper) and the print box, and pass through to the vector **Save as PDF** (which previously hard-coded A4
  portrait — landscape is a clean page-dimension swap, so all the existing pagination math follows for free).
- **Scale** is browser-print only: *Fit page* fits the whole tree onto one page (the overview, default);
  *Fit width* scales the tree to the page width and lets it flow down across as many pages as needed (the
  readable, multi-page detail view — nodes split at page edges, which the vector PDF still slices cleanly).
- `usePrintCanvas` reads the `printLayout` pref on `beforeprint`, sizes the print box from the chosen page's
  content area, frames the diagram (fit-page centres it; fit-width scales-to-width + flows), and restores
  everything on `afterprint`. The box is set inline per-layout, so `print.css` no longer hard-codes it.

The persisted `printLayout` pref (paper · orientation · scale) threads through the standard `StoredPrefs` /
`readInitialPrefs` / `preferencesSlice` machinery with a strict per-field validator (stale / tampered values
fall back to A4 · portrait · fit-page). Default = today's behaviour, so existing users see no change until
they pick something.

Tests: `usePrintCanvas.test.ts` extended to 6 cases (box dims per paper/orientation · fit-width pagination
geometry · `@page` injection · restore). Verified with real Chromium print-to-PDF: fit-width paginates a
14-node tree across 6 readable pages; A4 landscape + Letter render correctly. Full suite green; tsc + knip
clean.

## Session 178 — fix: browser print (Ctrl+P) rendered a blank page

`Cmd/Ctrl+P` (and the Print dialog's **Open print dialog** button) handed off to `window.print()`, but the
printed page came out **blank** — only the tab strip survived. Two independent, long-standing bugs:

1. **The diagram never made it onto the page.** `print.css` neutralised React Flow's viewport with
   `transform: none`, assuming a `fitView` had "locked" the viewport at export time — but nothing re-framed
   the diagram for a bare `window.print()`, so every node rendered off-page. And the `<main>` print rules
   (`height: auto; overflow: visible`) were a bare element selector that the Tailwind `h-screen
   overflow-hidden` utility classes (higher specificity) out-ranked, so the page stayed clamped to one
   viewport with overflow clipped.
2. **The title header + footer (+ appendix + reasoning) were hidden in print too.** Their screen-default
   `display: none` rule sat *after* the `@media print { … display: block }` block; equal specificity meant
   source order won, so `display: none` also applied in print.

The fix:
- New `usePrintCanvas` hook: on `beforeprint` it frames the whole diagram into a fixed print box
  (648 × 760, computed from node bounds via `setViewport` — deterministic regardless of screen size or
  print-reflow timing) and restores the user's exact pan/zoom on `afterprint`. Covers native Ctrl+P and the
  dialog's **Open print dialog** button (both dispatch `beforeprint`); an empty canvas is a no-op.
- `print.css`: dropped the `transform: none` flatten; `body.printing` pins the canvas row to the same box
  and lets `<main>` flow at natural height (header → diagram → footer stack, footer no longer orphaned to a
  second page); scoped the screen-default `display: none` to `@media screen` so the print rules win; added
  the chrome band (`app-chrome` = tab strip + title + toolbar), the selection toolbar, and the comments
  panel to the hide list.
- The MiniMap carries Tailwind's `sm:!block` — a *layered* `!important` that out-ranks any rule the
  (unlayered) print stylesheet can write — so it's hidden imperatively in the hook (inline `!important`),
  cleared on `afterprint`.

Result: Ctrl+P now prints a clean one-page diagram — title header, the whole tree fit to the page, dated
footer, no leaked chrome. Verified against a real Chromium print-to-PDF.

Tests: `tests/hooks/usePrintCanvas.test.ts` (framing math · `body.printing` toggle · MiniMap hide ·
viewport restore · empty-canvas no-op · listener unbind) and `e2e/print-canvas.spec.ts` (real React Flow:
`beforeprint` frames + hides the MiniMap, `afterprint` restores). Full suite green; tsc + knip clean.

## Session 177 (cont.) — print: reasoning companion (cause→effect read-out in print + PDF)

The print/PDF "reasoning companion" the backlog asked for. Tick **Include reasoning narrative** in the
Print / Save-as-PDF dialog and the diagram's cause→effect read-out — one numbered sentence per link in
topological order (the same `buildReasoningSentences` the on-screen verbalisation + the Markdown export
produce) — prints after the diagram (and after the annotation appendix when both are on), in BOTH the
browser-print path and the vector PDF.

- Extracted the shared `buildReasoningSentences(doc, label?)` primitive in `reasoningExport`; the
  Markdown narrative export now wraps it too (behaviour-identical).
- Browser print: new `PrintReasoning` print-only DOM block + a `print-include-reasoning` body class in
  `print.css`, mirroring `PrintAppendix`.
- Vector PDF: `renderReasoning` + `estimateReasoningPages` mirror the appendix's pagination, so the
  `{pageCount}` header/footer stays honest; the dialog passes the new `includeReasoning` option to
  `exportToVectorPdf`.

Tests: `buildReasoningSentences` (2), `estimateReasoningPages` (3), the PDF pipeline (renders a
Reasoning page after the diagram), and the `PrintReasoning` render (numbered list + empty-state). Full
suite green; tsc + knip clean; coverage 91.2% lines / 77.2% branches.

## Session 177 (cont.) — security review re-verified clean (backlog item closed)

Re-verified the threat model after this session's new code (cross-doc links + `stripMirrorLinks` /
`stripLinksToDoc`, `cloudType`, edge re-wire `reconnectEdge`, the edge-picker). CLEAN across all 8
SECURITY.md areas — `pnpm audit --prod` reports no known vulnerabilities; the import/persistence trust
boundary holds for every new optional field (`links` / `cloudType` / `coreProblem` strictly validated,
malformed entries dropped, prototype-pollution keys rejected); cross-doc `links` are inert navigation
metadata (resolve only against already-open tabs via no-op-guarded `switchTab` / `selectEntity` — not a
read/write vector). No new findings. SECURITY.md's "Last reviewed" bumped to Session 177; the two
standing accepted-no-action items remain its monitoring tail (dagre unmaintained → watch
`@dagrejs/dagre`; deprecated `unescape()` in `htmlExport` — no security impact). Backlog item closed.

## Session 177 (cont.) — eager link prune on doc-forget (U-Shape 2a hygiene, cont.)

Closes the small follow-up to the dangling-link work. When a document is *forgotten* (`closeTab` also
removes it from storage), its inbound cross-doc links in the OTHER open tabs are now swept too — not
just hidden at render. `closeTab` calls the new `stripLinksToDoc(docs, closedDocId)` and persists the
changed docs (no history; the active doc is kept in lockstep with `docs` in every close branch).
`linkPrune.ts` refactored to a shared `pruneLinks(docs, keep, skipDocId?)` core that both
`stripMirrorLinks` (keys on the deleted entity) and `stripLinksToDoc` (keys on the whole forgotten
doc) wrap. Tests: `stripLinksToDoc` unit (3) + closeTab integration for a forgotten background tab
and a forgotten active tab. tsc + knip clean; full suite green.

## Session 177 (cont.) — canvas edge-picker for overlapping edges (#1 canvas path)

The on-canvas half of #1: clicking where several edges converge on one entity used to grab whichever
edge React Flow put on top. Now a left-click that lands within hit distance of 2+ edges opens a small
menu listing them ("Cause → Effect") so you pick which one to select — no more fighting the stack. A
click on a lone edge still selects it directly.

- New pure `findOverlappingEdgeIds` (a multi-hit variant of the splice hit-test) + `getEdgeHitCandidates`
  reading the live React Flow instance — the smart-router `waypoints` when present, else source/target
  node centres. `onEdgeClick` intercepts a ≥2-edge hit and opens the picker; a single hit falls through
  to normal selection. Reuses the fully-accessible `ContextMenuList` via a new `edge-picker` target
  kind, so keyboard + screen-reader nav comes for free.
- Pairs with the inspector re-wire (above): the picker chooses *which* edge on the canvas; the inspector
  dropdowns then redirect its endpoints.

Tests: `findOverlappingEdgeIds` (5), `getEdgeHitCandidates` (4 — waypoints, node-centre fallback,
missing node, no instance), and the picker menu branch (lists the edges + selects on click). Full
suite green; tsc + knip clean; coverage 91.2% lines / 77.2% branches. The remaining #1 polish — the
hover-fan (spread converging edges on hover for a direct grab) — stays the documented next slice
("picker now, fan later").

## Session 177 (cont.) — Edge Inspector cause/effect re-wire dropdowns (#1, primary path)

The "can't grab one of N overlapping edges to re-route it" problem, solved the clean way: the Edge
Inspector's **Cause** and **Effect** read-outs are now editable dropdowns of the doc's entities (by
title). Pick a different one → the edge re-points via `reconnectEdge` — no canvas drag, no fighting
the stack. Select ANY edge in a converging pile and redirect its endpoints exactly.

- Reactive entity list (live-updates on rename); the opposite endpoint is disabled (no self-loop); a
  redirect that would duplicate an existing edge is declined with a toast. Re-pointing the *effect*
  of a junctor edge drops its group membership (junctors are per shared target) — matches the canvas
  drag-reconnect gesture, which this pairs with (same `reconnectEdge` validation).
- Note-edges keep the read-only display (a note endpoint isn't a causal cause→effect pair).
- New reusable `Select` form primitive (shared inspector chrome; native `<select>` for free keyboard
  + screen-reader support).

Tests: 6 EdgeInspector cases (render, re-wire source + target, self-loop disabled, Browse-Lock
disabled, note-edge read-only fallback); `reconnectEdge`'s own guards stay store-tested. Full suite
2803 green; tsc + knip clean. The remaining #1 sub-path — on-canvas drag affordances for stacked
edges (fan-out / picker / hover-cycle) — stays open as a separate slice.

## Session 177 (cont.) — dangling cross-doc link prune (U-Shape 2a hygiene)

Cross-tab entity links (Phase 2a) are reciprocal, but deleting a linked entity left the OTHER
entity's mirror link behind as a tombstone — it rendered as a misleading "tab closed" chip and rode
along in exports. Two complementary fixes:

- **Eager sweep on delete.** `deleteEntity` / `deleteEntitiesAndEdges` now call the new pure
  `stripMirrorLinks(docs, fromDocId, deletedIds)` to drop the reciprocal mirror from every OTHER open
  tab. A cheap link-presence guard makes it a no-op for the (almost all) entities that carry no
  links; no history entry, never touches the active doc — mirrors `unlinkEntity`'s cross-doc write.
- **Lazy render guard.** `EntityLinksSection` now distinguishes a DELETED target (target tab open,
  entity gone → hide the dead link) from a merely-CLOSED tab (unreachable muted chip, reopen to
  revive). Covers the case where the source doc's tab was closed when the target was deleted, so the
  eager sweep couldn't reach it.

Tests: `stripMirrorLinks` unit (6), delete-sweep store integration incl. the reverse direction (3),
and the dead-link-hidden render case. Full suite 2797 green; tsc + knip clean; 91.2% lines / 77.2%
branches. (The U-Shape roadmap itself — cloud-type tag + cross-doc links + guided helpers — was
already fully shipped in Sessions 154–156; this closes the one remaining hygiene gap.)

## Session 177 (cont.) — exporter pipeline coverage: pdfExport 93% / pptxExport 83% branches (#4 closed)

The last open coverage target — the heavy jspdf / pptxgenjs exporters — built on the existing mock
harnesses (no new machinery):
- **pdfExport** 95→**99% lines, 100% functions, 78→93% branches**: dark-surface capture, the viewBox
  and default dimension fallbacks, and the appendix page-break + "(untitled)" entity path.
- **pptxExport** 97→**100% lines, 100% functions, 76→83% branches**: the **Likely Core Driver** slide
  (CRT root cause reaching ≥1 UDE — previously untested), the untitled-diagram cover, and the
  single-chunk "Reasoning" title.

The remaining uncovered branches are unreachable-defensive (the EC `?? '—'` fallbacks sit behind a
`wants/needs length === 2` guard; a couple of DOMParser null-root guards). Floor ratcheted branches
74→75. With the emission/projection hooks, `canvasRef`, and `CreationWizardPanel` covered last pass,
the coverage backlog item is closed (~91% lines / 77% branches overall).

## Session 177 (cont.) — rendering refactor pass complete (#2 closed)

The last safe extractions from the 9-item plan — behaviour-preserving, with the visual fallbacks
now reading as named dims:
- **`junctorKindField(and, or, xor)`** in `junctorGeometry` resolves an edge's junctor field + id
  (precedence AND → OR → XOR) in one place. `TPEdge` drops its `isAnd/isOr/isXor` derivation, the
  field ternary, and the `?? ?? ` groupId lookup — it branches on `junctor !== null` and reads
  `junctor.field` / `.groupId`. Directly unit-tested.
- **JunctorOverlay magic numbers → named constants** — `220`→`NODE_WIDTH`, `72`→`NODE_MIN_HEIGHT`
  (numerically identical; the junctor-geometry tests pin the result), so the source-X / height
  fallbacks read as the node dimensions they are.
- **`Point` consolidated** onto `edgeGeometry.Point` in `dragSplice` (re-exported to keep the
  module's `pointToSegmentDistanceSq` / `findSpliceTargetEdge` signature surface).

Declined with reason, so #2 can close: the `nodeAbsoluteCenter` helper dedup (the 3 call-sites have
different fallbacks and some need only X — a parameterized helper is more complex than the 1-line
inline calc) and removing the `nodeSizeFor` fallback (defensive, not dead). `lineIntersectsBox`
already carries its cross-reference. tsc + knip clean; full suite green. The rendering-refactor
backlog item is fully shipped.

## Session 177 (cont.) — coverage raise (heavy-mock targets) + bundle #8 closed

- **Coverage raise.** +24 tests on the harder targets (a sub-agent drafted them; I fixed the
  branded-id casts + verified): `canvasRef` OR/XOR/overwrite/clear, the `useGraphProjection`
  hoist-filter path, `useGraphNodeEmission` data fields (openCommentCount, hiddenDescendantCount,
  effectiveState, speculated, diffStatus), and `CreationWizardPanel` branches (don't-show-again,
  Goal-Tree step 4, minimise/close, skip-on-empty). lines 90.9→91.0, branches 76.7→76.9; floor
  ratcheted (lines 88→89, statements 85→86).
- **Bundle #8 actionEligibility closed** — can't gate behind `diagramType === 'tt'`: `statePropagation`
  runs for every diagram via `usePropagatedStates` (`useGraphView`), and `actionEligibility` is eager
  via `EntityInspector`. The bundle-size backlog is now fully cleared.

## Session 177 (cont.) — rendering dedup: junctorGroupId helper + routeEdge @internal

More of the rendering-refactor plan (the safe, test-covered extractions; the visual + bigger-touch
items stay deferred to a dedicated render-verify pass):
- **`junctorGroupId(edge)`** in `graphCore` folds the `andGroupId ?? orGroupId ?? xorGroupId` lookup
  (repeated in the prune pass + the router) into one generic helper that preserves each caller's id type.
- **`routeEdge` marked `@internal`** — the live canvas path is `computeEdgeRoutes` (one visibility
  graph per layout); the single-edge entry stays the pure, test-pinned API, no new callers.

Behaviour-preserving; tsc + knip clean, full suite 2752 green.

## Session 177 (cont.) — backlog clear-up: shareLink lazy-load + two perf items closed

- **shareLink dynamic-imported (bundle #6).** `App.tsx` no longer eager-imports
  `services/shareLink` (CompressionStream + the doc decoder); it loads via `await import()` inside
  the `#!share=` boot guard, so it leaves the main chunk for the <1% share-link path. `vite build`
  confirms a ~1.0 KB gz `shareLink` chunk; index 95.25 → 94.58 gz.
- **Closed two no-action items.** TPNode's whole-`currentDoc` read is already optimal — the
  `useShallow` selector pulls only `diagramType`/`customEntityClasses` and shallow-compares, and React
  Flow memoises the node. The TopBar shortcut-registry import (bundle #4) can't split — the registry
  is needed eagerly by `SelectionToolbar` (a core shell component) too. Both pruned from the backlog.

## Session 177 (cont.) — backlog clear-up: #6/#9 closed + EC/wizard lazy-loads

- **Closed #6 (stale-code hunt) + #9 (CanvasInner watch item).** Finished the stale-comment
  sweep — rewrote the `selectors.ts` header (multi-doc tabs shipped by swapping `state.doc`, not
  the planned `state.docs[activeDocId]` flip, so `currentDoc` stays a thin alias) and dropped the
  bare "Phase C —" labels from the edge-routing API docs. Documented why `CanvasInner` reads the
  whole doc (it's the projection host; no sound narrowing exists). Both pruned from the backlog.
- **EC chrome + creation wizard now lazy-load (bundle #15 / #16 / #17).** `React.lazy` + per-site
  `Suspense` (null fallback) for `VerbalisationStrip` (+ `domain/verbalisation`),
  `ECReadingInstructions`, `ECInjectionChip` (Canvas), and `CreationWizardPanel` — they split OUT
  of the main `index` chunk and load only on EC docs / on a wizard action. `vite build` confirms 5
  new on-demand chunks (~8.5 KB gz off the initial load). Full suite 2752 green; tsc + knip clean.

## Session 177 (cont.) — backlog bundles #1 (refactor + cleanup) + #3 (verification + hardening)

A four-slice pass (each its own commit), driven by four parallel read-only analyses:

- **Coverage raise.** Covered the lowest-cost gaps from a coverage analysis, weighted to the
  weak branch axis: `revisions` detailed-diff + status helpers, edge custom-attribute actions,
  selection-mode toggles / cancel guards / `completePendingEdge`, the Flying Logic exporter,
  and the bulk-entity / edge delete-confirmation branches. lines 90.5→90.9, branches 76.2→76.7;
  CI floor ratcheted (functions 84→85, branches 73→74).
- **Print bug + stale comments.** Fixed a `print.css` cascade bug — a second `.print-only {
  display: none }` inside `@media print` was HIDING the print-only header (title / author /
  description) in print. Plus refreshed stale comments a dead-code sweep flagged (the false
  "Not wired up yet" on the per-doc storage keys; "Phase A — routes always {}" on now-live
  routing; references to the long-deleted `EdgeAssumptions`).
- **Security refresh (F1).** A full audit found the codebase in strong shape; the one
  actionable item: revision restore loaded a snapshot straight into `setDocument`, bypassing
  the `importFromJSON` validation every other load path runs. Now validated on restore (also
  migrates a stale-schema revision). dagre-unmaintained + a deprecated `unescape()` accepted
  as no-action.
- **Rendering dedup.** Folded two private box-inflate helpers (`inflate`, `inflateBox`) onto
  the canonical `padBox`. The fuller rendering-refactor plan (junctor-field + Point-type
  consolidations) is queued for a dedicated pass with visual verification.

Full suite 2752 green throughout.

## Session 177 (cont.) — back-edge loop: wider + rounder corners + compact clearance (Dann)

- **Wider, rounder loop (Dann picked from rendered variants).** The side swing widened
  (`CLEAR_MARGIN` 60→110) and the dome/bowl raised (`LOOP_END_CLEAR` 84→120, tangent 0.55→0.60), so
  the corner reads as a broad, organic arc with a gentle rounded top & bottom. Options were rendered
  side by side and picked before shipping.
- **Compact colinear clearance (#3 fix).** A back-edge whose source sits below its target (the loop
  fits in the gap) with a card sitting colinear between them used to graze that card (~10px) where the
  diagonal sweep cut its corner. `backEdgeLoopRoute` now takes the spanned obstacles and pulls each
  rail end to the near edge of such a card, so the sweep reaches the rail clear of it (~29px now;
  pinned by a test). Per-end tangent handles keep a clamped end from overshooting. The wrap case is
  unchanged. Self-verified by render (wrap + compact both clear); full suite green.

## Session 177 (cont.) — back-edge loop: rounded corners, clear of the cards (Dann)

- **The rail loop is rounded AND no longer corners against the entities.** Each rail END is
  pulled a fixed clearance (`LOOP_END_CLEAR`, 84px) OFF the card it meets — up off the source's
  top, down off the target's bottom, derived from the fixed back-edge exit convention rather than
  the relative position. So the loop turns onto the rail well clear of the card — a rounded dome
  above the source, a rounded bowl below the target — instead of bending right at the card edge,
  while the straight middle still guarantees the obstacle clearance. Short tangent handles keep the
  turn UP near the rail end, not back down at the card's own level (the bug that made the earlier
  corner hug the entity). Handles both the WRAP loop (source above target — the reported case) and
  the COMPACT loop (source below target; clearance clamped to keep a straight rail). Self-verified
  by render: corners sit 84px off the cards, the rail 60px off a spanned card, no crossings. Full
  suite green.

## Session 177 (cont.) — back-edge loop: rail/bracket that clears entities (Dann #3)

- **The back-edge loop is now a rail/bracket** — out from the source, a straight vertical run down a
  side rail CLEAR of the chain, then back in to the target — replacing the single bulging cubic. A
  single cubic is widest at its middle and pinches toward the ends, so an obstacle near the source /
  target could still be crossed; a rail is equidistant from the chain along the whole span. It's
  obstacle-aware: the reach widens so the rail clears every card the loop passes (plus a `CLEAR_MARGIN`
  gap), and the side needing the smaller rail is chosen. Fixes review #3 ("crosses behind an entity /
  needs more swing"). Replaces the `BACK_EDGE_LOOP_*` span-scaling with `backEdgeLoopPlan` /
  `backEdgeLoopRoute` (`backEdgeLoop.ts`).
- **Self-verified with a rendered screenshot** (route geometry → Pillow draw + a programmatic
  crossing check): the loop crosses no middle card on even / tight / obstacle-near-the-end layouts. A
  permanent clearance test in `useEdgeRoutes.test.tsx` pins it — the rail's vertical run sits outside a
  spanned entity's box. Full suite green (2720).

## Session 177 (cont.) — back-edge review fixes, round 2: flow-aware auto-detect (Dann #2)

- **Auto-detection now picks the against-flow edge as the back-edge** — the cycle edge spanning the
  most along the layout's flow axis (the chain-spanning closer, i.e. the downward one in a bottom-up
  CRT), not the arbitrary id-canonical edge. So the feedback edge a user draws auto-detects as the
  loop-closer (orange/dash + looped) without a manual tag, and the *forward* edges stay forward. Fixes
  review point #2. Manual tags still win per cycle (round 1).
- **Plumbing:** `effectiveBackEdgeIds(doc, layout?)` gains a positions+axis-aware path (`backEdges.ts`);
  the set is computed ONCE in `useGraphView` (where positions live), content-stabilized so the
  position-independent edge-emission memo still holds across drags, then handed to BOTH routing
  (`useEdgeRoutes`) and emission (`useGraphEmission` → `useGraphEdgeEmission`, which stamps
  `data.isBackEdge`). `TPEdge` reads the stamp instead of re-deriving — a per-edge component can't see
  all node positions to make the against-flow pick. The id-based path stays as the no-layout default.
- +3 tests (against-flow pick / manual-wins-with-layout / missing-position fallback); full suite green.
- Still open: #3 full obstacle-aware swing (round 1's wider swing may already suffice — pending review).

## Session 177 (cont.) — back-edge review fixes, round 1 (Dann)

- **Manual tag wins per cycle.** Auto-detection no longer marks a SECOND (often forward) edge of a
  loop the user already tagged. Dann's report: tagging the real `effect → cause` back-edge spuriously
  styled the forward `root cause → effect` edge of the same cycle as a back-edge too — the auto-picker
  chose a cycle member by entity-id order, blind to the manual tag. Now a cycle containing any
  manually-tagged edge is left to that tag (`backEdges.ts`: `cycleEdgeIds` + the manual set threaded
  into `autoBackEdgeIds`). Fixes review point #1. +1 test.
- **Wider back-edge loop swing** — base clearance 56 → 90, plus a span-scaled term so a tall loop
  (spanning more ranks) bows wider and clears the entities it passes (`BACK_EDGE_LOOP_SPAN_FACTOR`,
  capped). Partial fix for #3; the flow-aware auto-pick (#2) + full obstacle-aware swing land next.
- Full suite green.

## Session 177 (cont.) — Wave 3 item 2: back-edge loops around the source (first cut)

- **A vertical-axis back-edge now bows out to one side into a visible feedback LOOP** instead of running
  straight between the source's top and the target's bottom — where it overlapped the forward edge's
  corridor (source below target) or ran straight through both node boxes (source above target). New pure
  `domain/backEdgeLoop.ts`:
  - `backEdgeLoopSide` — obstacle-aware side pick: prefer a clear side (right by default), `null` when
    BOTH bulge regions are blocked → the router keeps the straight A\* route (the "don't force an ugly
    detour" fallback).
  - `backEdgeLoopRoute` — a single side-bowed cubic between the top/bottom anchors + a coarse 3-point
    polyline for crossing / hit-testing.
  Wired into `routeOneEdge` (vertical axis only — EC unaffected); the decross pass now never reroutes a
  back-edge away from its deliberate loop. Tunable: `BACK_EDGE_LOOP_CLEARANCE` (56) + `VERTICAL_REACH_FACTOR`
  (0.4). +11 tests (geometry both ways + the bow integration); full suite green.
- **First cut — pending Dann's visual review** (item 2's expected rounds): is the bow the right magnitude
  and side, and does it read as a loop on a real cyclic CRT? The two constants above are the dials.

## Session 177 — attended coverage recommendations (exporters + component harness)

- **Lines 87.8% → 90.2%, statements 85.0% → 87.2%, functions 83.6% → 86.3%, branches 73.8% → 75.8%**
  (+59 tests, test-only / behaviour-preserving; full suite green) — the deferred "attended" half of
  the Session 176 coverage assessment, picked up when Dann said "do all your recommendations":
  - **Heavy exporters** `pptxExport.ts` (~26%) + `pdfExport.ts` (~30%) — the full `exportPPTX` /
    `exportToVectorPdf` pipelines, mocking the lib + capture boundaries (pptxgenjs, jspdf via
    `loadJsPdf`, `html-to-image`, `svg2pdf.js`, the download). Every deck-slide branch + the
    multi-page / appendix / header-footer / page-size / no-op paths. +15.
  - **Comments** `CommentThread.tsx` (16%) + `CommentComposer.tsx` — direct render with spy callbacks:
    reply, edit-in-place, delete, resolve/reopen, jump-to-anchor; the composer's whole-diagram toggle,
    Cmd/Ctrl+Enter, and empty-body guard. +18.
  - **Inspector sections** `StFacetsSection` (0%), `EntityLinksSection`, `ActionFields` — prop-driven
    render (S&T facets, cross-doc link chips, TT action fields + eligibility callouts). +16.
  - **Store-connected** `EvidenceList` + `GroupInspector` — real-store round-trip (add / edit / cycle /
    validate / remove evidence; rename / recolor / preset / collapse / archive a group). +10.
- **Re-pinned the CI coverage floor** (`coverage:pin`) to lines 88 / statements 85 / functions 84 / branches 73.
- **Found + fixed while testing:** a latent `pdfExport` appendix-pagination bug — the first appendix
  page reused the diagram's last page (overlaying it) instead of starting fresh, because
  `renderAppendix`'s `startNewPage` skipped `addPage()` on its first call. It now always adds a page at
  the appendix boundary (a diagram page always precedes it), which also makes `{pageCount}` honest since
  the appendix occupies the physical pages its estimate already reserved. Pinned by a page-count
  assertion in `pdfExportPipeline.test.ts` (1-page diagram + appendix = 2 physical pages).
- Remaining coverage gaps left as a deliberate call: `CreationWizardPanel` step-flow now covered;
  still open are several canvas overlays (`ContextMenu`, `CanvasNav`, `StFacetRow`) and DOM/keyboard
  hooks (`useDraggablePanel`, `useArrowKeyNodeNav`).

## Session 176 (cont.) — test-coverage sweep (autonomous, 8 batches)

- **Lines 86.5% → 87.8%, statements 83.7% → 85.0%, branches 72.7% → 73.8%, functions 83.1% → 83.6%**
  (≈150 newly-covered lines, +43 tests, all behaviour-preserving / test-only; full suite green):
  - `services/canvasRef.ts` (~30% → ~95%) — the hovered-junctor registry + `getSelectionViewportRect`
    (DOM rect union across entities / edge-endpoints / group, in jsdom).
  - `useGraphProjection` (54% → ~90%) — hoist / collapse / archived / F7 entity-collapse branches (renderHook).
  - `useGraphNodeEmission` (38% → ~80%) — entity / group-rect / collapsed-card emission + diffStatus + eligibility.
  - The palette command groups `tools.ts` / `groups.ts` / `document.ts` — invoke each command, assert the store
    effect (retype / structure / polarity / group / hoist / archive / dialog-openers).
  - `domain/flyingLogic/writer.ts` (85% → ~98%) — header / junctors / groups / XML escaping.
  - `services/exporters/image.ts` (51% → ~90%) — the PNG / JPEG / SVG success path (html-to-image mocked).
- **Re-pinned the CI coverage floor** (`coverage:pin`) to lines 85 / statements 83 / functions 81 / branches 71.
- Remaining big gaps (need lib-mocks or render harnesses — left for an attended pass): the heavy exporters
  `pdfExport` / `pptxExport` (jspdf / pptxgenjs), the render-heavy components (`CommentThread`, `CommentsPanel`,
  `CreationWizardPanel`, inspectors), and the DOM/keyboard hooks (`useGlobalShortcuts`, `useDraggablePanel`).

## Session 176 (cont.) — autonomous test-coverage pass

- **Raised coverage on the lowest-covered pure modules** (test-only, behaviour-preserving;
  baseline 86.1% lines / 72.2% branches):
  - `services/exporters/text.ts` + `markup.ts` — the browser-download wrappers (were fn 0% /
    ~22% lines): each export's filename, MIME type, and emitted content, by mocking only
    `shared.triggerDownload` and running the real `slug` + domain transforms. +10 tests.
  - `domain/persistenceValidators.ts` — the strict member validators (`validateEdge` /
    `Assumption` / `Comment` / `Group` / `Record` were untested), including the
    prototype-pollution key rejection (`__proto__` / `constructor` / `prototype`) and the
    `validateEntity` enum + optional-field branches. +16 tests.

## Session 176 (cont.) — Wave 3 item 1: back-edge attaches in the flow direction

- **A back-edge now exits the source's TOP and enters the target's BOTTOM** (the flow-facing
  side in a bottom-up tree), overriding the position-based side pick — via the `forceSides` seam
  (prep) + `effectiveBackEdgeIds` threaded through the router (`routeOneEdge` / `RoutedEdge` / the
  `computeEdgeRoutes` loop / the de-cross reroute). Only the vertical (tree) axis is forced; EC
  keeps the normal pick. This is the attach-direction foundation for the loop-around-source
  routing (item 2): on a diagram whose loop-closer already exits the top (source below target —
  e.g. the inventory CRT) it's a visual no-op; it fixes the direction when a back-edge's source
  sits above its target. +1 router test.

## Session 176 (cont.) — remove the cycle CLR warning (superseded by auto-detect)

- **Deleted the cycle CLR warning rule** (`validators/cycle.ts` + its registration in the
  validator index + its unit tests + the perf-bench line). With Wave-3-0 auto-detection, every
  cycle's loop-closer now renders as a distinct orange/dashed back-edge — a far more direct signal
  than a text warning — so the warning was redundant (Dann's call). `'cycle'` is kept in the
  `WarningRuleId` union (a WarningsList test fixture references it); no other rule emits it. Stale
  `findCycles` comments now point at `effectiveBackEdgeIds`.

## Session 176 (cont.) — auto-detect back-edges (Wave 3-0)

- **A cycle's loop-closer is now auto-detected as a back-edge** — it renders distinct
  (amber-orange + dashed) without a manual "Tag as back-edge", and Wave-3 routing will read
  the same set. New pure `src/domain/backEdges.ts`: `effectiveBackEdgeIds(doc)` = manually
  tagged edges ∪ each cycle's closing edge (the `cycle[last]→cycle[first]` convention shared
  with the cycle CLR rule), WeakMap-cached, **derived only** — it never touches the persisted
  `isBackEdge` flag, so the manual tag and the cycle CLR warning are unaffected. Wired into the
  canvas rendering (`TPEdge` visual selector + `useGraphEdgeEmission` a11y label). +4 unit
  tests; verified in-browser (the untagged loop-closer `DJJo` in Dann's CRT now paints orange,
  and auto-detection correctly picks the #6→#4 closer). **Open decision:** the cycle CLR warning
  still fires on a loop until it's manually tagged — auto-detection styles the loop-closer but
  does not (yet) silence that warning.

## Session 176 (cont.) — distinct colour for tagged back-edges

- **Back-edges now paint a distinct amber-orange** (`#ea580c`) instead of the default
  grey, so a feedback-loop closer stands out from the grey causal edges and the junctor
  purple. Slots into `resolveEdgeVisuals`' stroke priority (drop-target → mutex →
  selected → **back-edge** → junctor → default); the custom arrowhead (fill = stroke)
  follows. Hardcoded like the mutex red — the colour is the semantic signal — so it shows
  in every palette. The existing back-edge dash ("6 4") + extra width are unchanged. **Note:**
  `isBackEdge` is a manual tag (right-click an edge → "Tag as back-edge"); the colour applies
  once tagged — auto-detecting loop-closers is a separate backlog item. +1 unit test, verified
  in-browser. (`edgeVisuals.ts`.)

## Session 176 (cont.) — Z batch wave 2: assumption placement (Z-3); Z-4 was stale cache

- **Z-3 — an anchored assumption now renders beside the edge it annotates** instead of
  dumped in a far corner. An assumption-typed entity shows as a card but has no causal
  edges (it links to an edge via `Edge.assumptionIds`, drawn as a dashed connector), so
  dagre treated it as an isolated 1-node component and packed it into the corner with a
  long diagonal dashed line across the whole diagram (Dann: "rendered very very far
  away"). New pure `src/domain/assumptionPlacement.ts` (`anchoredAssumptionIds` /
  `placeAssumptionsNearEdges`): anchored assumptions are excluded from the dagre input
  (they contribute nothing structural → the real graph stays byte-identical) and placed
  after layout beside their edge's midpoint, pushed perpendicular on the side farther
  from the structural centroid (into open space). Wired through `useGraphPositions`
  (filtered out of `buildLayoutInputs`; the position map is augmented, memoised on the
  laid-out base + an anchor signature so re-anchoring re-runs without re-running dagre).
  **+7 unit tests**; verified in-browser (every structural card sits exactly where it
  did; the dashed connector is now short). Manual diagrams (EC) — which position
  assumptions via `entity.position` — are untouched.
- **Z-4 — "forward edges have no arrows" was a stale bundle, not a bug.** A real-browser
  load of Dann's exact fixture showed every direct-forward edge already carrying a
  correctly-placed arrowhead, byte-identical to the back-edge's (emission stamps the same
  `markerEnd` on every non-junctor edge). The Wave-1 deploy refreshed the asset hashes;
  Dann reloaded and confirmed the arrows are back. No code change.

## Session 176 — Z batch wave 1: editable zoom + F2-to-rename

Two small UX wins from Dann's "Z batch". The basic drawing flow is unchanged.

- **The zoom-percent chip is now click-to-edit.** Clicking the "{n}%" readout in the
  bottom-centre `CanvasNav` swaps it for a numeric input; type a value + Enter and the
  canvas zooms to that percentage (`flow.zoomTo`, which clamps to React Flow's 50–200%
  range), Escape cancels. The `+` / `−` / fit buttons and the `+` / `−` / `0` keyboard
  shortcuts are untouched — this just makes the readout itself an input. Focus + select
  on open via a ref (no `autoFocus`, per the a11y lint). (`CanvasNav.tsx`.)
- **F2 renames a selected entity** — the conventional rename key, alongside the existing
  Enter. F2 only edits entity titles; on a group it's a no-op (Enter still hoists). Delete
  / Backspace already deleted the selection. (`useSelectionShortcuts.ts`; the help dialog's
  rename row now reads "Enter / F2".)

Verified: tsc + knip clean, production build green, **+2 unit tests** (F2 edits an entity;
F2 on a group is a no-op) plus a new **e2e spec** driving the click → type → zoom → Escape
flow (green on system Edge locally; CI runs it on Chromium). 90 hook + 17 overlay/registry
tests green.

## Session 175 — AND/OR/XOR cause-edges meet their sender cards flush

Two edge-rendering issues from Dann's screenshot — one fixed, one investigated and
left as-is by his call.

- **Junctor cause-edges now connect flush to the sender card** (was a ~10px gap).
  The AND/OR/XOR cause-edges skip the smart router (they terminate at the junctor
  circle, which the router can't see), so they fall back to React Flow's raw handle
  position — which sits at the OUTER edge of the 20px (`!h-5`) handle, ~10px off the
  card. Routed edges anchor on the node's box boundary (flush); the junctor ones
  floated above it ("the AND edges don't touch the sender entities"). New pure
  `junctorSourceAnchor(axis, handleX, handleY, topLeft)` (`junctorGeometry.ts`) +
  a `useJunctorSourceAnchor` hook (`useJunctorCenterX.ts`) re-anchor the cause-edge's
  source onto the node's real edge (top for the vertical trees, left for EC), read
  from the live React Flow position so it tracks drags / re-layout. `TPEdge` feeds
  the corrected source to the bezier; a no-op for non-junctor edges, so the default
  bezier is unaffected. Verified: measured source gap **6px → 0** (flush with the
  routed greys), **+3 unit tests**, 67 edge/junctor tests green.

- **Edge crossing (#5 follow-up) — investigated; kept the crossing (Dann's call).**
  Dann flagged an X that "could have gone right around the entity." Reconstructed his
  layout and reproduced it, then confirmed the decross pass *can* make it
  crossing-free — but every crossing-free route for that symmetric X fights the chart
  flow: it either loops over the top (entering a card from above) or dips far below
  its source to clear a vertical edge. That's exactly the "against the flow" shape the
  Session-173 flow guard rejects in favour of keeping the crossing. Given the tension
  between "go around it" and "a crossing beats a backward detour," Dann chose to keep
  the crossing — which the existing conservative logic already does. No code change.

- **AND/OR/XOR output arrow now enters the effect vertically.** The junctor sits
  over its causes (offset from the effect's center), so the straight output line —
  and its `orient="auto"` arrowhead — came in on a diagonal that read as pointing at
  a neighbouring edge, not into the card (Dann). New pure `junctorOutputPath`
  (`junctorGeometry.ts`) draws a rounded "L": sideways at the junctor's level, then
  STRAIGHT UP into the effect's bottom-center — the long vertical final approach is
  what makes the arrowhead read as perpendicular. (A curve that only straightened at
  the very end wasn't enough; the junctor gap is only ~35px.) This complements the
  layout's existing `balanceFreeAxis` node-centering pass — which already re-centers
  each effect over its causes to avoid diagonals, but is constrained (no rank-reorder
  / overlap) so it can't fully align a junctor when a shared cause is pulled aside by
  dagre. +1 unit test (`junctorOutputPath`); visually verified.

## Session 174 — CI: action-send-mail@v4 → @v17 (the actual last Node-20 runtime)

`dawidd6/action-send-mail` — the "Email the EPUB to Kindle" step in
`rebuild-book-pdf.yml` — was pinned to `@v4`, whose bundled runtime is `node20`,
the source of a recurring "Node.js 20 actions are deprecated" warning on every
book-send run. Bumped to `@v17` (runtime `node24`); all ten inputs the step uses
(`server_address` / `server_port` / `secure` / `username` / `password` / `from` /
`to` / `subject` / `body` / `attachments`) are unchanged, so it's a drop-in.

This is the genuine completion of the Node-24 migration. Both Session 135 ("every
JS action pinned to a major that runs on Node 24 natively") and Session 153 ("drop
the last Node-20 runtime") over-claimed — `send-mail@v4` slipped through both
sweeps because its `v4` tag *looks* current, but the series actually runs to v17,
so the pin was many majors behind. Verified against every other `uses:` across all
six workflows: each is already on a Node-24 major (`actions/*@v5`–`v7`,
`pnpm/action-setup@v6`, `create-pull-request@v8`). With this, no action in any
workflow runs on Node 20.

## Session 173 — edge & arrow rendering polish

Visual refinement of the causal arrowheads + the AND/OR/XOR junctor, from Dann's
review. Geometry-only; the gate stays green.

- **Arrowheads now follow the edge's actual curve, not the straight chord.** The
  arrowhead was placed + oriented along the straight source→target line, but the
  rendered edge is a bezier — so on a bent or converging edge the arrowhead floated
  *beside* the stroke instead of on it (worst where two causes converge on one
  effect). `arrowheadOnPath` (`edgeArrowhead.ts`) now reads the rendered path's
  terminal tangent (its last cubic's `end − c2`) and sits the arrowhead on that, so
  the tip rides the line as it enters the card. Falls back to the straight chord when
  a path has no parseable cubic; `terminalTangent` + `arrowheadOnPath` are pure +
  unit-tested (8 new cases).
- **Arrowheads sit closer to the entity.** `ARROW_TIP_GAP` 11 → 6 (Dann: the tip sat
  too far from the card on a straight edge).
- **The AND/OR/XOR output arrow no longer crowds the junctor circle.** On a short
  output line (effect directly above the circle) the marker's base landed right on the
  circle. The marker `refX` 20 → 15 pulls the arrowhead up toward the effect, opening
  clear space above the circle (`JunctorOverlay`).
- **Cause-edges connect flush to their cards.** The connection handle's dot was an 8px
  *white-filled* circle centred on the card border, so it hid the first ~4px of every
  edge — the edge read as starting a few px *off* the card. Dropped the fill: the dot
  is now a ring (the edge shows through it to the border), so edges connect flush while
  the ring stays a discoverable connection marker (`TPNode`). Against the white card
  the dot already read as a ring, so the only visible change is edges no longer being
  clipped by it.

- **Edge-crossing reroute (#5).** The smart router is per-edge / crossing-blind by
  design, so a manual node move could leave two unrelated edges crossing in an "X". A
  second pass in `computeEdgeRoutes` now detects crossing pairs (`polylinesCross` over
  the routed waypoint lists, skipping pairs that share an entity) and re-routes the
  cheaper edge AROUND the other — feeding the other edge's polyline to A\* as a thin
  obstacle corridor (a chain of small AABBs that stays tight on diagonals, where a
  segment's bbox would engulf the quadrant). It's conservative: a reroute is kept only
  when it STRICTLY lowers that edge's crossing count **AND stays within the chart's flow
  band** (`respectsFlow`) — Dann's rule: an edge that detours *backward against the flow*
  reads worse than the crossing, so a reroute that would leave the source→target band is
  rejected and the crossing is kept. (So #5 reroutes only when it can be done cleanly
  in-flow; otherwise the X stays.) Reroute attempts (each a local visibility-graph
  rebuild) are capped, and the whole pass stays behind the `'smart'` routing pref.
  Pre-work landed first as a separate behaviour-preserving refactor: the `segmentsCross`
  / `polylinesCross` primitives + extracting `routeOneEdge` so the reroute reuses the
  routing body. New tests pin the primitives, `respectsFlow`, "a crossing only undoable
  against the flow is kept", and "a clean layout is untouched"; the 50-edge perf ceiling
  holds.

## Session 172 — autonomous under-the-hood optimization pass

A self-directed maintainability/performance sweep (no user-facing change), driven
by four parallel read-only audit agents (dead-code, non-canvas perf, type-safety,
bundle-size) and landed in small independently-gated batches. Plus one user-reported
crash fix that surfaced mid-session (first bullet below).

- **Fixed a React #185 ("Maximum update depth exceeded") infinite-render crash in
  `PresentationStepThrough`.** A pre-existing latent bug (since Session 135) surfaced from
  a user's console. Its Zustand selector built a fresh `orderedIds` array on every call
  inside `useShallow` — but `useShallow` shallow-compares the *returned object*, so the
  always-new array reference never matched, and `useSyncExternalStore` saw an uncached
  snapshot every render and looped ("The result of getSnapshot should be cached to avoid
  an infinite loop"). Because the subscription runs *above* the component's
  `!isPresentation` early-return, it looped in **every** mode, not just presentation; the
  error boundary isolated it (the canvas itself renders fine), but it spammed the console
  and burned render cycles on every load. Fix: subscribe only to stable values — the
  `entities` map reference + the selection-id primitive — and derive the ordered walk in a
  component-level `useMemo`. Reproduced + verified gone via a dev-server console capture;
  new `overlaySmoke` regression tests mount the component (which the pre-fix code threw on
  render), mirroring the existing `JunctorOverlay` guard for this same
  `useSyncExternalStore` trap.

- **Cause→effect arrowheads now sit flush on the edge and read clearly.** The
  Session-171 arrowheads used React Flow's SVG `markerEnd`, which orients to the
  path's ENDPOINT tangent — the target handle's fixed normal (vertical for a
  `Position.Bottom` handle). But the routed/bezier edge approaches the box
  *diagonally*, so an offset marker pointed the wrong way and tucked under the
  card. `TPEdge` now renders the arrowhead itself as a custom oriented `<path>`,
  aligned to the source→target direction and positioned a few units before the
  target so the stroke runs straight out of its tip into the entity — bigger and
  on-the-line, per Dann's review. The AND/OR/XOR junction output arrow (a
  straight `<line>` in `JunctorOverlay`, where a marker *does* align) was enlarged
  to match. The now-unused `EdgeArrowMarkers` `<marker>` defs + canvas mount were
  removed; the two ids stay as the emission↔render "has arrowhead" contract.

- **Refactor — the causal arrowhead is now one tested module (`edgeArrowhead.ts`).**
  After the direction fix, the arrowhead's geometry (an inline IIFE in `TPEdge`),
  its tuning constants, and the emission↔render id tags were scattered across
  `TPEdge` + a now-misnamed `EdgeArrowMarkers.tsx` (it held no markers). All
  consolidated into `edgeArrowhead.ts`: a pure, unit-tested `arrowheadPlacement`
  (`edgeArrowhead.test.ts`, 7 cases) + the size / tip-gap / silhouette constants
  + the two id tags. `TPEdge` calls the module; `EdgeArrowMarkers.tsx` is deleted.
  So the anticipated next round of arrow tweaks (bigger / different offset /
  different shape) is a one-line, type-safe, tested change. Behaviour-preserving;
  added an "Arrowheads" section to `docs/RENDER_ENGINE_NOTES.md` mapping the
  causal-path vs junction-marker split.

- **Note edges are arrow-less again.** The now-visible custom arrowhead was
  rendering on dotted note edges (emission stamps `markerEnd` on every
  non-junctor edge; the `TPEdge` arrow gate only excluded mutex). The Session-171
  marker was invisible so this never showed — the visible `<path>` exposed it.
  Added the missing `!isNoteEdge` to the gate, so notes (annotations) and mutex
  edges (symmetric conflict) are both arrow-less by design.

- **Test coverage — three focused suites for previously-thin pure-logic + glue.**
  A coverage-driven pass (`vitest --coverage`, picks ranked by uncovered × ease)
  added 28 cases across the lowest-covered *testable* units. No source changes —
  behaviour-preserving:
  - The `quickCapture` **service** (`applyQuickCapture`) went from ~4 % to fully
    exercised: the store glue that turns a parsed capture tree into entities +
    parent→child edges, anchors free roots to a target, and re-selects the whole
    pasted set (`tests/services/quickCapture.test.ts`). The pure *parser*
    (`parseQuickCapture`) was already tested; the apply step never was.
  - The `contextMenuItems` verb→`MenuItem` bridge — `toMenuItem`'s three dispatch
    branches (registered palette command / inline run / safe no-op) + the
    `exactOptionalPropertyTypes` conditional `destructive` spread, and
    `leadingVerbItems`' non-destructive filter
    (`tests/components/canvas/contextMenuItems.test.ts`).
  - The edge-routing geometry hot-path primitives previously reached only
    *transitively* through the full router: `segmentCrossesBoxBounds` (the inlined,
    allocation-free A\* slab test — easy to break with an off-by-one, invisible at
    the router level), `padBox`, and the 3+-point `bezierThroughWaypoints`
    composition (`tests/domain/edgeGeometryPrimitives.test.ts`).
  Whole-project coverage sits at ~83 % statements / 72 % branches / 86 % lines; the
  local gate (tsc + biome + knip + full vitest + build) stays green.

- **Dead-code removal — 7 unused exports + 1 unused type deleted; knip now reports
  zero unused exports** (was 7). All were stranded when `CustomEntityClassesSection`
  was removed in Session 136, or were test-only hooks nothing calls:
  - `SELECTED_BUTTON_CLASS_ICON` / `UNSELECTED_BUTTON_CLASS_ICON` (`ui/buttonClasses.ts`) —
    the icon-scale button pair; the plain `SELECTED_BUTTON_CLASS` / `UNSELECTED_BUTTON_CLASS`
    stay (live in `RadioGroup`, EdgeInspector, DocumentInspector, …).
  - `Select` + `SelectProps` + `SelectOption` (`settings/formPrimitives.tsx`) — the third
    form primitive; every call site only ever imported `TextInput` / `TextArea`.
  - `chipClass` (`inspector/chipColors.ts`) — a one-line `CHIP_SCHEME[scheme]` wrapper no
    consumer used (they index the pre-built dictionaries directly).
  - `CUSTOM_CLASS_ICON_NAMES` (`domain/entityTypeIcons.ts` + its `entityTypeMeta` re-export).
  - `__resetValidatorCacheForTests` / `__resetSimilarityCacheForTests` (`domain/validators/`) —
    test-only cache resets with zero callers (the WeakMap/LRU caches isolate naturally).
  - `type AttrKind` (`domain/types/entity.ts` + the `types` / `domain` barrel re-exports) —
    a `AttrValue['kind']` alias nothing imported.
  Also fixed the stale `CustomEntityClassesSection` references those symbols' doc comments
  still named. Behaviour-preserving — full suite unchanged.

- **Memoised side-panel work that recomputed on every store mutation.** Four
  recompute-while-open hot spots now skip when their inputs are unchanged (the doc
  store re-refs `doc` on every keystroke, so an open panel that reads it re-ran this
  work on every edit):
  - `RevisionRow` ran `computeRevisionDiff(revision.doc, liveDoc)` per row, per
    render — with the History panel open, every keystroke re-diffed *every* snapshot
    against the live doc (O(rows × doc size)). Now `useMemo`'d on `[revision.doc,
    liveDoc]` (the snapshot is a frozen ref, so only `liveDoc` moves).
  - `RevisionPanel`'s branch bucket-and-sort is `useMemo`'d on `[revisions]` (was
    rebuilt every render) and finds each branch's latest capture with `reduce`
    instead of `Math.max(...spread)` (drops a per-comparison argument-array alloc).
  - `CommentsPanel`'s `visibleThreads` filter is `useMemo`'d on `[threads, filter]`.
  - `CommandPalette`'s id→command `Map` is built once at module scope instead of
    re-allocated inside `recentCommands` on every keystroke.
  All behaviour-preserving; pinned by the existing component suites.

- **Compile-time exhaustiveness guard on `petalRoleForDiagram`** (`injectionFlower.ts`).
  The diagram-type → flower-petal switch had a `default: return 'related'` that
  silently absorbed every unhandled `DiagramType`. Now every member is an explicit
  case and the `default` is a `satisfies never` guard — so adding a future diagram
  type fails to compile until it's deliberately classified. Runtime behaviour is
  identical for every current input.

## Session 171 — AND/OR/XOR junctor follows its causes

- **Junctor circles now center over their causes, not under the target.** A
  recurring complaint ("it enters from the side"): an AND junctor was pinned at
  its *target's* X, so when one cause sat far off-axis — e.g. a CRT effect that
  also feeds a second effect, which dagre pulls sideways — that cause-edge swept a
  long way across and entered the circle horizontally instead of rising into it
  from below. Past fixes only moved the circle *vertically*; the sideways entry is
  a *horizontal* problem. Now the circle sits over the mean of its causes' X
  (slid a configurable `JUNCTOR_NUDGE_TOWARD_TARGET = 0.25` back toward the
  target), so every cause converges into it from below and the single line up to
  the effect becomes a clean diagonal — the classic Flying-Logic look.
  - **Coordinated, single source of truth.** The placement math lives in one pure
    helper (`junctorCenterX`, `junctorGeometry.ts`); `JunctorOverlay` uses it for
    the circle and a new `useJunctorCenterX` hook uses it for each cause-edge
    terminus in `TPEdge`, both reading the SAME live React Flow node positions —
    so the circle and the edges can never drift apart, and both track a re-layout.
  - Gated to junctor edges (ordinary edges register no extra subscription and are
    untouched). New `junctorGeometry.test.ts` (9) + extended `junctorOverlay.test.ts`
    pin the centroid placement + the under-target fallback; verified in real
    Chromium on the `crt-tons-per-hour` pattern. Added a `loadPattern(id)` test
    hook so the e2e/preview harness can load a library diagram deterministically.

- **Routed edges keep clearance from cards they pass (`NODE_OBSTACLE_MARGIN`).**
  The smart router's obstacle boxes were the exact node size, so a routed edge
  that detoured around a card it isn't attached to could graze the card's edge and
  read as if it connected to it. The graph + per-edge obstacle sets now use the
  node box inflated by 10 px (anchoring still uses the exact box, so edges connect
  to their own nodes precisely), so a passing edge keeps a visible gap. Only the
  routing obstacle picture changed — clean layouts and the visual-snapshot suite
  (A→B, no third-node obstacle) are unaffected.

- **A junctor with one input auto-collapses to a plain edge.** AND/OR/XOR are
  multi-operand connectives — a group left with a single member is logically
  vacuous (one cause is just a direct sufficiency/necessity arrow, not a
  junction), and it rendered as a lonely "AND of one" circle. `groupAs*` already
  refuses to *create* a group from <2 edges, so a singleton only arises by
  deleting one side of a pair; new pure `pruneSingletonJunctors` clears the
  junctor field on any sub-2-member group, wired into both delete paths
  (`deleteEdge`, `deleteEntity`) and the load/import chokepoint (`importFromJSON`,
  which every load — localStorage, file-open, share-link, clone — flows through),
  so existing/older docs get tidied on reload too. Reversible (re-group anytime);
  supersedes the old deliberate "AND of one" tolerance. New `graphPrune.test.ts`
  (5) + store-level delete tests in `junctorGroups.test.ts`.

- **Junctor circles are now obstacles for the edge router.** The AND/OR/XOR
  circle is a rendered overlay the smart router (visibility-graph + A\*) couldn't
  see, so an unrelated edge — typically a cause node's OTHER outgoing edge — could
  pass behind it and read as if it connected to the junction ("this edge goes
  through the AND"). `useEdgeRoutes` now adds each junctor circle as an obstacle
  box (new pure `junctorObstacleBoxes`, geometry mirroring `JunctorOverlay` /
  `useJunctorCenterX` — centred over the causes, `JUNCTOR_CENTER_OFFSET_Y` below
  the target, + an 8 px margin), so those edges route AROUND the circle. The
  junctor's own cause-edges are still skipped by the router, so they're unaffected.
  New `junctorObstacleBoxes` tests pin the box geometry; the 89 existing routing
  tests stay green (clean layouts unchanged).

- **More vertical room below a junctor (`LAYOUT_RANK_SEPARATION_JUNCTOR_MIN`
  90 → 160).** Centering the circle fixed the *horizontal* sweep, but the cause
  rank still sat only ~40 px below the circle, so an off-axis cause still entered
  almost flat ("there should be more space below the AND"). The junctor rank-sep
  floor now drops the cause rank ~110 px below the circle, so each cause rises into
  it at a readable angle — a proper converge-from-below fountain. Only junctor
  diagrams pay the larger gap; the visual-snapshot suite (no junctor) is unaffected.

- **Every causal / necessity connector now shows a clear cause→effect arrowhead.**
  The arrowhead *is* the TP logic — it tells the reader which end is the cause and
  which the effect (sufficiency / necessity direction) — but it was effectively
  invisible: React Flow's built-in `ArrowClosed` scales with the thin ~1.5 px edge
  stroke (so it rendered tiny) and can't be offset (no `refX`), so its tip landed
  *on* the target handle and hid under the handle dot. New custom SVG markers
  (`EdgeArrowMarkers`) fix both: a real fixed-size triangle (`userSpaceOnUse`, so
  it doesn't shrink with the stroke), `orient="auto"` to follow the edge, and a
  `refX` set *past* the tip so the whole arrowhead is pulled a few units back along
  the edge — clear of the handle dot that was burying it. Verified in real Chromium
  on `crt-tons-per-hour` (the cause→effect direction reads at a glance).
  - **Exceptions preserved.** Junctor (AND/OR/XOR) edges still drop their arrowhead
    — the junctor circle owns the single shared output arrow into the effect, so
    siblings don't pile arrowheads onto one point; an *aggregated* junctor edge
    (a collapsed group with nothing to converge with) keeps its arrowhead, in the
    AND colour. Mutex and note edges are unchanged.
  - **Palette-stable.** Colour lives in the marker def, read from the LIVE edge
    palette (`EDGE_PALETTES[edgePalette]`), so a Settings → Appearance switch to the
    colourblind-safe or mono palette recolours the arrowheads in place without
    re-emitting any edges; the emission layer just stamps a stable bare marker id.

## Session 170 — Deeper TPEdge + connect-end resolver (from the canvas sweep)

- **Subscription hygiene — the sweep's last micro-opts.** Two real fixes + one
  honest "won't fix":
  - **`CommentCountBadge` `onOpen` → `useCallback`.** The badge is `memo`'d, but
    `TPNode` passed it a fresh inline-arrow `onOpen` every render, defeating the
    memo so the badge re-rendered on *every* node re-render. The callback now has a
    stable identity keyed on `entity.id` (store actions read via `getState()`), so
    the badge re-renders only when its count actually changes.
  - **`SelectionToolbar` whole-`doc.edges` sub → junctor-topology hash.** The
    toolbar subscribed to the entire `edges` record purely as a verb-recompute
    trigger, re-rendering on *any* edge mutation (label / weight / polarity /
    description). Audit of `verbsForBranch` shows the verb list reads edges in
    exactly one place — the `multi-edges` branch's `any{And,Or,Xor}Grouped` checks
    on `andGroupId`/`orGroupId`/`xorGroupId` (`verbsForSingleEntity` reads none;
    `single-edge` verbs are static; `branchFor` is pure). Now it subscribes to a
    sorted string hash of just those group memberships — a primitive, so it
    re-renders only on the changes that can flip a verb. Behaviour identical (107
    toolbar/verb/junctor/node tests + the full suite green).
  - **`CanvasInner` whole-`doc` sub — assessed, left as-is.** This is the projection
    host: `doc` feeds `useGraphView` / `useSearchDimming` / the drag handlers, all
    of which legitimately need the whole document, and the expensive work is already
    gated by sub-field-keyed `useMemo`s downstream. Re-rendering on a doc edit is
    correct here — there's no sound narrowing, so it stays.

- **Extract `resolveConnectEndTarget` from `onConnectEnd`.** The connection-drag
  release handler was a ~90-line imperative chain that interleaved the drop-target
  *decision* (node body? junctor circle? edge body? empty?) with its *side effects*
  (Browse-Lock guard, store mutation, toast, clearing two hover channels). Pulled
  the decision into a pure `resolveConnectEndTarget` returning a discriminated
  union (`noop` / `connect` / `junctor` / `junctor-missing` / `edge-andcause`), so
  the priority order — node body beats junctor beats edge body beats empty — is now
  declarative and unit-tested (`resolveConnectEndTarget.test.ts`, 10 cases incl. the
  cross-kind member-lookup guard). `onConnectEnd` shrank to a snapshot-then-`switch`:
  it reads the verdict and executes. Adding a drop-target is now "a variant + a
  case." The handler's behaviour is pinned unchanged by the existing 9
  `useGraphMutations` integration tests (drop-on-body / self-loop / toHandle /
  Browse-Lock / junctor-missing / edge-body / ref-clearing / feedback-flags), all
  still green. (One incidental tidy: both hover channels now clear up-front in every
  past-the-guards path, dropping a latent stale-`hoveredEdgeRef` carryover the old
  code left on a Browse-Lock-blocked junctor drop.)

- **Extract `useRadialRoute` from TPEdge.** The radial obstacle-router was ~65
  lines inline in the edge body: two store subscriptions (`layoutMode` + React
  Flow's `nodes`, the latter behind a custom `radialNodesEqual` comparator) plus a
  position-keyed `useMemo` that collected obstacle boxes and called
  `computeRadialEdgePath`. Pulled the whole thing into a self-contained
  `useRadialRoute.ts` hook, with the obstacle-collection glue (source/target
  filtering + node-size fallback) split out as a pure `radialRouteForEdge` so it's
  unit-testable without a React Flow store or a mounted edge. TPEdge now calls one
  `useRadialRoute({ … })`. **Same two subscriptions, same memo deps, same guard
  order** — behaviour identical; new `useRadialRoute.test.ts` (4 cases) pins the
  extracted glue, and the 47 existing edge tests + full suite stay green.
  - *Deliberately NOT done:* the sweep also floated "stamp `mutexPath` /
    `isRadialMode` into edge `data` at emission to kill the subscriptions."
    `useGraphEdgeEmission` is **intentionally position-independent** (its header
    documents that a drag doesn't re-run it), so moving position-dependent routing
    into it would either break drag-tracking or force every edge to re-emit on
    every drag — the exact churn the memo comparator exists to prevent. The
    subscriptions it would remove are primitive selectors that effectively never
    fire, so the perf win is nil against real regression risk. Left as-is by design.

## Session 169 — Structural tier (from the canvas sweep)

The higher-value structural refactors the sweep surfaced — behaviour-preserving,
each gated green.

- **`memo` TPGroupNode + drop its render-time subscription.** The per-group node
  component wasn't memoized (unlike TPNode / TPEdge), so it re-rendered on every
  nodes-array change. Wrapped in `memo` with a custom comparator that compares
  the `data` *contents* (group ref + bbox dimensions + `selected`) — the emission
  pass rebuilds `data` every run, so a reference compare wouldn't help. The
  `selectGroup` action is now read imperatively via `getState()` at click time
  rather than as a render-time store subscription.

- **Extract `resolveEdgeVisuals` from TPEdge.** The edge's stroke colour / width /
  dash / glow were five entangled inline conditional chains in the render. Pulled
  into a pure `edgeVisuals.ts` (`resolveEdgeVisuals(flags, palette)`) with the
  priority order in one declarative, unit-tested place (drop-target → mutex →
  selected → junctor → default) — so a new edge style is a single case there
  rather than a five-chain edit. The `MUTEX_STROKE` / `SPLICE_TARGET_STROKE`
  literals moved with it. Behaviour identical; new `edgeVisuals.test.ts`.

- **Extract `computeMutexPath` from TPEdge.** The EC mutex (D ↔ D′) straight-line
  override was a 26-line IIFE doing geometry + a `selectEdgeSides` call inside the
  render. Pulled into a pure function in `resolveEdgePath.ts` (the home of the
  path selector), testable without mounting the edge. Behaviour identical; new
  `computeMutexPath.test.ts`.

- **EntityInspector decomposition (started).** Began carving the 718-line inspector —
  the most-used editing surface — into sections. Moved the file-private
  `StFacetsSection` to its own file, and extracted the inline **State picker** (the
  speculation-aware state buttons + propagation-derived callout) into
  `EntityStateSection.tsx`; the parent wraps the store writes so the section takes
  plain `onSetState` / `onSetSpeculative` callbacks. Behaviour-preserving — the 88
  inspector tests + the full suite pass unchanged. Then extracted **`ActionFields`**
  (the TT Step # / Need / Working-Assumption / eligibility group; the parent wraps
  `updateEntity` into a plain `onUpdate`). Guarded by a new real-browser
  `e2e/inspector.spec.ts` — it drives React Flow selection via the `__TP_TEST__`
  hook and asserts each extracted section renders, the verification the headless
  jsdom + preview path can't do. Then extracted **`EntityLinksSection`** (the
  navigable cross-doc "Linked to" chips; the parent wraps switchTab / selectEntity /
  unlinkEntity). Finally extracted **`EntityProvenanceSection`** (the paired
  Attestation / Owner + Mark-validated / Evidence-list block; the parent wraps
  `updateEntity` into a plain `onUpdate`). All five sections are now out
  (StFacets / State / Action / Links / Provenance) — the inspector shrank from 718
  to 363 lines, each section self-contained and behaviour-preserving, the
  decomposition complete; the inspector tests + both e2e specs stay green.

## Session 168 — Rendering maintainability batch (from the canvas sweep)

Three findings from a rendering/flow/clickability sweep — one unify + two fixes,
each gated green (tsc + biome + knip + full suite + build).

- **Unify node sizing into `nodeSizeFor`** (`graphViewConstants.ts`). The "how big
  is this node?" rule (entity → `NODE_WIDTH × NODE_MIN_HEIGHT`, S&T-format →
  `ST_NODE_HEIGHT`, collapsed-root → `COLLAPSED_*`, unknown → `null`) was
  copy-pasted across four pipeline stages; now one helper feeds `useGraphPositions`
  (dagre inputs), `useEdgeRoutes` (A\* obstacle boxes), and `useGraphNodeEmission`
  (group bbox + the MiniMap measurement hint). Adding a new sized node type is a
  one-line change. **Fixes** the S&T MiniMap / group-bbox hint, which was a flat
  `NODE_MIN_HEIGHT` (72 px) for cards that render at `ST_NODE_HEIGHT` (220 px).

- **Routed-edge labels ride the route** (`waypointMidpoint` in `edgeGeometry.ts`,
  consumed by `resolveEdgePath`). A bent (A\*-routed) edge's mid-label was anchored
  at the straight bezier midpoint, which can sit far from the path — even inside an
  obstacle the route bends around. The label now sits at the 50%-arc-length point
  along the route's waypoints (bezier fallback when waypoints are absent).

- **Edge palette actually applies (a11y fix).** Settings → Appearance → Edge palette
  (default / colorblind-safe / mono) was stored, validated, persisted, and had a UI
  — but every edge-color consumer read the hardcoded *default*-palette constants, so
  the colorblind-safe and mono palettes recolored nothing on the canvas. `TPEdge`
  (stroke / selected glow / reconnect handles), `useGraphEdgeEmission` (arrowhead
  marker), and `JunctorOverlay` (AND junctor) now read the live `edgePalette` from
  the store, so the palettes recolor strokes + markers as intended. Removed the
  now-dead `EDGE_STROKE_*` back-compat token exports (knip baseline unchanged).

- **`openRightPanel` helper** (`dialogsSlice.ts`). The "History + Comments share the
  right-edge slot, only one is open, and opening History clears the selection so the
  Inspector yields the column" rule was duplicated across four open/toggle actions;
  one helper now owns it, so adding a third right-slot panel is a one-line change.
  Behaviour-preserving; new store test pins the exclusion + selection contract.

- **`markEntityAs` helper** (`commands/tools.ts`). The five identical `mark-as-*`
  palette verbs (UDE / root cause / CSF / Action / Outcome) each inlined the same
  11-line select-single-entity → retype body; collapsed to one-liners over a shared
  guard. Behaviour-preserving.

## Session 167 — Efrat cloud: ship the two breaking channels as canvas notes

Follow-up to Session 166. The two cloud-breaking channels now ride *on the
canvas* of the `ec-efrats-change-cloud` starter — not just in the book — as
non-causal **notes** pinned to the need each one protects (Channel 1 → security,
Channel 2 → satisfaction). Notes render dotted and are excluded from the CLR
rules (an endpoint is a note), exactly like the boundary note on the IT-function
Goal Tree, so they read as facilitation hints without disturbing the cloud's
logic or verbalisation. Injections proper stay off the EC canvas — they emerge
from scrutiny and develop across linked docs via the Injection Flower; a note is
the right primitive for a pre-drawn hint.

- **`buildECPattern` gained an optional, zero-default `notes` field** (text +
  anchor box + canvas position). The other 15 EC patterns pass nothing and build
  byte-for-byte as before. The `ec-efrats-change-cloud` structural guard moved
  with the pattern — 5 slotted cloud boxes + 2 unslotted notes, 4 necessity
  links + 1 mutex + 2 non-causal note-edges. EC book section updated to note that
  the starter now ships the channels.

## Session 166 — Efrat's resistance-to-change cloud (pattern + book)

Integrated Efrat Goldratt-Ashlag's 1995 model (*Embracing Change vs. Resistance
to Change*) — purely additive, no schema or functionality change.

- **Refined the `ec-efrats-change-cloud` pattern** to the paper's cleaner,
  more canonical framing: goal *be happy at work*; the two needs are
  **satisfaction** (a sense of achievement → pulls you to *embrace* change) and
  **security** (confidence in the reliability of your predictions → pulls you to
  *resist* change); the two wants are the near-perfect mutex *embrace* ↔
  *resist*. Stays a clean 5-box cloud via `buildECPattern` (same id + label, so
  the `patterns.test.ts` structural guard and every consumer are unchanged); the
  registry hint was updated to match. Original/paraphrased wording — no text
  lifted from the copyrighted paper.

- **New EC book section** (`docs/guide/05-evaporating-cloud.md`) — *"The
  resistance cloud — why people both want and fear change."* Teaches the
  security-vs-satisfaction model, the doubt sweet-spot, the content-blindness of
  security, and the two cloud-breaking **channels as injections** (protect
  prediction reliability; give an owning role), pointing at the refined pattern.
  Fills the chapter's one real gap: it taught cloud *mechanics* but not the
  psychology of resistance or how to break a resistance cloud. Paraphrased +
  attributed.

  Decision note: the two channels are taught in the book as injections rather
  than shipped as floating entities on the EC starter — injections aren't
  natural inhabitants of an EC *canvas* in TP Studio's model (they emerge from
  scrutiny; the Injection Flower develops them across linked docs), and all 16
  EC patterns are deliberately clean 5-box clouds.

## Session 165 — Autonomous optimization batch

A run of self-contained, behaviour-preserving optimizations (each gated green —
tsc + biome + knip + full suite + build — and reverted on any doubt):

- **Split `persistenceValidators.ts`** (733 → 433 lines). The strict member
  validators (entity / edge / assumption / comment / group) stay; the file now
  draws on three leaves — `persistenceValidatorsShared.ts` (18; the `invalid` /
  `isFiniteNumber` helpers), `persistenceFieldValidators.ts` (208; the strict
  attribute / evidence / importedFrom / links sub-field validators), and
  `persistenceValidatorsSoft.ts` (132; the drop-bad-fields preference
  validators) — and re-exports the soft set so `@/domain/persistenceValidators`
  stays the single import site for `persistence.ts` + the tests. Bodies verbatim;
  136 persistence/round-trip tests pass unchanged.

- **Split `graph.ts` into a re-export barrel** (654 → 36 lines). The pure graph
  queries now live in three focused modules — `graphCore.ts` (322; the cached
  array / edge-index / by-type lookups + entity predicates, a dependency-free
  leaf), `graphReach.ts` (193; reachability / path / cycle traversals), and
  `graphPrune.ts` (158; cascade-delete cleanup + the comment-count aggregation)
  — and `graph.ts` re-exports their public surface, so the 40+ importers across
  validators / store / exporters / layout are unchanged. Bodies verbatim; full
  suite green.

- **Split `persistence.ts` into a re-export barrel** (538 → 30 lines) along its
  natural concern boundary: `persistenceJson.ts` (138; the pure `string ↔
  TPDocument` transform — `exportToJSON` / `importFromJSON`) and
  `persistenceStorage.ts` (386; localStorage read/write + the multi-doc tab
  slots). `persistence.ts` re-exports both, so `@/domain/persistence` stays the
  single import site. Bodies verbatim; 62 persistence/storage tests + full suite
  green.

## Session 164 — Split edgeRouting.ts (maintainability refactor)

Behaviour-preserving split of the project's largest file
(`src/domain/edgeRouting.ts`, 1150 lines) into focused leaf modules — gated by
the existing **byte-identical A\* parity** tests (`edgeRoutingAStarParity`) so the
routes are provably unchanged:

- **`edgeGeometry.ts`** (193 lines) — shared types (`Point` / `Box`), constants
  (`OBSTACLE_PADDING` / `DETOUR_CLEARANCE`), and the box/segment primitives
  (`segmentIntersectsBox`, `segmentCrossesBoxBounds`, `padBox`). A dependency-free
  leaf — which **dissolves the old `edgeSides` ↔ `edgeRouting` value cycle**:
  `edgeSides` now imports the geometry leaf directly instead of reaching back into
  the router (the apologetic "type-only import to avoid a runtime cycle" comment
  is gone).
- **`edgeBezier.ts`** (287 lines) — the SVG bezier emitters + samplers (legacy +
  side-aware).
- **`edgeVisibilityGraph.ts`** (480 lines) — the visibility-graph + A\* engine
  (`VisibilityGraph`, `buildVisibilityGraph`, `aStarOnGraph`, `findVisibilityPath`,
  the `AStarOpenHeap`).

`edgeRouting.ts` is now **271 lines** (down from 1150) — it keeps `routeEdge` (the
orchestrator), the blocking-obstacle hit-test, and the single-obstacle detour
heuristic, and **re-exports** the sub-modules' public surface so
`@/domain/edgeRouting` stays the single import site. No consumer (the
`useEdgeRoutes` hook, `flow-types`, the tests) changed an import. Pure code
movement — bodies verbatim; tsc + biome + knip clean; the full edge-routing suite
(105 tests incl. the golden A\* routes) and the full suite stay green.

## Session 163 — Performance-measurement anchors (Phase 3 #5)

The final Phase-3 slice — **Phase 3 is now complete.** A document can carry two
optional **performance anchors** that frame the gap it addresses: a **Low**
(current / unacceptable) and a **High** (target / desired) measurement note.
They live in a collapsible **"Performance frame"** section of the Document panel
(collapsed by default, auto-opens when either is filled, with an "N/2 anchors"
count) — a facilitation note, general to every diagram type, that travels with
the document.

Purely additive: optional `performanceLow?` / `performanceHigh?` strings on
`TPDocument` (soft-validated on import — a non-blank string is kept, else dropped
— so no migration; stays `schemaVersion 9`), `setPerformanceLow` /
`setPerformanceHigh` store actions (coalesce-and-drop-blank, mirroring
`setCloudType`), and two textareas in `DocumentInspector`. Nothing keys off them.
Tests in `tests/store/performanceAnchors.test.ts` (setters + JSON round-trip +
soft validation) and `tests/components/DocumentInspector.test.tsx`. tsc + biome +
knip clean; full suite green.

**Phase 3 (the TP-Basics smaller-gaps menu) is complete: #4 NBR trim, #8 TT step
fields, #7 CLR scrutiny, #3 Injection Flower, #6 PRT plan export, #5 performance
anchors — all shipped, all additive, no schema migration.**

## Session 162 — PRT ordered-plan export (Phase 3 #6)

A Phase 3 slice. A new **"Prerequisite plan (CSV)"** export turns a Prerequisite
Tree into an ordered implementation plan. Where the Transition-Tree task export
sorts by an explicit step field, a PRT has no step numbers — its order is implied
by the dependency edges — so this exporter **topologically sorts** the tree and
emits the Intermediate Objectives prerequisite-first (an IO that another IO
depends on comes earlier). One row per IO: step / objective / **overcomes** (the
obstacle it targets) / **depends_on** (prerequisite IOs) / owner / due_date /
status / notes. Drops into Jira / Trello / a spreadsheet, like the TT task bridge
it extends.

Lives in the **Export…** picker, gated by `requiresEntityType:
'intermediateObjective'` so it only appears on docs that actually have IOs (no
empty-CSV trap elsewhere). Purely additive: a pure
`src/services/exporters/prtPlan.ts` (`orderedIntermediateObjectives` Kahn-sorts
then filters; `buildPrtPlanCsv` builds the rows; cycles fall back to annotation
order so nothing is dropped). No schema change. Tests in
`tests/services/prtPlan.test.ts` (dependency ordering, overcomes / depends-on
columns, owner / status / due / notes, RFC-4180 escaping, cycle safety). tsc +
biome + knip clean; full suite green.

## Session 161 — Injection Flower (Phase 3 #3)

A Phase 3 slice. A new **"Injection flower"** view gathers one injection's
Phase-2a cross-doc links into Oded Cohen's three vetting petals — **Desired
effects** (a linked FRT), **Negative branch** (a linked NBR), and **Plan** (a
linked PRT) — plus an "Other links" catch-all, so you can see at a glance whether
an injection is fully developed or still missing a side. Empty canonical petals
show a prompt ("No negative branch linked yet — ask 'what could go wrong?'…")
and the header summarises "N of 3 sides developed". Each row jumps to the linked
entity (switch tab + select) and closes.

Reached from the palette ("View the injection flower…") or a **"View the
injection flower"** button on an injection's inspector — both read-only, so they
stay available under Browse Lock. Purely additive: a pure
`src/domain/injectionFlower.ts` (`buildInjectionFlower` buckets `Entity.links` by
the linked document's diagram type), an `injectionFlowerEntityId` flag on
`dialogsSlice`, the `view-injection-flower` command (Review group), and the
`InjectionFlowerDialog`. **No schema change** — a read-only lens over the existing
links. Tests in `tests/domain/injectionFlower.test.ts` +
`tests/components/InjectionFlowerDialog.test.tsx` (+ command-guard coverage). tsc +
biome + knip clean; full suite green.

## Session 160 — Guided CLR scrutiny per edge (Phase 3 #7)

A Phase 3 slice. A new **"Scrutinize this edge"** review surface walks the eight
canonical Categories of Legitimate Reservation — **one question at a time, for a
single selected edge** — and surfaces any auto-flagged validator warnings under
the matching question. Distinct from the existing *Start CLR walkthrough* (which
steps the warnings that already fired across the whole doc): scrutiny walks
**every** category, including the ones nothing flagged, so you exercise the full
reservation discipline on the link in front of you. Reached from the palette
("Scrutinize this edge (walk the CLR questions)") or a **"Scrutinize against the
CLR"** button in the edge Inspector — the latter stays enabled under Browse Lock
since it's read-only.

Purely additive and ephemeral — **no schema change**. New
`src/domain/clrScrutiny.ts` (the static `CLR_SCRUTINY` category list, tiers
matched to the validator registry), an `edgeScrutinyId` flag + open/close on
`dialogsSlice`, the `scrutinize-edge` command (Review group), and the
`EdgeScrutinyDialog` stepper (an outer gate + an inner body remounted per edge so
its "reviewed" ticks reset). The ticks are session-only; nothing persists. Tests
in `tests/domain/clrScrutiny.test.ts` + `tests/components/EdgeScrutinyDialog.test.tsx`
(+ command-guard and inspector-button coverage). tsc + biome + knip clean; full
suite green.

## Session 159 — Extract shared EntityPickerGrid (DRY refactor)

Pure refactor, no behaviour change. The entity-card grid — a filtered,
annotation-number-sorted list of `isNonCausal`-filtered entities rendered as
type-striped cards — was duplicated (~40 lines of card JSX + the candidates/visible
filter logic) across `ImportEntityPickerDialog` and `LinkEntityPickerDialog`.
Extracted into a shared **`EntityPickerGrid`** (`src/components/import/EntityPickerGrid.tsx`)
that owns the filter input + grid; each dialog keeps its own chrome (the import
subtitle count via the exported `causalEntities` helper; the link dialog's
tab-selector) and pick action. Per-card `data-component` + aria verb are props, so
the DOM hooks + accessible names are byte-identical. tsc + biome + knip clean; full
suite (2385) green.

## Session 158 — TT per-step Need + Working Assumption (Phase 3 #8)

A second Phase 3 slice. A Transition-Tree **Action** now carries two optional
free-text fields in the inspector — **Need** ("why is this step needed?") and
**Working assumption** ("the belief that makes this action sufficient") —
completing the canonical TT triple (Action ← Need ← Working Assumption) alongside
the existing Step # input. Action-only, optional, absent on a fresh step.

Purely additive: optional `Entity.need?` + `Entity.workingAssumption?` (validated
like the other entity strings — non-string rejected, empty dropped, no migration),
two inspector TextAreas via the existing `updateEntity`. Test in
`tests/domain/ttStepFields.test.ts`. tsc + biome + knip clean; coverage green.

## Session 157 — NBR "Trim this branch" (Phase 3 #4)

First slice of Phase 3 (TP Basics smaller gaps). A new palette verb **"Trim this
branch (add a trimming injection)"** — select the undesirable effect at the tip of
a negative branch and it mints a **trimming injection** wired to that effect with a
**negative-weight** edge (the injection works against the effect), then selects it
so you can name what breaks the branch. One atomic, undoable step.

Purely additive: a new `trimBranch` action in `edgesSlice` (mints the injection +
the negative edge in one `applyDocChange`), the `trim-branch` command (Edit /
"Build" sub-section), reusing the existing `injection` type + `EdgeWeight` model —
no schema change. Test in `tests/store/trimBranch.test.ts`. tsc + biome + knip
clean; coverage green.

## Session 156 — Guided U-Shape helpers (Phase 2b) — the journey is complete

Completes the U-Shape (TP Basics #2). Building on the 2a link primitive, three
opt-in moves assemble Cohen's journey on command:

- **Mark / unmark as core problem** — an optional `Entity.coreProblem` flag (the
  U-Shape hinge), set from the palette or an inspector toggle (a rose "Core
  problem" chip). Distinct from the *computed* `findCoreDrivers` suggestion — this
  is the user's call.
- **"Create the Core Cloud from this entity…"** — spawns a new EC tab seeded as a
  Core Cloud (`cloudType:'core'`, titled after the problem), opened and
  **reciprocally linked** back to the source entity.
- **"Carry this into a new FRT…"** — spawns a new FRT tab with the selected entity
  as an injection, opened and linked back.

Each helper opens the next doc in a *new* tab (always — the point is both docs open
+ linked) and writes the reciprocal link on both sides, so you can immediately walk
CRT problem → Core Cloud → FRT injection via the "Linked to" chips.

Purely additive: optional `coreProblem?: boolean` on Entity (validated like
`collapsed`, no migration). New pure builders `src/domain/uShape.ts`
(`buildCoreCloudSeed` / `buildInjectionFRTSeed`), store actions `toggleCoreProblem`
/ `createCoreCloudFromSelection` / `carryInjectionToFRT` (the shared
`spawnLinkedFromSelection` bakes the reciprocal link + opens the tab — metadata, no
undo entry), three guarded commands, the inspector toggle, and the
`mark-core-problem` Edit sub-section entry. Tests: `uShape` (builders + coreProblem
round-trip) + store (the three helpers). tsc + biome + knip clean; coverage green.
**Phase 2 (the U-Shape) is complete.**

## Session 155 — Navigable cross-document links (U-Shape linkage, Phase 2a)

Phase 2a of the TP-completeness roadmap — the keystone of Cohen's U-Shape. The
one-way `importedFrom` snapshot is generalized into a **live, reciprocal,
clickable link** between entities in different open tabs. Select an entity →
**"Link to entity in another tab…"** (palette) → pick another tab + an entity →
both entities get the link. In the Entity Inspector a **"Linked to"** chip lists
each link; clicking it **jumps to that tab and selects the target** (the journey,
walkable in one click). A × removes the link (and its reciprocal mirror); targets
whose tab is closed render muted.

Purely additive: a new optional `Entity.links?: EntityLink[]` (`{docId, entityId}`),
strictly validated on import (malformed entries dropped, never fatal), **no schema
migration** (stays v9). The reciprocal write updates both docs in the `docs` map
and persists each; links are reference metadata, so they're deliberately **not**
pushed to undo history. The command is guarded (one entity selected + ≥2 tabs).

New: `LinkEntityPickerDialog` (mirrors the import-entity picker, but the source is
a live tab and the action *links* rather than copies), `linkSelectedEntityTo` +
`unlinkEntity` store actions, the `linkEntityPickerOpen` dialog flag, the inspector
chips, and the "Link to entity in another tab…" command. Tests: `entityLinks`
(persistence) + store (reciprocal link/unlink + command guards). tsc + biome +
knip clean; coverage green. Sets up Phase 2b (the guided "build the next step"
helpers).

## Session 154 — Cloud progression: the EC "cloud type" tag + 3 library clouds (TP Basics #1)

First slice of the TP-completeness roadmap (Cohen's *TP Basics* gap #1). An
Evaporating Cloud can now carry an optional **cloud-type** label marking its role
in the progression — Dilemma / Conflict / UDE / Consolidated / Core / Firefighting
— set from the Document panel (ⓘ) on EC docs and shown as a small sky-blue chip by
the title. Plus three ready-made **library clouds**: a **UDE cloud**, a **Core
cloud**, and a **Firefighting cloud** (original illustrative content), each
pre-tagged.

Purely additive — drawing a plain EC is unchanged; the tag is optional, unset by
default (omitted from JSON), and nothing keys off it. Mirrors the `ecVerbalStyle`
precedent: optional `cloudType` field on `TPDocument`, a `setCloudType` store
action (coalesced; drops the field on clear), soft import validation (`isCloudType`
— an unrecognized value drops to untyped), and **no schema migration** (stays
`schemaVersion 9`).

New: `src/domain/cloudType.ts` (labels + guard), `patterns/cloud-{ude,core,firefighting}.ts`;
`ec-shared.ts`'s `buildECPattern` gains an optional `cloudType`. Tests: `cloudType`
(guard + patterns + round-trip), `setCloudType` store, the DocumentInspector
dropdown. tsc + biome + knip clean; coverage green. First step of the phased plan
in NEXT_STEPS — basic tools unchanged.

## Session 153 — One-click re-save to the linked file (File System Access)

Follow-up to the Save/Open-to-file feature below: a save or open now **links** the
chosen file to the document, so **"Save to file" re-writes that same file in one
click** — no re-picking. A new **"Save to file as…"** always opens the picker (save
a copy elsewhere), and **"Open from file…"** links what it opened so subsequent
edits save straight back. A small link-chip beside the title shows the bound
filename.

Still purely additive: localStorage auto-save, the tabs, and Export/Import are
untouched, and `Cmd/Ctrl+S` still flushes to local storage exactly as before. The
file handle is persisted in a **new IndexedDB store** (`services/storage/fileHandles.ts`)
— a `FileSystemFileHandle` isn't JSON-serialisable, so localStorage can't hold it;
this is the app's only IndexedDB use, and it degrades to an in-memory map where
IndexedDB is absent (jsdom / Firefox / Safari). Re-save re-verifies write
permission (`queryPermission` / `requestPermission`); a moved or deleted file
clears the link and points the user at "Save to file as…".

New: `services/storage/fileHandles.ts`, `toolbar/useLinkedFileName.ts` + the
TitleBadge chip; `fileSystemAccess.ts` gains `ensureWritePermission` +
`writeTextToHandle` and returns the handle from save/open. Tests: `fileHandles`,
`useLinkedFileName`, expanded `fileSystemAccess` + `fileAccessCommands`. tsc +
biome + knip clean; coverage green.

## Session 153 — Save to file / Open from file (File System Access → OneDrive)

Backlog: store trees on OneDrive, cross-device. Chose the simple-file-access route
— **purely additive**, no Microsoft auth / Azure app / new dependency, and it
works in locked-down corporate tenants where a Graph/OAuth app would be blocked.
Two new "File" palette commands use the browser File System Access API:

- **"Save to file…"** writes the current document's JSON to a file you choose
  (suggested name `*.tps.json`).
- **"Open from file…"** reads a `.json` back into a new tab.

Drop the file in a synced `OneDrive\…` folder and the OneDrive client syncs it
across devices. **Nothing existing changes** — localStorage auto-save, the tabs,
and the Export/Import (download/upload) pickers behave exactly as before; the two
commands only appear on Chromium (Chrome/Edge), and elsewhere the existing
download/upload remains the path.

New `src/services/fileSystemAccess.ts` (feature-detect + save/open; AbortError →
cancel; always closes the writable) and `commands/fileAccess.ts` (the two
commands, gated by `isFileAccessSupported()` in `commands/index.ts`). Tests:
`fileSystemAccess.test.ts` (mocked picker + handle) + `fileAccessCommands.test.ts`.
tsc + biome + knip clean; full suite green.

## Session 153 — The "?" button is a real Help hub, not just shortcuts

Backlog ("review what the canvas help button should open"). The "?" (HelpCircle)
button opened only the keyboard-shortcuts dialog — but the universal "?" icon
makes people expect "how do I use this", and the User Guide + practitioner book
sat two clicks deeper in About.

The Help dialog now **leads with a "Learn TP Studio" section** linking the User
Guide + the book, then the keyboard shortcuts + gestures, then the About link.
The "?" button, the kebab entry, and the palette command are relabelled **"Help"**
(palette: "Help & keyboard shortcuts", so it's still findable by either term).

Refactor: the doc links + their `LinkRowItem` renderer moved to a shared
`components/about/docLinks.tsx` so About and Help can't drift on URLs or copy
(the security link, which carries a build-time audit label, stays local to
About). `02-your-first-canvas.md` updated to match. Tests updated; a new
`HelpDialog` test pins the Learn section + guide links.

Full suite green; tsc + biome clean.

## Session 153 — Import-generator skill: staleness guard + book reference

Two follow-ups so the `tp-studio-import` skill stays correct and discoverable:

- **Staleness guard.** `tests/skills/tpStudioImport.test.ts` now pins the skill to
  the domain model with exhaustive `Record<DiagramType | EntityType | EdgeKind,
  true>` maps. Adding a new member to any of those unions fails to COMPILE until
  it's listed here, then fails the run until `SKILL.md` / `reference/format.md`
  document it and (for diagram types) a validated example exists. A schema change
  therefore can't leave the skill stale — it surfaces as a red CI run.
- **Book reference.** Chapter 16 (*Sharing your work*) gains a "Generating a
  diagram with an AI assistant" section pointing readers at the skill and the
  Import → TP Studio JSON flow, plus a "How TP Studio helps" sidebar bullet.

Full suite green; tsc + biome clean.

## Session 153 — New: TP Studio import-file generator skill (+ NBR persistence fix)

Backlog ("create a skill that can create files for import in TP Studio in all
types of trees/maps"). Added a Claude skill at `.claude/skills/tp-studio-import/`
that turns a problem / goal / conflict described in words into an importable TP
Studio JSON document for any of the 9 diagram types (CRT, FRT, PRT, TT, EC, Goal
Tree, S&T, NBR, freeform):

- `SKILL.md` — workflow, the minimal document shape, the sufficiency-vs-necessity
  edge grammar, a per-type cheat-sheet, junctors, and the EC 5-box special case.
- `reference/format.md` — the complete field-by-field schema + every enum,
  mirroring `persistenceValidators.ts`.
- `examples/*.json` — one CI-validated template per diagram type.
- `tests/skills/tpStudioImport.test.ts` imports every example through the REAL
  `importFromJSON` and asserts a byte-stable round-trip, so the skill can never
  silently drift from the app. Generated files can be checked ad-hoc with
  `TP_VALIDATE_FILE=… node ./node_modules/vitest/vitest.mjs run tests/skills/tpStudioImport.test.ts`.

**Bug found + fixed while building it:** the `DiagramType` union has included
`'nbr'` since Session 134 (factory, palettes, type picker, and 4 patterns all
support it), but the runtime `isDiagramType` guard set never did — so a
user-created Negative Branch diagram failed `importFromJSON` and was **silently
dropped on reload / import / share-link** (data loss). Added `'nbr'` to the guard
plus an exhaustive `Record<DiagramType, true>` sync test that fails to compile (or
run) if the guard and the union ever drift again.

Full suite green; tsc + biome + knip clean.

## Session 153 — Fix: adding a duplicate edge now explains why (no silent fail)

Backlog ("I'm not able to add a new edge from #2 to #6 — why?"): dragging a
connection between two entities that were ALREADY linked silently did nothing —
`connect()` returns null on a duplicate, and both `onConnect` and the drop-on-node
`onConnectEnd` bridge discarded that result without telling the user.

`useGraphMutations` now routes both paths through a `connectOrExplain` helper: on
a confirmed duplicate (directional `hasEdge`) it shows an info toast — "Those two
are already linked in that direction." — matching the existing reconnect / co-
cause reject-toast pattern. Accidental self-loops stay quiet (no toast noise), and
an ambiguous refusal (e.g. a drop onto a non-entity node) says nothing rather than
guessing a wrong reason. The directional check means the reverse link is still
addable.

Guards: two new `useGraphMutations.test` cases (duplicate → toast; self-loop →
quiet). Full suite green; tsc + biome clean.

## Session 153 — Edge re-drag ease, source-side flow axis, roomier spacing

Three backlog polish items:

- **Sources exit on the flow axis too** — the sibling of the "enters in the
  side" fix. `selectEdgeSides` now keeps BOTH ends of a different-rank (tree
  parent/child) edge on the flow axis: the source exits AND the target enters on
  the flow direction, only cornering to a side for same-rank neighbours or to
  dodge a blocked path. Source-side assertion added to the guard test.

- **Easier edge re-drag** — two changes so re-targeting a connector is both
  discoverable AND forgiving: (1) a SELECTED edge now paints small white knobs on
  its two endpoints, advertising "grab an end and drop it on another entity"; (2)
  React Flow's `reconnectRadius` bumped 10 → 24 so the catch zone behind each knob
  is generous. The knobs are gated to genuinely reconnectable edges (real, non-
  aggregated, not junctor/mutex) and hidden under Browse Lock — a pure
  `reconnectHandlesVisible` predicate, unit-tested. (The reconnect feature itself
  shipped earlier; this is the "make it easier" follow-up the plan anticipated.)

- **Roomier vertical spacing** — `LAYOUT_RANK_SEPARATION` 60 → 80 (Dann's "the
  vertical space between entities should be higher to make it look nice"). The
  density presets still scale it ×0.75 / ×1.5 and junctor diagrams floor at 90;
  layout tests use relative assertions, so they stay green.

tsc + biome clean; full suite green.

## Session 153 — Fix: edges enter the target on the flow axis, not the side

Backlog item ("it just looks wrong that this enters in the side"): edges into a
tree parent (e.g. a Goal Tree goal) could anchor on the parent's **left/right
side** when a far-offset child made a cross-axis entry shorter than the flow-axis
(bottom) one — which reads as wrong in a vertical-flow tree.

`edgeSides.selectEdgeSides` now lets a shortness switch move the TARGET onto a
cross-axis side only when the two boxes **share a rank** (same-level neighbours,
where the cross axis is the genuine facing). For different-rank edges — the usual
tree parent/child — the receiving node stays entered on the flow axis. A blocked
preferred still dodges to any side (obstacle avoidance intact). (The source end
gets the same flow-axis treatment — see the follow-up entry above.)

Guards: two new `edgeSides.test` cases (different-rank → flow-axis entry;
same-rank → still corners) + all existing side/route tests still pass. Full
suite green; tsc + biome clean.

## Session 153 — Fix: AND/OR/XOR junctor circle no longer occluded by cause cards

The junctor circle renders ~69 px below its target node, but the layout's rank
separation (`LAYOUT_RANK_SEPARATION` = 60) didn't account for it, so on tighter
diagrams the circle drew **behind the cause cards** — the "AND doesn't render in
some instances" / "very bad AND rendering" reports from the backlog. The layout
was junctor-unaware.

Added a junctor rank floor: `EdgeRef` now carries an `isJunctor` flag (set by
both layout-input builders), and `computeLayout` floors `rankSep` to
`LAYOUT_RANK_SEPARATION_JUNCTOR_MIN` (90) whenever any junctor edge is present —
a floor on top of the fanout bonus, not an add. The circle now clears the cause
rank (verified live: **0 overlaps, ~41 px clearance** on the inventory-turns
CRT), and the extra vertical room doubles as the "more space between entities"
backlog item. (Honest note: today's earlier handle-anchor change had moved the
circle ~20 px lower, tightening this — the floor resolves it.)

Guard: `layoutJunctorSpacing.test`. Full suite green; tsc + biome clean.

## Session 153 — Backlog quick wins: inspector toggle, double-click-to-inspect, oval AND

Three small UX items from Dann's backlog review:

- **Inspector show/hide toggle** in the TopBar (the `PanelRight` button beside
  history / comments). A new `inspectorHidden` UI flag force-hides the Inspector
  panel even with a live selection, freeing canvas width; the find-panel
  re-centres when it's hidden. Verified live — the aside flips to `aria-hidden`
  on toggle.
- **Double-click an edge → open the Inspector.** `onEdgeDoubleClick` selects the
  edge and force-shows the Inspector (re-showing it if it was toggled off) — a
  reliable "inspect this connector" gesture layered on top of the finicky
  single-click select.
- **The AND / OR / XOR junctor marker is now an ellipse** (the classic TP /
  Flying-Logic connector shape) instead of a circle — `rx` 19 / `ry` 14. The
  vertical radius is unchanged, so the cause-edge terminus + arrow geometry from
  the earlier junctor fix are untouched; only the marker looks oval.

Guards: `inspectorToggle.test` (store flag) + an `onEdgeDoubleClick` case in
`useCanvasClickHandlers.test`. Full suite green; tsc + biome clean.

## Session 153 — CI: actions/cache@v4 → @v5 (drop the last Node-20 runtime)

A code audit confirmed the project targets Node 22 everywhere — `engines.node`
`>=22.22.1`, `.nvmrc` `22`, `.npmrc` `engine-strict`, the preinstall guard, all
CI `node-version: '22'`, and `@types/node@22`. The single remaining Node-20
reference was the *bundled* runtime of `actions/cache@v4` (the Playwright-browser
cache step in `ci.yml`) — the source of GitHub's "Node.js 20 actions are
deprecated" CI warning, and the lone straggler after Session 135 moved every
other action to a Node-24 major. Bumped it to `actions/cache@v5` (runtime
`node24`; the `path` / `key` / `cache-hit` interface is unchanged, so it's a
drop-in). No project code runs on Node 20.

## Session 153 — Fix: AND/OR/XOR junctor cause-edges now meet the circle

The converging cause-edges of a junctor (the labelled `AND`/`OR`/`XOR` circle)
stopped short of — or skirted around — the circle instead of meeting at its
bottom. Two compounding causes, both fixed:

- **Smart routing (the default) aimed junctor edges a node-height too high.**
  `computeEdgeRoutes` redirected the junctor terminus to `targetBox.y + offset`
  — the box *top* plus the offset — conflating React Flow's `props.targetY` (the
  *bottom* handle) with the box's top-left `y`. Fix: exclude junctor edges from
  the A\* router entirely (mirroring the existing radial exclusion) so they
  render via TPEdge's bezier, which terminates at the measured bottom handle.

- **The circle was anchored to the wrong bottom.** `JunctorOverlay` placed the
  circle at the measured box bottom, but React Flow terminates the edges at the
  bottom *handle*, which sits ~its own height (the `h-5` handle) below the box —
  a ~20px residual gap. Fix: anchor the circle to the bottom handle's actual
  `handleBounds` connection point (falling back to the box bottom before bounds
  are measured).

Result: cause-edges converge exactly on the circle's bottom perimeter (verified
end-to-end in the running app — edge terminus == circle bottom, gap 0). Guards
updated: `useEdgeRoutes.test` (junctor edges carry no route) +
`junctorOverlay.test` (handle-anchored geometry). No schema change.

## Session 153 — Pattern library: +9 canonical TOC archetypes

Filled a real gap in the curated pattern library: the Evaporating Cloud set
skewed modern software / org, so the **classic Goldratt operations & finance
clouds were missing**. Added seven ECs — cost-world-vs-throughput (the
idle-worker cloud from *The Goal*), batch-size / EBQ, inventory-vs-availability
(the distribution/retail cloud — the closest archetype to fashion retail),
project-task-safety (the Critical Chain conflict), profit spend-vs-save,
delegation, and pricing — each a ~20-line spec over the Session-152
`buildECPattern` helper. EC patterns **8 → 15**.

Also added the local-optimum tree archetype as a linked **CRT → FRT pair**:
`crt-tons-per-hour` (a single local performance measure — reward the furnace on
tons/hour — as the root cause spraying a field of UDEs: WIP pile-up, wrong mix,
inventory balloon, late orders, with an AND on the late-orders UDE) and its
counterpart `frt-schedule-adherence` (swap the measure for finishing-schedule
adherence; the cascade reverses up into desirable effects). **CRT 5 → 6, FRT
5 → 6.** Patterns are single-`TPDocument` factories, so the pair is two
independent patterns, not one cross-referenced diagram.

Skipped the proposed "resistance to change" cloud — already shipped as
`ec-efrats-change-cloud`. Registry guards (`patterns.test.ts`) + full suite
green; tsc + biome clean.

## Session 152 (follow-up) — Guard the Chapter-13 CLR map against silent loss

Hardening prompted by a near-miss: the book's hand-built "classical CLR map" —
an eight-box HTML/SVG figure generated by `scripts/lib/clrMapHtml.mjs` and
injected at the `<!-- CLR_MAP -->` placeholder of `13-the-clr.md` by both book
builders — had **no test**. A broken generator, a deleted/renamed placeholder,
or a builder-regex change would have dropped the map from the PDF + Kindle EPUB
with CI still green. Added `tests/scripts/clrMap.test.ts` locking the three
moving parts together: the figure renders all eight category cards (with
vignettes), the placeholder is still present in the chapter, and the builder's
expansion both produces the map and consumes the bare token. Also annotated the
placeholder with an editor note so it never reads as missing content in the raw
Markdown. No shipped behaviour changed; the rendered book is byte-identical.

## Session 152 — Refactor: DRY the Evaporating Cloud patterns

The seven EC pattern builders each repeated the identical 5-box cloud
boilerplate — the same positions, the same five edges, the same document
envelope — differing only in their six strings. Collapsed that into one
`buildECPattern(spec)` helper (`patterns/ec-shared.ts`): each pattern is now
~20 lines (a teaching docstring + its spec), down from ~70–110, and a new EC
pattern is just its spec. Net **−360 lines**, one source of truth for the
canonical cloud shape.

Behaviour-preserving except one deliberate **normalization**: the conflict edge
now uses the canonical `{ kind: 'necessity', isMutualExclusion: true }` form
everywhere (matches `buildExampleEC` + 3 of the patterns; 4 newer ones had
omitted the `kind`). The patterns-registry guards and the Efrat-cloud shape test
(updated to count the four *structural* necessity edges, excluding the conflict)
pass; full suite green. Next refactor target logged in NEXT_STEPS: `edgeRouting.ts`
(1150 lines) — the codebase's largest file.

## Session 151 — Opt-in Send-to-Kindle on book updates

The `Rebuild book artifacts` workflow already rebuilds the EPUB on every book
change; it now also **emails that EPUB to a Kindle** on demand. Trigger: a
`[kindle]` flag in the commit message (mirrors `[skip pdf]`), or a manual run
with the new `send_to_kindle` input ticked. Deliberately **opt-in**, not
every-push — Send-to-Kindle *adds* a personal document each time (never
replaces), so auto-sending every edit would pile up duplicates; the attachment
is date-stamped so the newest is obvious. Skips silently until the secrets are
set, so the flag is a no-op before setup.

Owner setup (one-time): an Amazon *approved sender* + repo secrets `KINDLE_TO` /
`SMTP_USER` / `SMTP_PASS` (optional `SMTP_HOST` / `SMTP_PORT`, default Gmail SSL).
Steps in [docs/KINDLE_VERIFICATION.md](docs/KINDLE_VERIFICATION.md) (Option C).
Uses `dawidd6/action-send-mail`; no app/runtime code touched.

## Session 150 — TP completeness gap analysis (parked, no code change)

Reviewed Oded Cohen's *TOC Thinking Processes — Basics* (TOCICO 2014) and mapped
it against TP Studio. Finding: the *primitives* are essentially all present
(9 diagram types, necessity/sufficiency + AND/OR/XOR junctors, the cloud mutex,
**all seven CLR categories**, the UDE/DE/injection/obstacle/IO/action
vocabulary, S&T assumption sub-types). The gaps are **workflow / meta-structure**
— chiefly the **Cloud progression** (UDE → Consolidated → Core cloud + cloud-type
taxonomy) and the **U-Shape linkage** that binds CRT → Core Cloud → FRT into one
journey. Parked in [docs/TP_BASICS_GAP_ANALYSIS.md](docs/TP_BASICS_GAP_ANALYSIS.md)
and referenced from NEXT_STEPS; nothing built.

---

Older history continues in [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md) (Sessions 149 → 1).
