# Obstacle-aware edge routing — implementation plan

Follow-up to [`docs/RENDER_ENGINE_NOTES.md`](RENDER_ENGINE_NOTES.md) §1.
This document is the design + phasing for the deferred routing pass.
Not yet started; ship-in-phases-and-iterate posture so the first
visible improvement lands in ~1 session and the full solution
converges over 4–5 sessions.

---

## Problem

Today's pipeline:

```
dagre  →  per-entity (x, y)
     ↓
React Flow  →  per-edge bezier from source handle to target handle
```

The bezier path is purely geometric — source position, target
position, and a curve through them. On dense graphs the curve can
pass through the body of a non-endpoint node. React Flow paints
edges *below* nodes (intentional, so node titles stay legible), so
the user sees the edge disappear into the obstacle.

**Symptom**: edges that should connect A→C visibly vanish when
node B sits on the straight line between them.

Dann flagged this in Session 136 as part of his usage feedback.

---

## Design questions + the chosen answer

| # | Question | Chosen answer | Rationale |
|---|----------|---------------|-----------|
| 1 | Output shape — what data structure carries the routed geometry? | `EdgeRoute = { d: string, waypoints: Point[] }`. `d` is a precomputed SVG path string; `waypoints` is the corner list for hit-tests, label placement, animation. **Curve style: smoothed bezier through the waypoint list** (Dann's locked decision — keep the organic visual identity). | Keep the existing TPEdge / BaseEdge contract intact — `path` is already what BaseEdge consumes. The waypoints are exposed for the rare consumer that needs them. |
| 2 | Algorithm | Visibility-graph + A\* over node corners (Phase C, the shipping algorithm). Single-waypoint heuristic (Phase B) is an internal stepping stone — does NOT ship alone. | Visibility-graph is the standard answer for axis-aligned obstacles; A\* is fast and well-known. Dann opted to hold Phase B for Phase C so the first release is honestly "smart routing v1" rather than a half-finished improvement. |
| 3 | Perf budget | ≤ 50 ms total for ≤ 100-entity diagrams. Re-runs only on dagre fingerprint change (already gated). | Live editing is dominated by the dagre pass at ~25–100 ms — adding 50 ms is acceptable on the *layout* event, not on every keystroke (which doesn't change the fingerprint). |
| 4 | Obstacle granularity | Padded axis-aligned bounding box per node (NODE\_WIDTH × NODE\_MIN\_HEIGHT + 8 px margin). | The padding gives a "no-fly zone" so edges don't graze node edges. Cheap to compute; matches how the user perceives the node footprint. |
| 5 | Junctor edges | Route the **source → junctor centre** segment; leave the **junctor → target** segment as the existing short line. | The junctor's geometric purpose is to converge multiple causes into one visible point. Routing the convergence segment is the value-add; the final emission stays unchanged. |
| 6 | Pinned positions | Routing runs *after* the pin overlay, so it sees real positions. User dragging a node onto an edge path triggers a re-route via the existing fingerprint (`position@x,y` is encoded). | Same fingerprint hook the dagre pass already uses — no new invalidation surface. |
| 7 | Special edges | Mutex edges (EC D ↔ D′) and back-edges keep their existing custom geometry. Note-edges (dotted) route same as regular but stay visually distinct via `strokeDasharray`. | Routing isn't about visual style — it's about *which segments are drawn where*. Style is orthogonal. |
| 8 | Multi-rank edges | Insert a waypoint at each intermediate rank's vertical centre, then route between consecutive waypoints. | Dagre already knows the rank ordering; we just need to read it. |
| 9 | Bundle | Lazy-load the routing module the same way dagre lazy-loads today (~25 KB gz). Routing target: ≤ 10 KB gz incremental. | Initial paint isn't slowed; users who never load a routing-needy diagram never pay the cost. |
| 10 | Settings | New `edgeRouting: 'smart' \| 'direct'` preference. **Default `'smart'` from first release.** `'direct'` is the opt-out for users who specifically want the current behaviour. | The toggle is one line of code and respects taste; smart-by-default reflects Dann's locked decision (no opt-in period). |

---

## Phased delivery

Each phase is an independent commit + push + green CI. The visible-
improvement gradient is **gated by Dann's "hold for C" decision**:
Phases A + B + C land behind a hard-coded `false` constant in
`useEdgeRoutes`, then the commit that closes Phase C flips the gate
to a real preference read + adds the Settings toggle (default
`'smart'`). Phase D polishes post-release. Net: two user-visible
release gates (A+B+C combined, then D) rather than four.

This means main carries A + B (scaffolding + heuristic) as
dead-but-tested code for a while. The cost is one extra constant
and an early branch in `useEdgeRoutes`; the win is one honest "smart
routing v1" release instead of two partial ones.

### Phase A — Foundations (1 session, hidden behind gate)

**Goal**: introduce the routing module + types + API contract.
Visually a no-op (the router falls through to the existing bezier).
**Ship state**: lands on main behind `const SMART_ROUTING_ENABLED =
false` in `useEdgeRoutes` — dead-but-tested code until Phase C
flips the gate.

**Deliverables**:

- `src/domain/edgeRouting.ts` — new module.
  - `type EdgeRoute = { d: string, waypoints: Point[] }`
  - `type RoutingInput = { source: Point, target: Point, obstacles: Box[], rankSpacing?: number }`
  - `routeEdge(input: RoutingInput): EdgeRoute` — Phase A returns the
    bezier path verbatim (TODO: real routing in Phase B+).
- `src/components/canvas/edges/TPEdge.tsx` reads `props.data?.route?.d`
  if present, falls back to `getBezierPath()` otherwise. Behavior:
  unchanged in Phase A (route is never set yet).
- `src/components/canvas/hooks/useGraphEdgeEmission.ts` stamps
  `data.route` from a NEW `useEdgeRoutes(doc, projection, positions)`
  hook. The hook returns an empty map in Phase A (TODO: populate in
  Phase B).
- Tests:
  - `routeEdge` returns the bezier `d` verbatim for any input.
  - `useEdgeRoutes` returns an empty map.
  - Existing edge tests pass (no behaviour change).

**Bundle impact**: 0 KB user-visible (routing module is empty
helpers).

**Risk**: low. Pure scaffolding.

### Phase B — Single-obstacle heuristic (1 session, hidden behind gate)

**Goal**: route the simplest dense case — one obstacle blocking the
straight line — via a single waypoint. **Ship state**: still gated
off; lands on main as dead-but-tested code. Phase B is a stepping
stone, not a release; it gives Phase C an obvious-correctness
fallback for the trivial case.

**Deliverables**:

- `routeEdge` populates real geometry:
  - Compute the straight line from source to target.
  - For each non-endpoint obstacle, hit-test against the bounding box.
  - If exactly one obstacle blocks: detour ABOVE or BELOW it (pick
    the shorter side). Output: source → waypoint → target as a
    smoothed bezier through the waypoint.
  - If zero obstacles: bezier as before.
  - If 2+ obstacles: fall through to bezier (let Phase C handle).
- `useEdgeRoutes` walks each edge, calls `routeEdge`, returns the
  map.
- Tests:
  - 3-node colinear diagram (A → C with B on the line): assert the
    edge route has a waypoint.
  - 3-node off-line diagram (B beside the A→C line): assert no
    waypoint.
  - Performance: route 50 edges in ≤ 5 ms.

**Bundle impact**: ~3 KB gz.

**Risk**: medium. Hit-testing bezier-vs-box is non-trivial; we'll
approximate by sampling the bezier at 8 points and testing each
segment.

### Phase C — Visibility-graph + A\* (2 sessions, **first user-visible release**)

**Goal**: replace the single-waypoint heuristic with a real
pathfinder that handles any number of obstacles. **Ship state**:
the commit that closes Phase C flips `SMART_ROUTING_ENABLED` to a
real `useDocumentStore((s) => s.edgeRouting === 'smart')` read,
adds the Settings → Display radio (default `'smart'`), and ships
`StoredPrefs.edgeRouting`. New users + existing users get smart
routing as default; the `'direct'` opt-out is the escape hatch.

**Deliverables**:

- Visibility-graph builder: for each routing call, build a graph
  whose vertices are { source, target, each obstacle corner } and
  whose edges connect pairs of vertices whose connecting segment
  doesn't intersect any obstacle.
- A\* search from source to target through the visibility graph,
  using euclidean distance as both edge weight and heuristic.
- Polyline output: corner list → smoothed SVG path (rounded
  corners at each turn for visual softness).
- Tests:
  - Property test: 100 random graphs, no edge polyline intersects
    any non-endpoint obstacle.
  - Snapshot test: pin specific diagrams' route output strings.
  - Performance: route 500 edges in ≤ 50 ms.
- Bundle: lazy-load via `await import('@/domain/edgeRouting')` so the
  cost only lands on the first relayout, not initial paint.

**Bundle impact**: ~10 KB gz (lazy-loaded).

**Risk**: medium-high. A\* itself is well-trodden; the
visibility-graph construction has corner cases (degenerate
collinear obstacles, the source/target being inside an obstacle
because the user dragged one onto another). Tests will surface
these; we mitigate by falling through to the bezier on any
"unroutable" result rather than crashing.

### Phase D — Polish + perf + settings (1 session)

**Goal**: tighten the rough edges from Phases B+C.

**Deliverables**:

- Junctor segment integration: routed edges still converge into the
  junctor circle; only the source → junctor segment uses A\*.
- Routing cache: WeakMap keyed on `{ edgesRef, entitiesRef }` so
  repeat calls within a doc state return the cached map. (Same
  pattern as `propagationResultCache` in `statePropagation.ts`.)
- Settings → Display: new `Edge routing` radio (`Smart (avoid
  obstacles)` / `Direct (curves through anything)`). Default
  `'smart'`. Stored in `StoredPrefs.edgeRouting`.
- Documentation:
  - Update `docs/RENDER_ENGINE_NOTES.md` §1 with "shipped — see
    `docs/EDGE_ROUTING_PROPOSAL.md`".
  - Add `USER_GUIDE.md` blurb on the new setting.
  - Update `CHANGELOG.md` with the multi-session arc.
- Bundle budget: keep the eager bundle within current ceiling
  (~75 KB gz for the index chunk).

**Bundle impact**: small (cache + setting); routing module already
loaded.

**Risk**: low. Mostly polish.

### Phase E (not in scope, parked) — future improvements

- ~~**Four-side anchoring**~~ ✅ *Shipped Session 138* — connectors now choose
  which of the four sides (top/bottom/left/right) to exit the source and enter
  the target, instead of fixed source-bottom / target-top. Pure `selectEdgeSides`
  (`src/domain/edgeSides.ts`) picks the anchor pair *before* A\* ("prefer flow
  direction": facing pair along the layout axis by default; switch only when an
  alternative is ≥ 60 px shorter or the preferred shot is blocked). Curves are
  kept via side-aware bezier emitters in `edgeRouting.ts` (control point along
  each chosen side's outward normal; reduces byte-for-byte to the old
  vertical-midpoint curve for bottom→top). Junctor source-legs + side-by-side
  mutex included; radial keeps its own router. Also fixed the latent dagre-`BT`
  away-side anchoring (cause-below / effect-above now anchors on the facing
  sides). Folded into `'smart'` — no new Settings toggle.
- **Channel routing**: dedicated horizontal/vertical lanes between
  rank rows for a cleaner "engineered" look. ELK does this natively
  if we ever migrate.
- **Edge-edge intersection minimization**: A\* finds the shortest
  obstacle-free path per edge, but doesn't consider OTHER edges as
  obstacles. Net result: lots of clean individual routes but they
  cross each other. Real fix is global optimization (NP-hard in
  general; heuristics exist).
- **Curved obstacle avoidance**: today's plan is orthogonal polylines.
  Curves are prettier but harder to make obstacle-aware. Park.
- **ELK migration**: if Phase C perf falls over on 1000+-entity
  graphs. Trade-off: ~70 KB gz extra + worker-based async API +
  harder tuning. Defer until we hit the wall.

---

## Test strategy

The plan above mentions tests per phase. Pulling them together:

| Test type | Phase | Lives in |
|-----------|-------|----------|
| Unit — `routeEdge` API contract | A | `tests/domain/edgeRouting.test.ts` |
| Unit — single-obstacle heuristic | B | `tests/domain/edgeRouting.test.ts` |
| Unit — visibility graph + A\* correctness | C | `tests/domain/edgeRouting.test.ts` |
| Property — no edge crosses non-endpoint box | C | `tests/domain/edgeRouting.test.ts` |
| Perf — route N edges in ≤ X ms | B + C | `tests/domain/edgeRouting.test.ts` |
| Integration — `useEdgeRoutes` returns expected map | A → D | `tests/components/canvas/useEdgeRoutes.test.tsx` |
| Visual regression — dense diagram baseline | C + D | `e2e/visual-routing.spec.ts` |
| Snapshot — route output strings | B + C | inline within unit tests |

---

## Resolved decisions (locked in by Dann)

1. **Visual style**: **Bezier through waypoints.** The visual
   identity stays organic / hand-drawn. The router computes waypoints
   that avoid obstacles, then the renderer smooths a bezier curve
   through them. Trade-off accepted: a smoothed bezier through
   tightly-spaced waypoints can dip into an obstacle's padding
   margin on aggressive turns. Mitigation: the padding-box is 8 px
   wider than the visual node footprint, so a small dip into
   padding still misses the node body.
2. **Default routing strategy**: **`'smart'` from the first release.**
   No opt-in period. The Settings → Display toggle exists as an
   escape hatch (users who specifically want the current behaviour
   can flip to `'direct'`), but the shipped default is smart routing.
3. **Ship cadence**: **Hold Phases A + B for Phase C.** The first
   user-visible release combines all three phases into one stable
   "smart routing v1" feature. Phase B alone is too partial to ship
   honestly — multi-obstacle cases would still slip through and the
   user would correctly read it as half-done. Phases A + B + C land
   together; Phase D polishes after the first user feedback.

These decisions tighten the plan: only TWO ship gates (the combined
A+B+C release and the Phase D polish pass) rather than four. Internal
commits per phase still happen for clean history, but main stays
`edgeRouting: 'direct'` (the current behaviour) until the combined
release flips the default. We'll gate the new code path behind a
hard-coded `false` constant in `useEdgeRoutes` while Phases A+B
land, then flip the constant + add the Settings toggle in the same
commit that lands Phase C.

---

## Estimated total scope

- Phase A: ~3 hours (scaffolding + tests)
- Phase B: ~4 hours (heuristic + tests + integration)
- Phase C: ~8 hours over two sessions (visibility graph + A\* +
  tests + perf tuning)
- Phase D: ~3 hours (polish + cache + settings + docs)

**Total: ~18 hours, ~4–5 focused sessions.**

Visible-improvement gradient: Phase A ships nothing visible. Phase
B fixes the "one obstacle on one edge" case (probably 60% of Dann's
reported instances). Phase C fixes everything routable. Phase D
polishes the seams.

---

## Greenlight criteria

All three locked. Phase A can start whenever a session has the
~3-hour budget for scaffolding. Phases A + B land behind a
hard-coded `false` gate in `useEdgeRoutes` (no visible change on
main); Phase C's commit flips the gate to a real preference read +
adds the Settings toggle (default `'smart'`). Phase D polishes
post-release.
