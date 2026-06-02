---
name: tp-studio-import
description: Generate importable TP Studio document files (JSON) for any Theory of Constraints Thinking Process diagram — Current Reality Tree (CRT), Future Reality Tree (FRT), Prerequisite Tree (PRT), Transition Tree (TT), Evaporating Cloud (EC), Goal Tree, Strategy & Tactics (S&T), Negative Branch (NBR), or freeform. Use whenever someone wants to turn a problem, goal, conflict, root-cause analysis, or action plan described in words into a TP Studio diagram they can open and import.
---

# TP Studio import-file generator

TP Studio is a free, local-first browser app for Theory of Constraints (TOC)
Thinking Process diagrams. It imports a **single JSON document**. This skill
turns a description ("here's my problem / goal / conflict") into a valid TP
Studio `.json` file the user can import.

**How the user loads your file:** in TP Studio, open the command palette and run
**"Import from JSON"** (or File / Import → TP Studio JSON), then pick the file.

## The document shape (minimal)

Emit exactly this object, as a `.json` file. Only these fields are needed; the
app fills in everything else and lays the diagram out automatically.

```json
{
  "schemaVersion": 9,
  "id": "my-doc",
  "diagramType": "crt",
  "title": "A short human title",
  "nextAnnotationNumber": <maxAnnotationNumber + 1>,
  "entities": { "<id>": { ...entity }, ... },
  "edges":    { "<id>": { ...edge }, ... }
}
```

- `schemaVersion` **must be `9`**.
- `id` and all entity/edge ids are **any unique strings** — use readable ones
  (`"rc1"`, `"goal"`, `"e1"`). The app does not re-key on import.
- `entities` / `edges` are **maps keyed by id** (not arrays). The key must equal
  the object's own `id`.
- `groups` and `resolvedWarnings` default to `{}` and may be omitted.
- `createdAt` / `updatedAt` are optional at the document level (the app stamps
  them on import).

### Entity — required fields

```json
{ "id": "rc1", "type": "rootCause", "title": "Setup has 12 manual steps",
  "annotationNumber": 3, "createdAt": 1735689600000, "updatedAt": 1735689600000 }
```

`id`, `type`, `title`, `annotationNumber`, `createdAt`, `updatedAt` are **all
required** (the three numbers must be finite — use a fixed epoch like
`1735689600000` for created/updated). `annotationNumber` is a per-document
integer; number entities `1, 2, 3, …` and set the document's
`nextAnnotationNumber` to the highest + 1.

### Edge — required fields

```json
{ "id": "e1", "sourceId": "rc1", "targetId": "eff", "kind": "sufficiency" }
```

Only `id`, `sourceId`, `targetId`, `kind` are required. **`sourceId` is the
cause / lower node; `targetId` is the effect / higher node** — edges point in
the direction of logical flow (cause → effect, prerequisite → goal).

## Edge grammar: `kind` is the most important choice

Every edge is one of two kinds. Pick by the diagram's logic:

- **`"sufficiency"`** — "X is enough to cause Y" / "X leads to Y". Read upward:
  causes at the bottom drive effects at the top. Used by **CRT, FRT, PRT, TT,
  S&T, NBR, freeform**.
- **`"necessity"`** — "in order to have Y, you must have X". Used by **EC and
  Goal Tree** (the "in order to… we must…" diagrams).

When several causes are **jointly** required to produce one effect (all of them,
not any one), give those edges a shared **AND junctor**: add the same
`"andGroupId": "and-<target>"` to each. (`orGroupId` / `xorGroupId` work the same
way for "any of" / "exactly one of".)

## Per-diagram-type cheat-sheet

| `diagramType` | Diagram | Apex (top) | Entity `type`s to use | Edge `kind` |
|---|---|---|---|---|
| `crt` | Current Reality Tree | a `ude` | `rootCause`, `effect`, `ude` | `sufficiency` |
| `frt` | Future Reality Tree | a `desiredEffect` | `injection`, `effect`, `desiredEffect` | `sufficiency` |
| `prt` | Prerequisite Tree | a `goal` | `goal`, `obstacle`, `intermediateObjective` | `sufficiency` |
| `tt` | Transition Tree | a `desiredEffect` | `action` (+ `ordering`), `effect`, `desiredEffect` | `sufficiency` |
| `ec` | Evaporating Cloud | a `goal` (left) | `goal`, `need`, `want` | `necessity` |
| `goalTree` | Goal Tree | a `goal` | `goal`, `criticalSuccessFactor`, `necessaryCondition` | `necessity` |
| `st` | Strategy & Tactics | a `goal` | `goal`, `injection` (tactic), `necessaryCondition` | `sufficiency` |
| `nbr` | Negative Branch | a `ude` | `injection`, `effect`, `ude`, `desiredEffect` | `sufficiency` |
| `freeform` | Freeform map | none | `effect`, `note`, any built-in type | `sufficiency` |

