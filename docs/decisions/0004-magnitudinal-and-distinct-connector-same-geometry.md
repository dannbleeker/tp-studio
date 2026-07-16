# 0004. Magnitudinal AND is a distinct connector, not a distinct geometry

- **Status**: Accepted
- **Date**: 2026-07-16
- **Session**: 199 (shipped) / 206 (recorded here — see CHANGELOG)
- **Tags**: `canvas edges exporters canvas-equals-export and-groups clr`

## Context

An AND group can mean two different things, and the Handbook's CLR appendix treats them as opposite
questions (Ch25 App. B):

- **Conceptual** (the default banana) — the causes are *jointly required*; remove any one and the effect
  breaks. This is the *cause-insufficiency* reservation.
- **Magnitudinal** (`andMode: 'additional'`) — the causes each *contribute independently* and each is
  removable. This is the *additional-cause* reservation.

Session 199 (backlog A3) shipped the distinction. The open question was how to *draw* it, and there was a
mockup on the table that rendered magnitudinal co-causes as **independent arrows** — visually separating
what is logically separate.

## Decision

**Flavour the connector, keep the geometry identical.** A magnitudinal AND draws as a **dashed AND⁺
ring**; a conceptual AND stays a solid ring. Endpoints, routing and layout are byte-for-byte what they
were. Stored as an optional edge field emitted only when magnitudinal, so untouched diagrams round-trip
identical.

This was **Dann's call** (Session 199), taken over the independent-arrows mockup.

## Alternatives considered

- **Independent arrows for magnitudinal co-causes** (the rejected mockup) — genuinely defensible, and the
  reason this keeps coming back: it's arguably the more *honest* rendering. Independent contributions
  drawn as one joined connector look like they're joined, which is the very thing the flavour denies. On
  visual-semantics grounds it's the better diagram.

  Rejected because it changes **geometry**, and geometry is load-bearing here. TP Studio holds a
  **canvas==export invariant**: the five text/graph exporters and the canvas must agree. A rendering that
  splits one connector into N arrows changes endpoint math on the canvas but has no counterpart in the
  text exporters (which describe an AND group as an AND group either way) — so the invariant would break,
  or every exporter would need a parallel notion of "split" arrows. The distinction is a *canvas /
  teaching aid*, and it isn't worth spending the invariant on.
- **A badge or label instead of a connector style** — considered as the cheap option; loses at a glance
  what the ring communicates structurally, and adds label clutter to exactly the dense fan-in areas where
  AND groups live.

## Consequences

- The magnitudinal/conceptual distinction is **visible on the canvas only**. The text exporters describe
  both as an AND group by design; do not "fix" that.
- The canvas==export invariant survived this feature untouched, and any future proposal to re-render AND
  groups must clear the same bar. If someone re-proposes independent arrows, the question to answer first
  is: *what do the five exporters emit, and does the invariant still hold?*
- Geometry-sameness is a **decision**, not an implementation convenience. Reading the code alone, a dashed
  ring looks like the lazy option — it wasn't.

## References

- `src/domain/types/edge.ts` — `andMode?: 'additional'` (optional; emitted only when magnitudinal).
- `CHANGELOG.md` Session 199 — "Two AND connectors (backlog A3)", where this call was recorded before
  moving here.
- *Theory of Constraints Handbook* Ch. 25 App. B (Scheinkopf) — the two reservations this distinction
  encodes.
- Related: the canvas==export invariant, exercised across the five exporters.
