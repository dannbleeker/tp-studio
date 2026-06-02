# TP Studio document format — complete reference

The authoritative shape is the validator in
`src/domain/persistenceValidators.ts` and `importFromJSON` in
`src/domain/persistence.ts`. This file mirrors them. Import is **fail-fast**:
the first invalid field throws a precise error and nothing loads.

General rules:
- Document is one JSON object. `schemaVersion` **must be `9`**.
- All ids are arbitrary non-empty strings, **unique within their own map**. Not
  re-keyed on import. A map key must equal its value's `id`.
- "Required" = throws if missing or wrong type. "Optional" = omit when unset;
  present-but-wrong-type throws.
- Numbers marked *finite* reject `NaN` / `Infinity`.
- Reserved keys `__proto__`, `constructor`, `prototype` are rejected as map keys.
- Unknown fields are ignored (dropped on the round-trip), so extra metadata is
  harmless but pointless.

## TPDocument (top level)

| Field | Type | Req? | Notes |
|---|---|---|---|
| `schemaVersion` | `9` | **yes** | Exactly `9`. |
| `id` | string | **yes** | Document id. |
| `diagramType` | DiagramType | **yes** | See enum below. |
| `entities` | map\<id, Entity\> | **yes** | May be `{}`. |
| `edges` | map\<id, Edge\> | **yes** | May be `{}`. |
| `nextAnnotationNumber` | number | **yes** | One past the highest `annotationNumber` used. |
| `title` | string | no | Defaults to `"Untitled"`. |
| `groups` | map\<id, Group\> | no | Defaults `{}`. |
| `resolvedWarnings` | map\<string, true\> | no | CLR-warning suppression. Defaults `{}`. |
| `createdAt` / `updatedAt` | number | no | Stamped on import if absent. |
| `author` / `description` | string | no | Free metadata. |
| `assumptions` | map\<id, Assumption\> | no | First-class assumption records. |
| `comments` | map\<id, Comment\> | no | Review comments. |
| `layoutConfig` | object | no | `{ direction?: 'BT'|'TB'|'LR'|'RL', nodesep?: >0, ranksep?: >0, align?: 'UL'|'UR'|'DL'|'DR' }`. Soft-validated. |
| `customEntityClasses` | map | no | User-defined entity types (advanced). |
| `ecVerbalStyle` | `'neutral'`\|`'twoSided'` | no | EC wording toggle. |

You almost never need anything past the first six rows + `title`.

## DiagramType (enum — exact strings)

`crt`, `frt`, `prt`, `tt`, `ec`, `goalTree`, `st`, `freeform`, `nbr`

## Entity

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | string | **yes** | |
| `type` | EntityType | **yes** | See enum below. |
| `title` | string | **yes** | The node's text. |
| `annotationNumber` | finite number | **yes** | Per-doc integer, 1-based. |
| `createdAt` | finite number | **yes** | Unix ms (any fixed value is fine). |
| `updatedAt` | finite number | **yes** | Unix ms. |
| `description` | string | no | Markdown long-form. |
| `position` | `{x:number, y:number}` | no | Manual coords. Only EC needs them; trees auto-layout. |
| `ordering` | finite number | no | TT step number (renders a badge). |
| `ecSlot` | `'a'`\|`'b'`\|`'c'`\|`'d'`\|`'dPrime'` | no | EC slot binding. |
| `state` | `'true'`\|`'false'`\|`'unknown'`\|`'disputed'` | no | Entity truth state. |
| `titleSize` | `'sm'`\|`'md'`\|`'lg'` | no | |
| `collapsed` | boolean | no | Hide downstream. |
| `spanOfControl` | `'control'`\|`'influence'`\|`'external'` | no | |
| `owner` / `attestation` | string | no | Accountability / provenance. |
| `evidence` | EvidenceItem[] | no | Structured evidence (advanced). |
| `attributes` | map\<string, AttrValue\> | no | Typed key/values (advanced). |

