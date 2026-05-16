# Appendix B — Keyboard reference

> *Mirrors the Help dialog (`?` icon in the TopBar, or `Cmd+K → Show keyboard shortcuts`). Reproduced here for offline reference.*

## Canvas

| Shortcut | Action |
| --- | --- |
| `Double-click` (empty canvas) | Create a new entity at click point |
| `Click` (entity / edge / group) | Select |
| `Shift+click` | Add to selection |
| `Cmd/Ctrl+click` | Toggle selection |
| `Alt+click` (on another entity, with one entity selected) | Create edge from selected → clicked |
| `Drag` (empty canvas) | Marquee-select |
| `Drag` (handle on entity edge) | Create edge to drop target |
| `Alt+drag` (entity onto edge) | Splice the dragged entity into the edge |
| `Middle-click drag` / two-finger scroll | Pan |
| `Wheel` | Zoom |
| `+` / `-` / `0` | Zoom in / out / fit-to-view |
| `Esc` | Cascade dismiss (close palette → close picker → exit search → clear selection) |

## Selection-driven

| Shortcut | Action |
| --- | --- |
| `Tab` (entity selected) | Create child below the selection |
| `Shift+Tab` (entity selected) | Create parent above the selection |
| `Enter` (entity selected) | Enter inline title edit |
| `Alt+Enter` (inside inline editor) | Newline in title |
| `Esc` (inside inline editor) | Cancel without committing the in-progress edit |
| `A` (edge selected) | Add an assumption to the edge |
| `Delete` / `Backspace` | Delete selection (confirms when there are connected edges) |
| `Cmd/Ctrl+C` / `X` / `V` | Copy / cut / paste |
| `Cmd/Ctrl+Shift+→` | Select all successors |
| `Cmd/Ctrl+Shift+←` | Select all predecessors |

## Document-wide

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+Z` / `Shift+Z` | Undo / redo |
| `Cmd/Ctrl+K` | Open command palette |
| `Cmd/Ctrl+F` | Open find panel |
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+E` | Palette pre-filtered to Export commands |
| `Cmd/Ctrl+\` | Close inspector (clear selection) |
| `E` (no modifiers, not in text field) | Open Quick Capture |
| `?` | Open Help dialog |

## Palette commands worth memorising

| Command | Purpose |
| --- | --- |
| `New diagram…` | Diagram type picker |
| `Load example…` | Example picker |
| `New from template…` | Templates library |
| `Capture snapshot` | Save a revision |
| `Open history panel` | RevisionPanel toggle |
| `Start CLR walkthrough` | Iterate open warnings |
| `Start read-through` | Verbalisation overlay |
| `Find core driver(s)` | Highest-reach root cause |
| `Spawn Evaporating Cloud from selected entity` | CRT → EC pivot |
| `Splice entity into selected edge` | Create-and-splice |
| `Group as AND` / `OR` / `XOR` | Junctor grouping |
| `Group selected as new group` | Generic group |
| `Move selection to Archive group` | Quick archive |
| `Toggle EC reading guide` | EC-only |
| `Reopen creation wizard` | If you dismissed and want it back |
| `Copy read-only share link` | Fragment-encoded share URL |
| `Export` | Open the unified picker |

The complete list is in the palette itself — open `Cmd+K` and scroll. Categories are visible at the right edge of each row.
