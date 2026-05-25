# Manual accessibility walkthrough — checklist

*A periodic (~1 hour) keyboard-and-screen-reader pass that the automated axe scans can't cover. This is the part a human has to drive — there's no way to script "does the focus order feel right" or "is the announcement clear in the actual NVDA voice."*

**Automated coverage so far:**

- **Session 121** — axe scans on Help / About / Settings dialogs + Esc-close pins.
- **Session 135 a11y push (slices 1–5):**
  - *Slice 1* — every node + edge stamps an `ariaLabel` derived from the visual badges (title + type + locus + step + state-with-speculative marker + eligibility for entities; transitive entity count for groups; source/target + back-edge/mutex/assumption count for edges). +18 helper contract tests.
  - *Slice 2* — focus-visible rings on `.react-flow__node` / `.react-flow__edge` distinct from the selection halo; per-theme accent picked up via the existing `:focus-visible` cascade.
  - *Slice 3* — extended the axe spec: named `<main aria-label="TP Studio canvas">` landmark, canvas-with-SelectionToolbar scan, EC canvas scan.
  - *Slice 4* — arrow-key navigation between connected nodes (`useArrowKeyNodeNav` + 11 pure scoring tests).
  - *Slice 5* — keyboard edge-creation gesture (palette `Start edge from selected entity…` → `Complete edge to selected entity`, with Esc cancel).

This checklist is now mostly **verification** — confirming the automated work *feels* right in a screen reader and on a real keyboard. Rows already backed by code carry a 🤖 marker so you can focus on the rows that still need human judgement.

**How to use:** run `pnpm dev`, open the app, and work top to bottom. Check each box; jot the failure in the Notes column if it doesn't pass. File anything that fails as a NEXT_STEPS item.

---

## 1. Canvas keyboard reachability

| ✓ | Check | Expected |
|---|---|---|
| ☐ | Tab from the page top — does focus eventually reach the canvas? | Focus lands on the React Flow pane or the first node without getting trapped in the top bar. |
| ☐ 🤖 | Tab through nodes — focus ring visible | Slice 2 ships the focus-visible ring; verify it's clearly visible against the node card on every theme. |
| ☐ | Tab never traps | You can Tab *out* of the canvas back to the chrome (no infinite loop inside the pane). |
| ☐ | Shift+Tab reverses cleanly | Backward order mirrors forward order. |
| ☐ 🤖 | Arrow keys move focus to the connected neighbour (NEW — slice 4) | With a node focused, ←/↑/→/↓ jumps to the connected entity in that direction. `useArrowKeyNodeNav` is mounted; 11 scoring tests pin the logic. |
| ☐ | Arrow keys (in Presentation mode) | ←/→ step through entities; focus follows. |

## 2. Per-dialog focus order

Open each dialog and Tab through it. Focus order should match reading order (top→bottom, left→right), and the first Tab should land on the first interactive element, not the close button.

| ✓ | Dialog | Open via |
|---|---|---|
| ☐ | Settings | Cmd/Ctrl+, or the gear |
| ☐ | Help | ? button / palette |
| ☐ | About | palette → "About" |
| ☐ | Print preview | palette → "Print / PDF" |
| ☐ | Import entity picker | palette → "Import entity from another doc…" |
| ☐ | Template picker | New-doc flow |
| ☐ | Export picker | palette → "Export…" |

For each: **Esc closes it**, and focus **returns to the element that opened it** (not the page top).

## 3. Esc cascade priority

Open nested surfaces and press Esc once. It should close the **innermost** surface first, in this order:

```
command palette → settings/help/about dialog → selection → (nothing)
```

| ✓ | Scenario | Expected on Esc |
|---|---|---|
| ☐ | Palette open over a dialog | Palette closes, dialog stays. |
| ☐ | Dialog open with an entity selected | Dialog closes, selection stays. |
| ☐ | Entity selected, nothing else | Selection clears. |
| ☐ | Editing a node title (textarea) | Exits editing WITHOUT committing the change. |

## 4. Keyboard-only CRT authoring

Author a small Current Reality Tree without touching the mouse. Each step should have a keyboard path:

| ✓ | Step | Keyboard path |
|---|---|---|
| ☐ | Add 3 entities | palette / shortcut — no toolbar click required |
| ☐ 🤖 | Connect them (2 edges) — keyboard path | Select source → palette → **Start edge from selected entity…**; select target (Tab or arrow keys) → palette → **Complete edge to selected entity**. Esc cancels the pending edge. Slice 5 ships this; 5 behavioural tests cover happy / error / self-loop / no-pending. |
| ☐ | Edit each title | focus node → Enter → type → Enter/Esc |
| ☐ | Undo / redo | Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z |
| ☐ | Save | Cmd/Ctrl+S or autosave confirmed |

## 5. Command palette discoverability

| ✓ | Check | Expected |
|---|---|---|
| ☐ | Cmd/Ctrl+K opens the palette from anywhere | Opens; search field focused. |
| ☐ | Type "ude" | "Add UDE" (or equivalent) surfaces. |
| ☐ | Type "core" | Core-driver / root-cause action surfaces. |
| ☐ | Type "snap" | Snapshot / revision action surfaces. |
| ☐ | Every primary action is reachable by search | No action is mouse-only. |

## 6. Screen-reader spot-check (optional, higher effort)

Turn on a screen reader (NVDA on Windows, VoiceOver on macOS: Cmd+F5) and:

| ✓ | Check | Expected |
|---|---|---|
| ☐ | Icon-only buttons announce a name | Each reads its `aria-label`, not "button". |
| ☐ | Inspector fields announce their label | *(known gap — the design audit flagged `<Field>` renders an unlinked `<span>`, so these may read as unlabeled. Confirm + prioritize.)* |
| ☐ | Dialog open is announced | Role="dialog" + name read on open. |
| ☐ 🤖 | Node focus is announced with full context | Slice 1 stamps an ariaLabel on every node: type + title + step + locus + state (with `(speculative)` marker) + eligibility. Verify a sample reads cleanly (e.g. "Action: Do the audit, step 3, locus control, state true, action eligible"). |
| ☐ 🤖 | Edge focus announces direction + modifiers | Slice 1 stamps "Edge from X to Y" + back-edge / mutex / N-assumptions modifiers (or "N aggregated edges from X to Y" for synthetic cross-collapse edges). |
| ☐ 🤖 | Group / collapsed-root focus announces member count | Slice 1: "Group: title (N entities)" with collapsed/archived modifiers; "Collapsed group: title (N entities hidden)" for collapsed roots. |

---

## Known candidates going in (from the Session 135 design audit)

- **Inspector field labels** — `<Field>` uses a `<span>` not `<label htmlFor>`, so most inspector controls likely have no accessible name. This walkthrough should confirm the severity. See `docs/DESIGN_AUDIT_SESSION_135.md` finding #1.
- ~~**Keyboard edge-connect** — verify whether drawing an edge has any non-mouse path.~~ **Resolved (slice 5).** Two-step palette flow: `Start edge from selected entity…` then `Complete edge to selected entity`.

Record results below the date so successive runs are comparable.

### Run log

- _YYYY-MM-DD_ — (initials) — findings:
