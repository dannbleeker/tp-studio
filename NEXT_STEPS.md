# Next Steps

A parking lot. Nothing here is required for v1; everything is honest about what's deferred.

The [Flying Logic feature catalog](#flying-logic-feature-catalog-fl-) below organizes
candidate features into 13 named bundles with stable `FL-*` IDs so we can say
"let's do Bundle 1 + FL-EX1 next iteration" without ambiguity. Reasoning / confidence,
project management, and scripting are out of scope and not catalogued.

## Recommended priorities for the next session

In rough order of "would I notice the difference":

### 1. AND-junction visual polish

Today: each AND-grouped edge renders a violet dot near its target. Sibling dots stack into one because they share the target handle position. The brief's "subtle arc connecting them" is not drawn.

**To implement:** an `ANDOverlay.tsx` SVG layer mounted inside React Flow that reads edge positions via the live RF instance, groups edges by `andGroupId`, and draws a small quadratic-bezier arc connecting the dot positions just before the target. Quoted from the brief: "small dot where edges merge before reaching the target, subtle arc connecting them. Open to better proposals once the canvas is wired." Not a regression risk — purely additive.

### 2. Mobile / narrow-viewport pass

Brief said "responsive down to 1024 px is enough." Below that, the 320-px inspector covers most of the canvas. Below 768 px the title-badge overlaps the top-bar buttons. Concrete improvements:

- Collapsible inspector on narrow viewports (slide off-screen by default, swipe in from the right).
- Hide command/help/theme button labels under a kebab menu at < 768 px.
- Respond gracefully to portrait orientation.

### 3. Confidence field UI

`Entity.confidence` already exists in the schema (range −100 to +100). Brief explicitly deferred the UI to v1.5. A slider in the inspector with a colored bar — green for positive, amber for ~0, red for strongly negative — is the obvious shape.

### 4. Component-level interaction tests

Domain + store + services + hooks are all covered (87 tests). Canvas + Inspector + ContextMenu + CommandPalette have no direct tests. Pull `@testing-library/react`'s `render` into per-component tests for:

- Inspector: selecting an entity shows its type/title; toggling a warning persists.
- ContextMenu: right-click an entity shows the right items; "Convert to" actually mutates the type.
- CommandPalette: arrow-key navigation; running a command closes the palette; pre-filtered query from Cmd+E.

Worth doing but the marginal return is lower than the items above because the underlying store actions are already covered.

### 5. Backward-incompatible migrations stub

`schemaVersion: 1` is currently a literal. Bumping to `2` requires:

- A migration table mapping versions to transform functions.
- The `importFromJSON` validator becomes a dispatcher that picks the right validator for the incoming version, then runs migrations forward to current.
- A test fixture per version.

Pre-stub the migration interface now; it's much cheaper than retrofitting once a v2 schema lands.

## Brief items intentionally out of scope

These come straight from the brief's "Out of scope — do not build" list:

- Real-time multi-user collab
- Cloud sync, accounts, auth
- Prerequisite Trees, Transition Trees, Evaporating Clouds (data model accommodates them but no UI)
- Project management, calendars, resources, MS Project export
- Bayesian / evidence-based propagation
- Course-of-action (COA) analysis features
- Mobile-first design (responsive down to 1024 px is enough)
- Print stylesheets
- i18n (English only)

When and if any of these enters scope, the domain layer should be able to absorb most of the additional concepts without breaking. The data model is wide enough.

## Polish ideas (small but visible)

- **Animated inspector slide-in.** Today it snaps; a 200 ms transform transition would feel less jarring.
- **Empty-state second tier.** Once the user creates their first entity the "Empty diagram" hint disappears, but a quieter "Press Tab to add a child" tip could ride along for the next ~30 seconds.
- **Right-click on multi-selected edges.** Today the context menu fires on the single edge under the cursor. A "Group as AND" entry on a multi-selection right-click would shave a step off the current palette flow.
- **Edge labels for the causality reading.** A subtle "→" mid-edge isn't necessary, but an optional "because" or "therefore" label for presentation mode could be added.
- **Print stylesheet.** Brief says no, but a single `@media print` rule that hides the inspector/toolbar would make `Ctrl+P` produce something useful.

## Tooling / process

- **CI.** No GitHub Actions / pipeline. A single workflow running `pnpm install && pnpm lint && pnpm test && pnpm build` on push would catch regressions before they land. Skipped because the brief was a local-only build.
- **Husky / lefthook.** Pre-commit hook to run Biome + tests would catch a lot. Optional.
- **Conventional Commits.** Current commit messages are descriptive but don't follow `feat:` / `fix:` / `chore:` etc. Brief called for Conventional Commits — partially honored in spirit, not in format.
- **`.editorconfig`** for cross-editor consistency. Would matter only if more contributors join.
- **Storybook for the UI primitives.** `Button`, `Modal`, `Field`, `WarningsList` are good Storybook candidates. Worth it once there are more primitives.

## Known environment quirks

These are specific to the Windows + corporate-AppLocker environment this was built on, but they apply to anyone hitting the same constraints.

- **`pnpm dlx` is blocked** in the corporate environment used to scaffold this. `pnpm install` from a `package.json` works; one-off `pnpm dlx <pkg>` from the npm cache temp dir is denied by Group Policy / AppLocker.
- **PowerShell Constrained Language Mode** breaks `npm.ps1` — npm/pnpm commands must be invoked from Bash or via `.cmd` shims, not via PowerShell scripts.
- **OneDrive sync + `node_modules`** is slow and occasionally lock-prone. The project lives at `C:\dev\tp-studio` for that reason.
- **`pnpm-workspace.yaml`** is autogenerated with anomalous content by pnpm 11 in some environments. If `pnpm add` silently fails to update `package.json`, check for and delete that file.
- **`html-to-image`** is dynamic-imported now (round 3 / item 5). The dynamic chunk only loads when PNG export runs.

## When picking this up next

1. **Pull the project state.** `cd C:\dev\tp-studio && git status` — should be clean. `pnpm install` (the preinstall script will verify Node 20+). `pnpm dev` to start. `pnpm test` to confirm 87/87 green.
2. **Open** [README.md](README.md) for architecture, [USER_GUIDE.md](USER_GUIDE.md) for the feature surface, [CHANGELOG.md](CHANGELOG.md) for what got built when.
3. **Pick a candidate** from the recommended priorities above, or propose something else.
4. **Build in vertical slices**, the way the brief originally framed it — one demo-able feature per commit.

Domain-first remains the right discipline: anything new that the data model needs should land in `src/domain/` first, with tests, before any UI work.

## Flying Logic feature catalog (FL-*)

Candidate features lifted from the [Flying Logic 4 user guide](https://docs.flyinglogic.com/print.html), each with a stable `FL-*` ID so we can pick items by reference in a future session.

**Out of scope, will not build:**
- Reasoning / confidence layer (entity spinners, propagation, numeric operators) — was Bundle G
- Project management (Task / Resource entities, MS Project import/export)
- Scripting (embedded interpreter)

Effort classes are rough (small / medium / large); actuals depend on what's already in place.

## Bundles

Bundles are independently-shippable units, roughly sized for one iteration each. Mix IDs across bundles freely.

### Bundle 1 — Navigation & Search
Make the tool usable on graphs of 20+ entities. **Medium total effort.**

| ID | Feature |
| --- | --- |
| `FL-NA1` | **Find / search** (regex, case-sensitive, whole-word) |
| `FL-NA2` | **Minimap** with current-viewport indicator |
| `FL-DI1` | Explicit **zoom controls** (25-400%, `<` `>` shortcuts, Alt+scroll) |
| `FL-SE4` | **Select Path Between** two selected entities |
| `FL-SE5` | Select all **Successors / Predecessors** |

### Bundle 2 — Multi-select & Bulk Editing
Faster manipulation of many entities at once. **Medium.**

| ID | Feature |
| --- | --- |
| `FL-SE1` | **Multi-select entities** with Shift+click (today only edges multi-select) |
| `FL-SE2` | **Marquee** (rubber-band) selection |
| `FL-SE3` | **Cut / copy / paste** within and between documents |
| `FL-SE6` | **Element swapping** (swap two entities; edges/attributes preserved) |
| `FL-SE7` | **Alt+click** an unselected entity to connect from current selection |

### Bundle 3 — Quick Capture
High leverage for first-time users. **Small-medium.**

| ID | Feature |
| --- | --- |
| `FL-QC1` | **Quick Capture** — press `E`, paste a bulleted list, get one entity per line |
| `FL-QC2` | **Bulk import** entities from CSV or markdown list |

### Bundle 4 — Layout Controls
More control over how dagre lays out the diagram. **Medium.**

| ID | Feature |
| --- | --- |
| `FL-LA1` | Multiple **layout directions**: BT / TB / LR / RL / radial inner-out / radial outer-in |
| `FL-LA2` | **Bias** control (start vs. end preference) |
| `FL-LA3` | **Compactness** slider |
| `FL-LA4` | **Incremental layout** (preserve relative positions across cycles) |
| `FL-LA5` | **Manual node positioning** (drag to override auto-layout per-node) |
| `FL-IN1` | **Layout Inspector** panel exposing the above |

### Bundle 5 — Export Pack
**Medium.** PDF is the heaviest single item.

| ID | Feature |
| --- | --- |
| `FL-EX1` | **PDF** export |
| `FL-EX2` | **JPEG** export |
| `FL-EX3` | **SVG** export (scalable, print-quality) |
| `FL-EX4` | **OPML** outline export |
| `FL-EX5` | **CSV** export of entities + edges |
| `FL-EX6` | **Annotations-only** export (numbered list, separate document) |
| `FL-EX7` | **Print** with header / footer / metadata (`@media print` + dialog) |

### Bundle 6 — Rich Annotations & Text
Open up what can live in / on entities. **Medium-large.**

| ID | Feature |
| --- | --- |
| `FL-AN1` | **Multi-line titles** (Alt+Enter) — partial today via textarea |
| `FL-AN2` | **Rich entity annotations** beyond `description` field |
| `FL-AN3` / `FL-ED7` | **Edge annotations** (text on edges, distinct from assumption entities) |
| `FL-AN4` | **Styled text** in titles/descriptions (bold, italic, lists) |
| `FL-AN5` | **Hyperlinks** — URLs and cross-references |
| `FL-CA1` | **User-Defined Attributes** — custom name-value pairs per entity (String/Int/Real/Boolean) |

### Bundle 7 — Custom Entity Classes
Make the entity model user-extensible. **Medium.**

| ID | Feature |
| --- | --- |
| `FL-ET6` | **Critical Success Factor** entity type |
| `FL-ET7` | **Note** entity (free annotation, not part of causal graph) |
| `FL-ET8` | **Custom user-defined entity classes** (name + color + icon) |
| `FL-ET9` | Per-class **symbol / icon** (built-in or uploaded SVG/PNG) |
| `FL-IN3` | **Domain Inspector** — manage entity classes / custom domains |
| `FL-IN5` | **Element Inspector** with tabs per element type |

### Bundle 8 — Structural Edge Operators
Edges that carry more meaning than "sufficient cause" — purely structural, no reasoning. **Medium.**

| ID | Feature |
| --- | --- |
| `FL-ED1` | **Edge weights** (positive / negative / zero correlation, as metadata) |
| `FL-ED3` | **XOR** groups (mutual-exclusion constraint on a set of incoming edges) |
| `FL-ED4` | Explicit **OR** groups (today's two-incoming-edges is implicit OR) |
| `FL-ED6` | **Back edges** (cyclic loops drawn thicker) |
| `FL-ED8` | **Edge reversal** command (swap head/tail) |

### Bundle 9 — Evaporating Cloud (second TOC tree)
Highest-leverage brief-deferred TOC feature. **Large.**

| ID | Feature |
| --- | --- |
| `FL-DT1` | **Evaporating Cloud** diagram type |
| `FL-ET1` | **Goal** entity type |
| `FL-ET2` | **Necessary Condition** entity type |
| `FL-ED2` | **Necessity edges** (in addition to sufficiency) |

### Bundle 10 — Other TOC Tree Types
**Very large.** Effectively four sub-bundles — ship one tree per iteration.

| ID | Feature |
| --- | --- |
| `FL-DT2` | **Prerequisite Tree** (Obstacle / Intermediate Objective entities) |
| `FL-DT3` | **Transition Tree** (Need / Expectation / Reality / Action entities) |
| `FL-DT4` | **Strategy & Tactics Tree** (multi-tier goal decomposition) |
| `FL-DT5` | Generic / **free-form** diagram (no TOC constraints) |

### Bundle 11 — Groups
Shaded enclosures for organizing large diagrams. **Large.**

| ID | Feature |
| --- | --- |
| `FL-GR1` | **Groups** — shaded enclosures with title and color, containing N entities |
| `FL-GR2` | **Nested** group hierarchy |
| `FL-GR3` | **Collapse / expand** groups |
| `FL-GR4` | **Hoist** into a group (view contents as whole canvas, breadcrumb to unhoist) |
| `FL-GR5` | **Promote children** when a group is deleted |

### Bundle 12 — Multi-document & Sharing
**Large.** Current store is single-doc; tabs is the gating piece.

| ID | Feature |
| --- | --- |
| `FL-EX8` | **Multi-document tabs** in one window |
| `FL-EX9` | **Auto-recovery on crash** (partial today — autosave to one slot only) |
| `FL-CO1` | **Reader Mode** — read-only share-link / share-file |
| `FL-CO2` | **Cross-document hyperlinks** |

### Bundle 13 — Polish & Preferences
Small, independently-shippable items. **Small-medium aggregate.**

| ID | Feature |
| --- | --- |
| `FL-DI2` | **Browse Lock** toggle — read-only viewing mode |
| `FL-DI3` | **Zoom-up annotation** — hover at low zoom for full content |
| `FL-DI4` | **Annotation numbers** (flow-order indicator on each entity) |
| `FL-DI5` | Visible **Entity IDs** as a toggle-able layer |
| `FL-IN2` | **Document Inspector** — metadata, print layout |
| `FL-TO1` | More **theme variants** (Rust, Coal, Navy, Ayu) |
| `FL-TO2` | **Animation speed** preference |
| `FL-TO3` | **Default orientation** preference for new documents |
| `FL-TO4` | **Edge color** palette preference |

## Reasonable iteration sizes

- **Smallest meaningful iteration:** Bundle 1, or Bundle 3, or Bundle 13. Roughly a day each.
- **A solid week:** Bundle 1 + 2 + 3 together, or Bundle 4 + 5.
- **A new chapter:** Bundle 9 (Evaporating Cloud) on its own — adds enough new domain to feel like a v1.1.

Domain-first remains the right discipline for any of these: changes to the data model land in `src/domain/` first, with tests, before any UI work.
