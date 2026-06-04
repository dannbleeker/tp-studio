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

### Arrowheads (cause→effect direction)

Two mechanisms, chosen by edge shape:

- **Plain causal / necessity edges → a custom oriented `<path>` in `TPEdge`.**
  Geometry, tuning constants, and the emission↔render id tags all live in one
  place: [`edgeArrowhead.ts`](../src/components/canvas/edges/edgeArrowhead.ts)
  (`arrowheadPlacement` is pure + unit-tested). It orients to the source→target
  direction and sits `ARROW_TIP_GAP` units before the box so the stroke runs
  straight out of the tip. **Why not React Flow's `markerEnd`:** an SVG marker
  always orients to the path's *endpoint tangent* — the target handle's fixed
  normal (vertical for a `Position.Bottom` handle) — but the routed/bezier edge
  approaches *diagonally*, so a marker pointed the wrong way and tucked under the
  card. `useGraphEdgeEmission` still stamps `markerEnd` with a tag id, but only
  as the "this edge gets an arrowhead" signal `TPEdge` reads (never a real marker
  anymore).
- **Junction (AND / OR / XOR) output → a `<marker>` in `JunctorOverlay`.** That
  arrow rides the short *straight* line from the circle to the target, where a
  marker orients correctly, so it keeps the simpler marker path.
- **Arrow-less by design:** mutex edges (symmetric conflict) and note edges
  (annotation) carry none; the per-cause edges feeding a junctor circle carry
  none either (the circle's single output arrow owns the direction).

**To tune every causal arrowhead** (size / offset / silhouette), edit the
constants at the top of `edgeArrowhead.ts` — one place, with the geometry test
pinning the result.

---

## What still needs a dedicated session

### 1. Real edge routing (avoid obstacles) — ✅ SHIPPED (Session 137)

**Symptom**: on dense graphs, dagre's edge polylines sometimes pass
*through* node bodies (the edge is technically rendered behind the
node, so the user sees the edge appear / disappear at the node's
edges). Dann's Session-136 feedback flagged this.

**Resolution**: Phase A → D of the obstacle-aware routing project
landed in Session 137. The full plan (locked decisions, phasing, test
strategy) is in [`docs/EDGE_ROUTING_PROPOSAL.md`](EDGE_ROUTING_PROPOSAL.md);
the implementation lives at:

- `src/domain/edgeRouting.ts` — pure-geometry router (visibility graph
  + A\* + smoothed bezier through waypoints).
- `src/components/canvas/hooks/useEdgeRoutes.ts` — React adapter +
  per-layout visibility-graph cache.
- `StoredPrefs.edgeRouting` (`'smart' | 'direct'`, default `'smart'`)
  + Settings → Display radio.

**Approach chosen**: option B from the original list (keep dagre, add
an obstacle-aware routing pass on top). The router emits **bezier
curves through waypoints** rather than orthogonal polylines, per
Dann's locked decision on visual identity. Phase E (ELK migration) is
parked unless we hit >1000-entity graphs where the visibility-graph
build cost becomes visible.

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

## Session 136 deliverables

**First commit (5060132):**
- Tightened `LAYOUT_RANK_SEPARATION` 80 → 60 + `LAYOUT_NODE_SEPARATION`
  40 → 32 in `src/domain/constants.ts`.
- New `Re-layout diagram (clear pinned positions)` palette command
  (`Cmd/Ctrl+K → re-layout`). Clears every `entity.position`, waits
  for the auto-layout effect to recompute, then `fitView` to show the
  fresh result.
- This document.

**Follow-up commit (75a2dc3): AND drag-create.**
JunctorOverlay's circles are now hit-tested during connection drag.
Drag an edge body, release over an existing AND circle → the source
joins the AND group via `addCoCauseToEdge`. The plumbing:

- `setHoveredJunctor({ groupId, kind }) / getHoveredJunctor()` in
  `src/services/canvasRef.ts` — singleton ref, mirrors the existing
  `hoveredEdgeRef` pattern.
- `JunctorOverlay` opts the circle into `pointer-events: auto` (parent
  SVG stays inert) and writes the ref on hover.
- `useGraphMutations.onConnectEnd` reads the junctor ref between the
  drop-on-node and drop-on-edge fallbacks (junctor is the more
  specific gesture).
- AND → `addCoCauseToEdge(memberEdgeId, sourceId)`. OR / XOR → friendly
  info toast (gesture understood, action not yet wired; deferred to
  the same future session as the routing pass).

**Follow-up commit (Session 137): OR / XOR drag-create.**
The Session-136 toast-on-OR/XOR stub now dispatches through the same
`addCoCauseToEdge` path. The store action gained an optional `kind`
parameter (`'and'` default, `'or'` / `'xor'` opt-in); cross-kind
exclusivity is enforced (adding an OR co-cause to an AND-grouped
edge returns null). `useGraphMutations.onConnectEnd` reads the
hovered junctor's `kind`, maps to the matching `*GroupId` field for
member-edge lookup, and emits a kind-specific toast ("Added as a
co-cause (OR-grouped)" etc.). The edge-body drop (no junctor circle)
stays AND-only — the canonical "add a sufficient co-cause" gesture
from the book.

**Follow-up commit (current): layout density UI.**
- New `layoutDensity: 'compact' | 'balanced' | 'spacious'` preference
  in `StoredPrefs`. Default `'balanced'` (== current Session-136
  tightened defaults).
- `useGraphPositions` multiplies the dagre `rankSep` / `nodeSep` by
  the density factor before each layout call. The per-doc
  `layoutConfig.rankSep` / `.nodeSep` override still wins when set
  explicitly — the multiplier only applies in the absence of an
  explicit per-doc value.
- Settings → Display surfaces a 3-radio control with copy describing
  each preset's intent ("dense maps", "default", "projector /
  accessibility").

Pinned positions are not migrated. Existing docs with hand-dragged
entities keep those positions; the user can clear them per-entity via
the inspector or globally via the new palette command.

## What's still TBD after Session 136

- Real obstacle-aware edge routing — see §1 above. **Full
  implementation plan now lives at
  [`docs/EDGE_ROUTING_PROPOSAL.md`](EDGE_ROUTING_PROPOSAL.md)**: four
  phases (foundations → single-obstacle heuristic → visibility-graph
  + A\* → polish), ~18 hours total, visible-improvement gradient lands
  Phase B as the first MVP. Three open questions (visual preference,
  default strategy, ship cadence) Dann needs to answer before Phase A
  starts.
- ~~OR / XOR drag-create~~ ✅ *Done Session 137* — the store action
  generalised to accept a `kind` parameter; `useGraphMutations.onConnectEnd`
  dispatches through the same path for all three kinds. Cross-kind
  exclusivity refuses adds that would conflict with an existing
  junctor membership.