### EntityType (enum — exact strings)

`ude`, `effect`, `rootCause`, `injection`, `desiredEffect`, `assumption`,
`goal`, `criticalSuccessFactor`, `necessaryCondition`, `obstacle`,
`intermediateObjective`, `action`, `need`, `want`, `note`

Use the subset appropriate to the diagram (see the cheat-sheet in `SKILL.md`).
`note` works everywhere. `assumption` entities are legacy — prefer attaching
assumptions to edges (see Assumption below) rather than as nodes.

## Edge

| Field | Type | Req? | Notes |
|---|---|---|---|
| `id` | string | **yes** | |
| `sourceId` | string | **yes** | Cause / prerequisite / lower node. Must exist in `entities`. |
| `targetId` | string | **yes** | Effect / goal / higher node. Must exist in `entities`. |
| `kind` | `'sufficiency'`\|`'necessity'` | **yes** | See `SKILL.md` — `necessity` for EC + Goal Tree, `sufficiency` otherwise. |
| `andGroupId` | string | no | Join sibling edges into an AND junctor (all causes jointly required). |
| `orGroupId` | string | no | OR junctor (any one cause). |
| `xorGroupId` | string | no | XOR junctor (exactly one). |
| `weight` | `'positive'`\|`'negative'`\|`'zero'` | no | `negative` = this cause *reduces* the effect. Default positive. |
| `label` | string | no | Inline edge label (≤30 chars reads best). |
| `description` | string | no | Markdown annotation. |
| `isBackEdge` | boolean | no | Marks a deliberate loop-closer. |
| `isMutualExclusion` | boolean | no | The EC `d ↔ dPrime` conflict arrow. |
| `assumptionIds` | string[] | no | Ids of Assumption records backing this edge. |

A single edge may belong to **at most one** of `andGroupId` / `orGroupId` /
`xorGroupId`. If more than one is set, import keeps AND > OR > XOR and drops the
rest. The junctor id is just a shared string — all edges converging on the same
target with the same `andGroupId` render as one AND junction.

## Group (optional — visual grouping)

`{ id, title, color, memberIds: string[], collapsed: boolean, createdAt, updatedAt }`
where `color` ∈ `slate | indigo | emerald | amber | rose | violet` and
`memberIds` are entity (or nested group) ids. All listed fields are required if
you include a group.

## Assumption (optional — edge-backing claims)

`{ id, edgeId, text, status, createdAt, updatedAt }` (all required), plus
optional `kind` (`necessary | parallel | sufficient`, S&T), `injectionIds`,
`resolved`, `source` (`user | ai`). `status` ∈
`unexamined | valid | invalid | challengeable`. `edgeId` must match an edge id;
to surface it on that edge, also add the assumption's id to that edge's
`assumptionIds`.

## Comment (optional — review threads)

`{ id, anchor, body, author, createdAt, updatedAt }` (all required) + optional
`parentId` (reply), `resolved`. `anchor` is one of:
`{kind:'entity', entityId}` · `{kind:'edge', edgeId}` · `{kind:'document'}` ·
`{kind:'point', x, y}`.

## Minimal valid document (smallest that imports)

```json
{
  "schemaVersion": 9,
  "id": "d",
  "diagramType": "crt",
  "title": "Tiny",
  "nextAnnotationNumber": 3,
  "entities": {
    "a": { "id": "a", "type": "rootCause", "title": "Cause",
           "annotationNumber": 1, "createdAt": 1735689600000, "updatedAt": 1735689600000 },
    "b": { "id": "b", "type": "ude", "title": "Problem",
           "annotationNumber": 2, "createdAt": 1735689600000, "updatedAt": 1735689600000 }
  },
  "edges": {
    "e": { "id": "e", "sourceId": "a", "targetId": "b", "kind": "sufficiency" }
  }
}
```
