# Manual accessibility walkthrough — checklist

*A periodic (~1 hour) keyboard-and-screen-reader pass that the automated axe scans can't cover. The automated portion (Session 121) covers axe scans on the Help / About / Settings dialogs + Esc-close pins. This is the part a human has to drive — there's no way to script "does the focus order feel right" or "can I author a CRT without touching the mouse."*

**How to use:** run `pnpm dev`, open the app, and work top to bottom. Check each box; jot the failure in the Notes column if it doesn't pass. File anything that fails as a NEXT_STEPS item.

---

## 1. Canvas keyboard reachability

| ✓ | Check | Expected |
|---|---|---|
| ☐ | Tab from the page top — does focus eventually reach the canvas? | Focus lands on the React Flow pane or the first node without getting trapped in the top bar. |
| ☐ | Tab through nodes | Every node is reachable; focus ring is visible on each. |
| ☐ | Tab never traps | You can Tab *out* of the canvas back to the chrome (no infinite loop inside the pane). |
| ☐ | Shift+Tab reverses cleanly | Backward order mirrors forward order. |
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
| ☐ | Connect them (2 edges) | is there a keyboard connect path, or is drag the only way? *(known gap candidate)* |
| ☐ | Edit each title | focus node → Enter → type → Enter/Esc |
| ☐ | Undo / redo | Cmd/Ctrl+Z / Shift+Cmd/Ctrl+Z |
| ☐ | Save | Cmd/Ctrl+S or autosave confirmed |

**If connecting edges forces a mouse, that's the highest-value finding** — note it.

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
| ☐ | Node selection is announced | Selected entity's title/type read. |

---

## Known candidates going in (from the Session 135 design audit)

- **Inspector field labels** — `<Field>` uses a `<span>` not `<label htmlFor>`, so most inspector controls likely have no accessible name. This walkthrough should confirm the severity. See `docs/DESIGN_AUDIT_SESSION_135.md` finding #1.
- **Keyboard edge-connect** — verify whether drawing an edge has any non-mouse path.

Record results below the date so successive runs are comparable.

### Run log

- _YYYY-MM-DD_ — (initials) — findings:
