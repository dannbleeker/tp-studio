# Appendix B — Keyboard reference

> *Mirrors the Help dialog (the `?` icon in the TopBar, or `Cmd+K → Help & keyboard shortcuts`). Reproduced here for offline reference.*

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
| `Enter` / `F2` (entity selected) | Enter inline title edit |
| `Alt+Enter` (inside inline editor) | Newline in title |
| `Esc` (inside inline editor) | Cancel without committing the in-progress edit |
| `A` (edge selected) | Add an assumption to the edge |
| `Delete` / `Backspace` | Delete selection (confirms when there are connected edges) |
| `Cmd/Ctrl+C` / `X` / `V` | Copy / cut / paste |
| `Cmd/Ctrl+Shift+→` | Select all successors |
| `Cmd/Ctrl+Shift+←` | Select all predecessors |
| `Cmd/Ctrl+Shift+S` | Swap the two selected entities |
| `Cmd/Ctrl+D` | Duplicate the selection in place (doesn't touch the clipboard) |
| `↑` / `↓` / `←` / `→` (entity selected or focused) | Walk to the connected neighbour in that direction |

## On a selected group

| Shortcut | Action |
| --- | --- |
| `Enter` | Hoist into the group |
| `→` | Expand (if collapsed) |
| `←` | Collapse (if expanded) |
| `Delete` / `Backspace` | Delete the group (members preserved) |

## Document-wide

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl+Z` / `Cmd/Ctrl+Shift+Z` | Undo / redo |
| `Cmd/Ctrl+S` | Save (force a flush + confirmation toast) |
| `Cmd/Ctrl+P` | Print / Save as PDF |
| `Cmd/Ctrl+K` | Open command palette |
| `Cmd/Ctrl+F` | Open find panel |
| `Cmd/Ctrl+\` | Close the inspector (clears the selection) |
| `Cmd/Ctrl+A` | Select every entity in the document |
| `Cmd/Ctrl+,` | Open settings |
| `Cmd/Ctrl+E` | Palette pre-filtered to Export commands |
| `E` (no modifiers, not in text field) | Open Quick Capture |
| `Cmd/Ctrl+T` | New tab *(installed app only)* |
| `Cmd/Ctrl+W` | Close tab *(installed app only)* |
| `Cmd/Ctrl+1`–`9` | Switch to tab 1–9, 9 = last *(installed app only)* |

> *The three tab keys above fire only in an installed PWA (`display-mode: standalone`). In a normal browser tab those keys belong to the browser, so use the palette tab commands below instead.*

## Palette commands worth memorising

| Command | Purpose |
| --- | --- |
| `New diagram…` | Diagram type picker |
| `Load example…` | Example picker |
| `Browse templates…` / `New from template…` | The unified Templates library |
| `Capture snapshot` | Save a revision |
| `Comments` | Review-comments panel toggle |
| `Add comment on selection` | Comment on the selected entity / edge (or the whole diagram) |
| `Start CLR walkthrough` | Iterate open warnings |
| `Start read-through` | Verbalisation overlay |
| `Find core driver(s)` | Highest-reach root cause |
| `Spawn Evaporating Cloud from selected entity` | CRT → EC pivot |
| `Splice entity into selected edge` | Create-and-splice |
| `Group selected edges as AND` / `OR` / `XOR` | Junctor grouping |
| `Group selected entities` | Generic group |
| `Move selection to Archive group` | Quick archive |
| `Toggle EC reading guide` | EC-only |
| `Reopen creation wizard` | If you dismissed and want it back |
| `New tab` / `Duplicate tab` / `Close tab` / `Next tab` / `Previous tab` | Tab management (works in any browser) |
| `Forget closed documents` | Reclaim storage from documents you've closed |
| *(Share button / `Export…` → Share)* | Fragment-encoded share URL |
| `Export` | Open the unified picker |

The complete list is in the palette itself — open `Cmd+K` and scroll. Categories are visible at the right edge of each row.
