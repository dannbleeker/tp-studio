# Next Steps

A parking lot. Nothing here is required for v1; everything is honest about what's deferred.

The [Flying Logic feature catalog](#flying-logic-feature-catalog-fl-) below lists candidate
features lifted from the Flying Logic 4 user guide, each with a stable `FL-*` ID so we can
say "let's do FL-NA1 and FL-SE2 next iteration" without ambiguity.

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

Generated from a feature comparison against the [Flying Logic 4 user guide](https://docs.flyinglogic.com/print.html). Each row has a stable ID so we can pick items by reference. "Effort" is a rough class (small / medium / large) — actual estimates depend on what's already in place.

### Diagram types

| ID | Feature | Effort | Notes |
| --- | --- | --- | --- |
| `FL-DT1` | Evaporating Cloud diagram | Large | TOC core — brief said data model accommodates it but no UI |
| `FL-DT2` | Prerequisite Tree | Large | Brief: deferred |
| `FL-DT3` | Transition Tree | Large | Brief: deferred |
| `FL-DT4` | Strategy & Tactics Tree | Large | Not in brief |
| `FL-DT5` | Generic / free-form logic diagram (no TOC constraints) | Medium | Not in brief |

### Entity types & model

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-ET1` | **Goal** entity type | Small |
| `FL-ET2` | **Necessary Condition** entity type (Evaporating Cloud needs this) | Small |
| `FL-ET3` | Action / Task entity types (project-mgmt mode) | Medium |
| `FL-ET4` | Resource entity type | Medium |
| `FL-ET5` | Knowledge / Proposition entity types (evidence-based analysis) | Medium |
| `FL-ET6` | Critical Success Factor entity type | Small |
| `FL-ET7` | **Note** entity (free annotation, not part of causal graph) | Small |
| `FL-ET8` | **Custom user-defined entity classes** (name + color + icon) | Medium |
| `FL-ET9` | Per-class symbol / icon (built-in or uploaded SVG/PNG) | Medium |

### Edges & operators

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-ED1` | **Edge weights** (positive / negative / zero correlation) | Medium |
| `FL-ED2` | **Necessity edges** in addition to sufficiency (Evaporating Cloud needs these) | Medium |
| `FL-ED3` | **XOR** operator on AND groups | Small |
| `FL-ED4` | Explicit **OR** operator (today's two-incoming-edges is implicit OR) | Small |
| `FL-ED5` | Numeric operators: Sum, Product, Min, Max, Average, Negate, Complement, Distributor | Large |
| `FL-ED6` | **Back edges** (cyclic loops, drawn thicker, ignored by reasoning) | Medium |
| `FL-ED7` | **Edge annotations** (text mid-edge, distinct from assumption entities) | Small |
| `FL-ED8` | **Edge reversal** command (swap head/tail) | Small |

### Layout

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-LA1` | Multiple **layout directions**: BT / TB / LR / RL / radial inner-out / radial outer-in | Small |
| `FL-LA2` | **Bias** control (start vs. end preference) | Small |
| `FL-LA3` | **Compactness** slider | Small |
| `FL-LA4` | **Incremental layout** (preserve relative positions across cycles) | Medium |
| `FL-LA5` | **Manual node positioning** (drag, override auto-layout per-node) | Medium |

### Confidence / reasoning layer

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-RE1` | **Confidence spinners** on entities (0-1.0 belief). Field exists in schema; no UI yet | Large |
| `FL-RE2` | Calculated confidence propagation through edges + operators (driver vs driven) | Large |
| `FL-RE3` | Keyboard shortcuts (1-9, T, F, U) for confidence | Small (after RE1) |
| `FL-RE4` | Fuzzy boolean vs floating-point modes | Medium |
| `FL-RE5` | Display modes for confidence: shaded, numeric, symbol | Small |

### Selection & editing

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-SE1` | **Multi-select entities** with Shift+click (today only edges multi-select) | Small |
| `FL-SE2` | **Marquee selection** (rubber-band rectangle) | Medium |
| `FL-SE3` | **Cut / copy / paste** within and between documents | Medium |
| `FL-SE4` | **Select Path Between** two selected entities | Medium |
| `FL-SE5` | Select all Successors / Predecessors | Small |
| `FL-SE6` | **Element swapping** (swap two entities; edges/attributes preserved) | Medium |
| `FL-SE7` | Alt+click an unselected entity to connect from current selection | Small |

### Display & navigation

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-DI1` | Explicit zoom controls (25-400%, `<` `>` shortcuts, Alt+scroll) | Small |
| `FL-DI2` | **Browse Lock** toggle — read-only viewing mode | Small |
| `FL-DI3` | **Zoom-up annotation** — hover at low zoom to see full content | Medium |
| `FL-DI4` | Annotation numbers (flow-order indicator on each entity) | Small |
| `FL-DI5` | Visible entity IDs as a layer toggle | Small |
| `FL-NA1` | **Find / Search** (regex, case-sensitive, whole-word) | Medium |
| `FL-NA2` | **Minimap** with current-viewport indicator | Small |

### Groups

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-GR1` | **Groups** — shaded enclosures with title and color, containing N entities | Large |
| `FL-GR2` | Nested group hierarchy | Large |
| `FL-GR3` | Collapse / expand groups | Medium |
| `FL-GR4` | **Hoist** into group (view contents as whole canvas, breadcrumb to unhoist) | Medium |
| `FL-GR5` | Promote children when a group is deleted | Small |

### Annotations & text

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-AN1` | Multi-line entity titles (Alt+Enter to add line) — partial today via textarea | Small |
| `FL-AN2` | **Rich entity annotations** beyond `description` field | Medium |
| `FL-AN3` | **Edge annotations** (text on edges, distinct from assumption entities) | Small |
| `FL-AN4` | **Styled text** in titles/descriptions (bold, italic, lists) | Medium |
| `FL-AN5` | **Hyperlinks** — URLs and cross-references | Medium |
| `FL-CA1` | **User-Defined Attributes** — custom name-value pairs per entity (String/Int/Real/Boolean) | Medium |

### Export / file

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-EX1` | **PDF** export | Medium |
| `FL-EX2` | **JPEG** export | Small |
| `FL-EX3` | **SVG** export (scalable, print-quality) | Small |
| `FL-EX4` | **OPML** outline export | Small |
| `FL-EX5` | CSV export of entities + edges | Small |
| `FL-EX6` | Annotations-only export (numbered list, separate document) | Medium |
| `FL-EX7` | **Print** with header/footer/metadata (`@media print` + dialog) | Small |
| `FL-EX8` | **Multi-document tabs** in one window | Large |
| `FL-EX9` | **Auto-recovery on crash** (partial today — autosave to one slot) | Medium |

### Inspectors / panels

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-IN1` | **Layout Inspector** — orientation, bias, compactness sliders | Small |
| `FL-IN2` | **Document Inspector** — metadata, print layout | Small |
| `FL-IN3` | **Domain Inspector** — manage entity classes / custom domains | Medium |
| `FL-IN4` | **Operators Inspector** — default operator picker for junctors/entities | Medium |
| `FL-IN5` | **Element Inspector** with tabs per element type | Medium |

### Quick capture & bulk

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-QC1` | **Quick Capture** — press `E`, paste a bulleted list, get one entity per line | Medium |
| `FL-QC2` | Bulk-import entities from CSV or markdown list | Small |

### Theming / preferences

| ID | Feature | Effort |
| --- | --- | --- |
| `FL-TO1` | More **theme variants** (Light, Dark, Rust, Coal, Navy, Ayu) | Small |
| `FL-TO2` | Animation speed preference | Small |
| `FL-TO3` | Default orientation preference for new documents | Small |
| `FL-TO4` | Edge color palette preference | Small |

### Collaboration & scripting

| ID | Feature | Effort | Brief status |
| --- | --- | --- | --- |
| `FL-CO1` | **Reader Mode** — read-only share-link / share-file mode | Medium | Adjacent to brief's "no auth" rule |
| `FL-CO2` | Cross-document hyperlinks | Medium | Depends on `FL-EX8` |
| `FL-SC1` | Scripting interpreter (embedded JS sandbox) | Very large | Not in brief |

### Project management

| ID | Feature | Effort | Brief status |
| --- | --- | --- | --- |
| `FL-PM1` | Project management mode with Task / Resource entities | Large | Brief: out of scope |
| `FL-PM2` | MS Project (.MPP) import/export | Large | Brief: out of scope |

## Suggested next-iteration bundles

Coherent sets that play well together. Pick a bundle or mix IDs freely.

- **Bundle A — "Bigger graphs":** `FL-NA1`, `FL-SE1`, `FL-SE2`, `FL-NA2`, `FL-DI1`. Makes the tool usable for 20+ node diagrams.
- **Bundle B — "Second TOC tree":** `FL-DT1` (Evaporating Cloud) with `FL-ET1`, `FL-ET2`, `FL-ED2`. Highest-leverage brief-deferred item.
- **Bundle C — "Layout control":** `FL-LA1`, `FL-LA2`, `FL-LA3`, `FL-LA5`, `FL-IN1`.
- **Bundle D — "Pro export":** `FL-EX1`, `FL-EX3`, `FL-EX7`, `FL-EX4`.
- **Bundle E — "Quick capture":** `FL-QC1` + `FL-QC2`. Single-feature bundle, high leverage for first-time users.
- **Bundle F — "Groups":** `FL-GR1`-`FL-GR5`. Big schema addition; useful for large diagrams.
- **Bundle G — "Reasoning layer":** `FL-RE1`-`FL-RE5` + `FL-ED5`. Brief puts Bayesian propagation out of scope; the simpler fuzzy-AND/OR variant Flying Logic itself uses is in scope-ish.
