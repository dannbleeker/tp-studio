# Next Steps

A parking lot. Nothing here is required for v1; everything is honest about what's deferred.

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
