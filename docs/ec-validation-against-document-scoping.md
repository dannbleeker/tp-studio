# Scoping — "Validate EC against document"

**Status:** Draft spec for implementation.

## The problem in concrete terms

A practitioner runs an EC workshop. They write up the conflict in prose first — in a workshop deck, a Notion page, an email thread — then build the EC diagram. Or vice versa: they build the EC and write up the narrative later. Either way, **the prose and the diagram can drift**. Slots get edited without the prose getting updated. Edges get added in the diagram that the prose never claimed. Assumptions get recorded that don't appear anywhere in the source-of-truth doc.

The user wants: a button that says "this diagram and this prose are in sync" or "here's what doesn't match." The CLR-rule infrastructure (warnings on entities / edges) is the natural home for the mismatches.

## Approach

- **Source-of-truth = a new markdown field on `TPDocument`** (`sourceOfTruthDoc?: string`). Kept separate from the existing `description` field so the two semantics don't overload. Edited via a new `MarkdownField` in the Document Inspector (EC-only).
- **Mismatch checks** = three tiers, all surfaced as `clarity`-tier CLR warnings:
  - **Tier 1 — Slot mentions.** Each non-empty slot title (A / B / C / D / D′) should appear in the source-of-truth. All tokens of the title must appear in the prose (order-insensitive, case-insensitive). Warning fires on the slot entity.
  - **Tier 2 — Conflict claim.** Both D and D′ titles should appear within a window of the source-of-truth alongside a conflict-cue word (`but`, `however`, `conflict`, `versus`, `can't both`, `cannot coexist`). Warning fires on the D↔D′ edge (or the doc if the mutex edge doesn't exist yet).
  - **Tier 3 — Assumption grounding.** For each recorded assumption, the text should overlap with the source-of-truth above a similarity threshold (~0.4 via the existing `similarity()` helper in `validators/shared.ts`). Warning fires on the assumption record.
- **Out of scope for v1**: reverse-direction coverage (extracting claims from prose and flagging ones the diagram doesn't represent). Heuristic version is spammy; LLM version is out of scope. Park behind an explicit future "Find missing claims" button.

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

## Effort estimate

- Schema + migration: 30 min
- Validator + tests: 2-3 hours
- Inspector field + integration: 30 min
- USER_GUIDE.md + CHANGELOG.md: 30 min
- Push + CI watch: 15 min

**Total: ~4 hours focused work**, ships in one session. Fits the "demo-able vertical slice" discipline.

---

## Recommended next step

1. Open a session, implement against the spec above.
2. Ship as a single commit per Session-85 conventions (`feat: EC source-of-truth check` or similar).
3. Remove the placeholder from `NEXT_STEPS.md`; replace with a "✅ Done (Session NN)" line.
