# Scoping — "Validate EC against document"

**Status:** Draft for review. Session 85 prep. **Decision points marked DECIDE below.**

A placeholder in `NEXT_STEPS.md` reads:

> **Validate EC against document.** Add a CLR validation path that compares an Evaporating Cloud's structural shape against a reference description (e.g. the EC verbalisation text the user authored, or an attached source-of-truth doc). Open questions before scoping: what's "the document" — markdown? An external file reference? The EC's own verbalisation? What constitutes a mismatch — missing slot text? Edges that the verbalisation doesn't justify? Needs a 15-minute design conversation before estimating.

This doc closes the two open questions, picks a buildable shape, and sizes the work.

---

## The problem in concrete terms

A practitioner runs an EC workshop. They write up the conflict in prose first — in a workshop deck, a Notion page, an email thread — then build the EC diagram. Or vice versa: they build the EC and write up the narrative later. Either way, **the prose and the diagram can drift**. Slots get edited without the prose getting updated. Edges get added in the diagram that the prose never claimed. Assumptions get recorded that don't appear anywhere in the source-of-truth doc.

The user wants: a button that says "this diagram and this prose are in sync" or "here's what doesn't match." The CLR-rule infrastructure (warnings on entities / edges) is the natural home for the mismatches.

---

## Open question 1 — What is "the document"?

Four candidates were on the table. Ranked from "weakest" to "strongest" for the v1 build:

### Option A — The EC's own verbalisation (`verbaliseEC(doc)`)

Already exists at `src/domain/verbalisation.ts`. Generates the canonical "In order to achieve A, we must B…" prose from the diagram itself.

**Problem:** it's a *derived* artifact, not a source-of-truth. Validating the diagram against text the diagram itself produced is circular — the comparison always passes. Useful only if the user can *edit* the verbalisation away from what the diagram says, but that's not in the current product (the strip is read-only).

**Verdict:** ❌ Not the right shape on its own. Could become useful as the *target* for a "regenerate verbalisation from diagram" comparison once an editable mode lands, but that's a feature, not this feature.

### Option B — Markdown stored on the doc (`TPDocument.description`)

The doc already carries an optional `description?: string` field, rendered via `MarkdownField` in the Document Inspector. Repurpose-or-pair it: either treat the existing description as "the source-of-truth narrative," or add a sibling field `sourceOfTruthDoc?: string` so the description stays a free-text doc-level note and the source-of-truth is explicit.

**Pros:**
- No new infrastructure — just text in the existing schema.
- Round-trips through every export (JSON, HTML viewer, share-link) for free.
- Inspector UX is one new `MarkdownField` (or a tab inside the Doc Inspector).
- Reproducible — re-validate after any edit, no external file dependency.

**Cons:**
- The user has to paste the prose in. If they keep the original in Notion / a deck, the in-app copy can drift from the canonical source. (Mitigation: an inspector button "Last paste-update was N hours ago" or just a manual refresh.)

**Verdict:** ✅ Strongest for v1. Cheap to ship, integrates with existing inspector + persistence patterns.

### Option C — External file reference (`sourceOfTruthPath?: string`)

Store a file:// or relative path to a markdown / docx / pdf on disk; re-read on demand.

**Cons:**
- Browser security: TP Studio runs in a sandbox. Reading arbitrary local files requires either the File System Access API (Chrome/Edge only, requires user-grant each session) or asking the user to re-pick the file each time.
- Share-link mode breaks immediately — the receiver doesn't have the file.
- PDF / docx parsing adds large deps (`pdf-parse`, `mammoth`) for marginal benefit.

**Verdict:** ❌ Right ergonomics but wrong cost. Park behind FL-EX8 (multi-doc workspace) where the workspace owns the file pipeline anyway.

### Option D — Live remote URL

Same as C but worse — CORS, opacity of changes upstream, network dependency.

**Verdict:** ❌ Not worth the complexity for this feature alone.

### **DECIDE: Pick Option B.** Source-of-truth is **a markdown field on `TPDocument`**.

Spec'd below assuming this choice. If Dann wants a different one, the rest of this doc adjusts but the implementation shape stays the same.

**Sub-decision: name the field.**
- `description` already exists and is rendered in the Doc Inspector — repurpose it.
- Adding `sourceOfTruthDoc?: string` alongside `description?: string` is cleaner separation.

