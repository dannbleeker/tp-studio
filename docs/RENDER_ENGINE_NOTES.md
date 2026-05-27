# Render-engine layout — design notes

Session 136. Captures the architecture as it stands today, what
Session 136 tightened in-place, and what still needs a dedicated
multi-session pass.

---

## Current state (Session 136)

### Layout pipeline

```
TPDocument (doc.entities + doc.edges + entity.position?)
        │
        ▼
useGraphPositions(doc, projection)
        │  fingerprint-gated effect (re-runs only on structural edits)
        ▼
buildLayoutInputs → { nodes: NodeBox[], edges: EdgeRef[] }
        │
        ▼
computeLayout(nodes, edges, opts)   ← dagre, lazy-loaded
        │
        ▼
overlayPinned(doc, projection, auto)  ← user-dragged positions win
        │
        ▼
{ [entityId]: { x, y } }   →  React Flow node positions
```

- **Trigger** — `useEffect` watching the `layoutFingerprint(doc)` string
  (entity ids + edge endpoints + edge group ids + pinned positions).
  Title / description / state / attribute edits don't fingerprint, so
  prose edits don't re-fire the dagre pass.
- **Strategies** — `LAYOUT_STRATEGY[diagramType]` is one of `'auto'` /
  `'manual'` / `'radial'`. Auto runs dagre; manual reads pinned
  positions only (EC uses this); radial uses a separate
  `radialLayout.ts` algorithm.
- **Pinning** — `entity.position` overrides whatever dagre computed.
  The Session 136 `Re-layout diagram` palette command clears every
  pinned position so the user can reset to the auto-layout.
- **Tuned constants (Session 136)** — `LAYOUT_RANK_SEPARATION` 80 → 60,
  `LAYOUT_NODE_SEPARATION` 40 → 32. Pulls entities closer together
  without making the diagram feel cramped; per-doc `layoutConfig`
  override still wins when a user wants the looser layout for projector
  mode or dense EC walls.

### Junctor rendering (AND / OR / XOR)

```
TPEdge (each junctor-grouped edge)
        │
        ▼
bezier endpoint redirected to junctor centre (cy = targetY + JUNCTOR_CENTER_OFFSET_Y)
        │
        ▼
JunctorOverlay paints a small circle below each target with junctor-grouped incoming edges
        │
        ▼
short line continues from circle into target's bottom handle (only place an arrowhead appears for the group)
```

- **Visible logic gate** — the circle reads as "all these causes are
  combined here, then one signal flows to the target".
- **Cross-kind exclusivity** — an edge belongs to at most one of
  `andGroupId` / `orGroupId` / `xorGroupId`; store actions enforce this.
- **Single-source junctors render anyway** — looks slightly silly
  ("AND of one") but never leaves an edge ending in mid-air.

---

## What still needs a dedicated session

### 1. Real edge routing (avoid obstacles)

**Symptom**: on dense graphs, dagre's edge polylines sometimes pass
*through* node bodies (the edge is technically rendered behind the
node, so the user sees the edge appear / disappear at the node's
edges). Dann's Session-136 feedback flagged this.

**Why it happens**: dagre only ranks nodes + assigns columns; it does
not route edges around obstacles. React Flow then connects each edge's
source handle to its target handle with a smooth bezier, with no
obstacle awareness.

**Options**:

- **A) Switch the layout backend to ELK** (eclipse layout kernel). ELK
  has orthogonal + polyline routers that natively avoid node
  intersections. Trade-offs: ~70 KB gzip (vs dagre's 25 KB), worker-
  based async API, harder to tune (more knobs), slower on small
  graphs. The migration also throws away every hand-tuned dagre
  constant in `layout.ts`.
- **B) Custom obstacle-avoidance on top of dagre.** Keep dagre for
  node placement, write a routing pass that computes each edge as an
  orthogonal polyline avoiding node bounding boxes. Cheaper bundle
  cost but several days of work to make robust on cycles + multi-rank
  edges.
- **C) Z-order shuffle (sometimes used as a hack).** Force edges
  *over* nodes. Looks bad — the edge crosses the node title text.
  Rejected.

**Recommendation**: **B** for now (keep dagre, add an obstacle-aware
routing pass), with **A** as the planned follow-up once we hit graphs
where B's perf cost becomes visible (>500 entities).

### 2. AND drag-drop creation

**Spec** (Dann, Session 136): the user drags an edge body and drops it
onto an existing AND junctor circle → the dragged edge joins that AND
group.

**Current state**: there's no hit-test on junctor circles during edge
drag. `JunctorOverlay` paints them but they don't carry a React Flow
node id, so React Flow's `connectionState.toNode` never fires for
them.

**Approach**: Two options:

- **A)** Make each junctor a real (invisible, zero-size) React Flow
  node anchored at the junctor centre. The drag-end fallback in
  `useGraphMutations.onConnectEnd` already handles drop-on-node →
  connect. Add a "is junctor node" check and call
  `addCoCauseToEdge(targetEdgeId, droppedSourceId)` instead of
  `connect(...)` for that case.
- **B)** Custom hit-test in `onConnectEnd` for "is the release point
  inside any junctor circle". Bypasses React Flow's node model but
  adds a coordinate-translation dependency (cursor pos → flow pos →
  junctor distance).

**Recommendation**: **A** — fewer moving parts, matches how
`addCoCauseToEdge` is already wired.

### 3. Layout-config UI exposure

Each doc has a `layoutConfig` field that can override `rankSep` /
`nodeSep` / `direction` / `align`. Today only `defaultLayoutDirection`
(app-wide preference) and `setLayoutConfig({ direction })` (palette
command) are exposed. `rankSep` / `nodeSep` are programmatically
accessible but no UI.

If we ship A above (ELK or obstacle routing), a small "Layout density"
control in Settings → Display would let users dial between
"compact" / "balanced" / "spacious" without touching individual sep
values.

---

## Session 136 deliverables (in this commit)

- Tightened `LAYOUT_RANK_SEPARATION` 80 → 60 + `LAYOUT_NODE_SEPARATION`
  40 → 32 in `src/domain/constants.ts`.
- New `Re-layout diagram (clear pinned positions)` palette command
  (`Cmd/Ctrl+K → re-layout`). Clears every `entity.position`, waits
  for the auto-layout effect to recompute, then `fitView` to show the
  fresh result.
- This document.

Pinned positions are not migrated. Existing docs with hand-dragged
entities keep those positions; the user can clear them per-entity via
the inspector or globally via the new palette command.
