# 0003. The CLR list is eight categories (Dettmer's), not the Handbook's seven

- **Status**: Accepted
- **Date**: 2026-07-16
- **Session**: 199 (shipped) / 206 (recorded here — see CHANGELOG)
- **Tags**: `clr validators doctrine handbook tautology`

## Context

TP Studio's Categories of Legitimate Reservation are modelled on **Dettmer's** teaching layout: eight
categories, with *Predicted Effect* and *Tautology* as his additions to Goldratt's original six
(`docs/guide/13-the-clr.md`).

The *Theory of Constraints Handbook* (Cox & Schleier, McGraw-Hill 2010) — the source we mined for the
whole §§A–H backlog program in Sessions 196–199 — presents a **different canon: 7 categories in 3 ordered
levels**, and it **omits `tautology` entirely**.

So the tool disagrees with the book it was most recently audited against. That is not an oversight, but
it *looks* exactly like one, and the mismatch is discoverable by anyone reading the Handbook next to the
`ClrRuleId` union.

This matters because the project repeatedly runs multi-agent source-mining and adversarial passes (the
Handbook itself was mined by a six-agent read; Sessions 205/206 ran 8-finder / 8-lens hunts). A future
pass comparing our list to the Handbook's canon will surface "we have an extra rule the source doesn't"
and read it as drift to be corrected.

## Decision

**Keep the eighth category. `tautology` stays.** Our list follows Dettmer, not the Handbook, and the
divergence is deliberate. A Handbook-driven review finding the mismatch should treat it as *already
settled* and change nothing.

This is a doctrine choice, not a bug: the Handbook's 7-in-3-levels canon and Dettmer's 8 are two
legitimate presentations of the same underlying method, and we teach Dettmer's.

## Alternatives considered

- **Conform to the Handbook's 7-in-3-levels canon (drop `tautology`)** — genuinely defensible, and the
  reason this keeps coming back: the Handbook is a primary, recent, authoritative source, and we
  explicitly mined it to correct other parts of the model (the S&T directional model in §B was corrected
  against Ch34 in exactly that spirit). But `tautology` is load-bearing in the tool — it catches circular
  reasoning where a stated cause is intangible and only its consequences are observable. Dropping it would
  remove a shipped validator, invalidate its persisted `resolvedWarnings`, and cost users a real check to
  gain nothing but conformance to one book's presentation.
- **Support both lists behind a mode** — a "Handbook canon / Dettmer canon" toggle. Rejected: it doubles
  the doctrine surface, and the two lists aren't in conflict about *reasoning*, only about presentation
  and count. Nobody has asked to read the tool's warnings as the Handbook's 3 levels.
- **Reorder ours into the Handbook's 3 ordered levels while keeping 8** — the tiering already exists in
  the Logic-check panel (Clarity → Existence → Sufficiency, see the S199 A4 Focus mode), so this would be
  cosmetic re-labelling of a structure that already matches in spirit.

## Consequences

- Our CLR count will keep failing a naive "does the tool match the source?" check. That's expected. This
  ADR is the answer; don't re-derive it.
- Any future source-mining pass over a TOC text should compare **reasoning**, not **counts**, before
  proposing a category be added or removed.
- If `tautology` ever *is* removed, it's a breaking doctrine change: it invalidates persisted
  `resolvedWarnings` keyed on that rule id and changes what existing diagrams report. That cost is a
  reason to leave it alone, not a reason to rush.
- `docs/guide/13-the-clr.md` records the Dettmer attribution but **not** this conflict with the Handbook —
  which is why this ADR exists rather than a guide sentence.

## References

- `src/domain/types/clr.ts` — the `ClrRuleId` union; `'tautology'` at the end of Dettmer's eight.
- `src/domain/validators/tautology.ts` — the validator itself; registered in `validators/index.ts`.
- `docs/guide/13-the-clr.md` — "Goldratt's original six are the first six boxes; *Predicted Effect* and
  *Tautology* are Dettmer's additions."
- `CHANGELOG.md` Session 199 — "CLR sharpening (backlog A1)", where this guard was recorded before moving
  here.
- Source of the conflicting canon: *Theory of Constraints Handbook*, Ch. 25 App. B (Scheinkopf).