Recommendation: **new field `sourceOfTruthDoc?: string`**. Avoids overloading `description`; the two are semantically different (`description` is a note *about* the diagram, `sourceOfTruthDoc` is the diagram's external referent). Adds one line to the schema and a v7→v8 migration that defaults to undefined.

---

## Open question 2 — What constitutes a mismatch?

A mismatch is something the rule reports as a warning. The rule's job is to find them; let's enumerate the categories.

### Tier 1 — Slot text mentions

**Check:** Every non-empty EC slot title (A / B / C / D / D′) should appear in the source-of-truth text. (Case-insensitive, word-boundary, allow morphological variants — strip plurals + common suffixes before matching.)

**Fires when:** A slot title is `"Reduce customer churn"` and the doc never says "churn." Likely the diagram was edited away from the prose, or the prose is incomplete.

**Warning:** on the slot entity. `"This slot's text doesn't appear in the source-of-truth document — has the prose drifted?"`

### Tier 2 — Conflict claim

**Check:** The source-of-truth text should make the conflict between D and D′ explicit. We can't parse natural-language conflicts cheaply, but we can check that **both D and D′ titles appear within a window of N characters of each other**, AND **a conflict-cue word** (`"but"`, `"conflict"`, `"however"`, `"versus"`, `"can't both"`, `"cannot coexist"`) appears in the same window.

**Fires when:** D and D′ are both mentioned but never in the same paragraph, or never with a conflict cue. Likely the prose names both options but doesn't frame them as a forced choice.

**Warning:** on the D↔D′ edge (or on the EC doc as a whole if the mutex edge doesn't exist yet). `"The source-of-truth document mentions D and D′ but doesn't seem to frame them as a conflict — is the cloud the right diagnostic here?"`

### Tier 3 — Recorded assumptions appear in the prose

**Check:** For each assumption record on each of the five canonical arrows, the assumption text should overlap meaningfully with the source-of-truth (similarity score above a threshold, reusing the existing `similarity()` helper in `src/domain/validators/shared.ts` that the tautology rule uses).

**Fires when:** An assumption reads `"Customers won't churn if we apologize"` and nothing in the source-of-truth supports that claim. Likely the assumption was speculative; the source doesn't justify it.

**Warning:** on the assumption record. `"This assumption isn't grounded in the source-of-truth document — capture supporting prose, or flag the assumption as 'challengeable'."`

### Tier 4 — Coverage (reverse direction)

**Check:** Does the source-of-truth document contain *claims* that the diagram doesn't represent? This is the hardest check — it requires extracting candidate claims from prose, which means either an LLM call (out of scope for v1) or a heuristic (sentence-tokenize, look for sentences that contain causal-cue words like "because", "therefore", "in order to", and report sentences not represented by any edge in the diagram).

**Fires when:** The prose says "we also need leadership buy-in" but no entity or edge in the diagram captures that.

**Warning:** on the doc as a whole, with the sentence quoted. `"This sentence from the source-of-truth isn't represented in the diagram: ..."`

**Verdict:** Tier 4 is the most expensive and the most error-prone (false-positive heavy on heuristic extraction). **DECIDE: Ship Tiers 1-3 in v1, park Tier 4** behind an explicit "Find missing claims" button rather than baking it into every validation pass. The heuristic version is cheap to write but spammy; gate it behind user intent.

---

## Recommended scope for v1

| # | Item | Effort | Notes |
|---|------|--------|-------|
| 1 | Schema bump v7 → v8: add `TPDocument.sourceOfTruthDoc?: string` | S | One field, one migration step |
| 2 | Doc Inspector: new "Source-of-truth document" `MarkdownField` (EC-only) | S | Existing `MarkdownField` component; gate render on `diagramType === 'ec'` |
| 3 | New validator `src/domain/validators/ecSourceOfTruth.ts` implementing Tiers 1-3 | M | Pure function `(doc) => Warning[]`; register in `RULES_BY_DIAGRAM.ec` |
| 4 | Tier `clarity` for the rule (warnings are soft "the prose and diagram have drifted" nudges, not structural defects) | trivial | Pick tier at registration time |
| 5 | Tests: hand-fixture per tier + a property test that empty-source-of-truth produces zero warnings | M | Mirror `tests/domain/validators.test.ts` patterns |
| 6 | Inspector tab integration: the EC inspector's three-tab structure (Inspector / Verbalisation / Injections) grows a fourth tab "Source check" that surfaces *only* this rule's warnings | S | Optional polish — the warnings already appear in the WarningsList |
| 7 | Update `USER_GUIDE.md` and `CHANGELOG.md` | S | Standing rule from memory |

**Total: ~M-L.** One day of focused work, including tests and docs.

### What it does NOT do (explicit anti-scope)

- Does not extract claims from prose (Tier 4 above). Parked behind a future "Find missing claims" button.
- Does not connect to external files / URLs.
- Does not auto-update the source-of-truth from the diagram or vice versa.
- Does not run on every keystroke — gates behind the existing `validationFingerprint` so title edits trigger re-check, but inspector text edits don't (the `sourceOfTruthDoc` field is excluded from the fingerprint, matching how `description` is excluded today).
- Does not apply to non-EC diagrams. Could generalize later (CRT against a problem-statement doc, FRT against a future-state doc), but each diagram type has different prose conventions and the EC case is the concrete one driving this work.

---

## Implementation sketch

### Schema migration

```ts
// src/domain/migrations.ts — v7 → v8
const migrateV7toV8: Migration = (doc) => ({
  ...doc,
  // sourceOfTruthDoc is optional — undefined is the common case
  schemaVersion: 8,
});
```

### Validator skeleton

```ts
// src/domain/validators/ecSourceOfTruth.ts
import type { TPDocument } from '../types';
import { type UntieredWarning, makeWarning, similarity } from './shared';

const CONFLICT_CUES = ['but', 'however', 'conflict', 'versus', "can't both", 'cannot coexist'];

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = (s: string) => stripDiacritics(s.toLowerCase()).split(/\W+/).filter(Boolean);
const mentions = (haystack: string, needle: string) => {
  if (!needle.trim()) return true; // empty slot — no claim to check
  const h = tokens(haystack);
  const n = tokens(needle);
  // All tokens of needle appear in haystack (order-insensitive).
  return n.every(t => h.includes(t));
};

export const ecSourceOfTruthRule = (doc: TPDocument): UntieredWarning[] => {
  if (doc.diagramType !== 'ec') return [];
  const src = doc.sourceOfTruthDoc?.trim() ?? '';
  if (!src) return []; // no source-of-truth set → nothing to check

  const out: UntieredWarning[] = [];
  // Tier 1: slot mentions
  // Tier 2: conflict claim (D + D' + cue within a window)
  // Tier 3: assumptions appear (similarity ≥ 0.4 against the source)
  return out;
};
```

### Registration

```ts
// src/domain/validators/index.ts (Sessions 85's per-doc memoization stays)
ec: [
  ...STRUCTURAL_RULES,
  tieredRule('existence', 'ec-missing-conflict', ecMissingConflictRule),
  tieredRule('existence', 'ec-completeness', ecCompletenessRule),
  tieredRule('clarity', 'ec-source-of-truth', ecSourceOfTruthRule), // ← new
],
```

### UI surface

- Doc Inspector grows a "Source-of-truth document" section (EC-only) with a `MarkdownField`, placed after Description.
- WarningsList already surfaces every rule's output — no inspector-side changes needed for v1.
- Future polish: a fourth EC inspector tab "Source check" that filters to just this rule's warnings + offers one-click actions (e.g. "Mark slot text as updated", "Quote this sentence into an assumption").

---

## Test plan

Mirroring the patterns in `tests/domain/validators.test.ts`:

1. **Empty source-of-truth → zero warnings.** Baseline.
2. **Filled source-of-truth mentioning every slot → zero warnings.** Happy path.
3. **Slot title missing from prose → one warning on that slot.**
4. **D / D′ in prose but no conflict cue → one warning on the D↔D′ edge.**
5. **Assumption recorded that doesn't appear in prose → one warning on the assumption.**
6. **Non-EC diagram with a `sourceOfTruthDoc` set → zero warnings** (rule short-circuits on `diagramType !== 'ec'`).
7. **Property test (fast-check):** generate arbitrary `sourceOfTruthDoc` strings and arbitrary EC docs; rule never throws; output is well-formed `Warning[]`. (Reuses the docArb pattern from `tests/domain/validatorsProperty.test.ts`.)

---

## Questions that need a Dann answer before I build

1. **Confirm Option B (markdown field on doc, new `sourceOfTruthDoc` rather than reusing `description`).** Or switch to one of the alternatives.
2. **Confirm Tiers 1-3 in scope, Tier 4 parked.** Specifically: is the "Find missing claims" button worth a follow-up entry in the backlog, or is that one a "won't build" too?
3. **Token-matching strictness for Tier 1.** All-tokens-of-needle-appear is the cheapest; we could add stemming or fuzzy match if false-positives are an issue. Start cheap and iterate?
4. **Threshold for Tier 3 assumption-grounding similarity.** Reusing `similarity()` (Levenshtein-normalized) — a threshold of 0.4 catches "loose paraphrase" while rejecting unrelated text. Tune by example after the rule lands.
5. **Should the rule run on every doc, or be opt-in per doc?** A doc-level setting "Check against source-of-truth" with default false would prevent the rule from firing on EC docs that don't have a source-of-truth narrative yet. Recommendation: gate purely on `sourceOfTruthDoc` being non-empty (already does that). Simpler, no new toggle.

---

## Effort estimate

- Schema + migration: 30 min
- Validator + tests: 2-3 hours
- Inspector field + integration: 30 min
- USER_GUIDE.md + CHANGELOG.md: 30 min
- Push + CI watch: 15 min

**Total: ~4 hours focused work**, ships in one session. Fits the "demo-able vertical slice" discipline.

---

## Recommended next step

1. Dann reviews this doc, answers the 5 questions above.
2. Open a session, implement against the answers.
3. Ship as a single commit per Session-85 conventions (`feat: EC source-of-truth check` or similar).
4. Remove the placeholder from `NEXT_STEPS.md`; replace with a "✅ Done (Session NN)" line.

If Dann wants a different shape (e.g. external file or no markdown field at all), this doc is the design diff to discuss against, not the final commit.