`note` is valid in every diagram (a free-floating annotation; it can have no
edges). Full type list + every optional field is in `reference/format.md`.

### Structural notes

- **CRT / NBR**: root causes / injections at the bottom flow up through effects
  to the top UDE. NBR shows how a proposed `injection` leads to a bad `ude`.
- **FRT**: an `injection` flows up through effects to the `desiredEffect`.
- **PRT**: `intermediateObjective` → `obstacle` → `goal` (an IO overcomes the
  obstacle above it; the cleared obstacle unblocks the goal). All sufficiency.
- **TT**: `action` entities carry `"ordering": 1, 2, 3…` for step badges; each
  step's incoming edges usually share an `andGroupId` (the prior state AND the
  new action together produce the next state).
- **Goal Tree**: `necessaryCondition` → `criticalSuccessFactor` → `goal`, all
  `necessity`.
- **Evaporating Cloud**: see below — it has a fixed 5-box shape.

### Evaporating Cloud is special

An EC is exactly **5 boxes** with manual positions, an `ecSlot` on each, and a
**mutual-exclusion** edge between the two wants:

- `goal` with `"ecSlot": "a"` at `{x:100,y:250}` (left)
- two `need`s, `"ecSlot": "b"` at `{x:450,y:100}` and `"c"` at `{x:450,y:400}`
- two `want`s, `"ecSlot": "d"` at `{x:800,y:100}` and `"dPrime"` at `{x:800,y:400}`
- edges (all `necessity`): `d → b`, `dPrime → c`, `b → a`, `c → a`, and
  `d → dPrime` with `"isMutualExclusion": true` (the conflict arrow).
- `nextAnnotationNumber` is `6`.

Copy `examples/ec.json` and re-word the five titles — don't hand-build the
geometry.

## Workflow

1. **Pick the `diagramType`** from the cheat-sheet that matches the user's intent
   (problem to diagnose → `crt`; conflict → `ec`; plan → `tt`; etc.).
2. **List the entities.** Give each a `type` from that row, a `title`, a
   sequential `annotationNumber`, and the fixed `createdAt`/`updatedAt`.
3. **Connect them with edges** in the flow direction (cause/prereq →
   effect/goal), all using that row's `kind`. Add `andGroupId` where causes are
   jointly required.
4. **Start from the closest example** in `examples/` and adapt it — they are all
   CI-validated against the real importer.
5. **Validate** before handing it over (next section).
6. Hand the user the `.json` and tell them: command palette → **Import from JSON**.

## Validate the file before delivering

The repo ships the real validator behind a test. To check a file you generated:

```bash
TP_VALIDATE_FILE=path/to/your-file.json \
  node ./node_modules/vitest/vitest.mjs run tests/skills/tpStudioImport.test.ts
```

A pass means the file imports cleanly. On failure the error is field-precise,
e.g. `Invalid document: edges["e1"] has invalid kind "causes"` or
`entities["x"] has non-finite annotationNumber`. Fix and re-run. (If you can't
run the test, eyeball against `reference/format.md` — every required field, every
valid enum value, and every gotcha is listed there.)

## Common mistakes

- Using an array for `entities`/`edges` — they are **maps keyed by id**.
- Wrong `kind` — Goal Tree / EC are `necessity`; everything else `sufficiency`.
- Omitting `createdAt`/`updatedAt` on an entity (required) — only the *document*
  level may omit them.
- `annotationNumber` not finite, or `nextAnnotationNumber` ≤ the max used.
- Inventing an entity `type` or `diagramType` — only the values in the cheat-sheet
  / `reference/format.md` are accepted; anything else is rejected on import.
- Edge `sourceId`/`targetId` pointing at an id that isn't in `entities`.

## Files

- `examples/*.json` — one validated template per diagram type. **Start here.**
- `reference/format.md` — the complete field-by-field schema and every enum.
