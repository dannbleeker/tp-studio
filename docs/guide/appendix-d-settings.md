# Appendix D — Settings reference

> *Everything in the Settings dialog (`Cmd/Ctrl+,`, or `Cmd+K → Settings…`), what it does, when to flip it. Four tabs: Appearance, Behavior, Display, Layout — the first three are app-wide preferences; Layout is per-document.*

## Appearance

| Setting | Default | What it does | When to change |
| --- | --- | --- | --- |
| Theme | Light | Light, Dark, High contrast, plus four dark variants: Rust / Coal / Navy / Ayu | Dark for evening work; High contrast for accessibility / projector use. |
| Color palette | Default | Default / Colorblind-safe (Wong palette) / Monochrome — recolours node stripes, edges, the minimap, and the building-blocks rail together | Colorblind-safe in mixed-audience workshops. Monochrome for print. |

## Behavior

| Setting | Default | What it does |
| --- | --- | --- |
| Animation speed | Normal | Instant / Slow / Normal / Fast. Normal follows the OS "reduce motion" accessibility hint; Instant skips fades entirely (good for screen recordings). |
| Browse Lock | Off | The read-only mode — same toggle as the ⋮ overflow's *Lock for browsing*. |
| Auto-snapshot while editing | On | Periodic `Auto` revision snapshots while you edit (only when the tree actually changed). See [Chapter 14](14-iteration-revisions-branches.md). |
| Creation wizards — Goal Tree | On | Auto-open the wizard on new Goal Tree docs. |
| Creation wizards — Evaporating Cloud | On | Auto-open the wizard on new EC docs. |
| Creation wizards — Current Reality Tree | On | Auto-open the wizard (capture your first three UDEs) on new CRT docs. |
| Selection toolbar | On | The floating 3–5 verbs above selected entities. |
| Open documents in new tabs | On | Importing, or loading a template / example / shared link, opens a new tab instead of replacing the current document. Off restores the pre-tabs "replace what's open" behaviour. |

## Display

| Setting | Default | What it does |
| --- | --- | --- |
| Show annotation numbers | Off | Renders each entity's `annotationNumber` as a small badge. |
| Show entity IDs | Off | Renders the entity's stable id as a tiny corner badge. Mostly for debugging. |
| Grow cards to fit text | Off | Lets an entity card grow taller (up to six lines) to show its full title instead of clamping to two. |
| Show UDE-reach badge | Off | Toggles the amber `→N UDEs` pill on each entity. |
| Show root-cause-reach badge | Off | Toggles the sky `←N root causes` pill. |
| Show action-eligibility badge | Off | Toggles the ✓ / ✗ / … eligibility pill on Transition-Tree Action nodes. Off by default — fresh TTs read "pending" everywhere until states are set. |
| Show minimap | On | Toggles the minimap with viewport indicator (node thumbnails tinted by entity type). |
| Ink-saving print mode | Off | Removes group fills and lightens strokes for cheaper printing. |
| Causality reading | Auto | None / Auto / Because / Therefore / In order to — fallback edge label when no per-edge label is set. See [Chapter 3](03-reading-a-diagram.md). |
| Default direction for new documents | Auto | Auto / Bottom→Top / Top→Bottom / Left→Right / Right→Left — the starting orientation for newly-created docs. Existing docs keep their own per-doc direction (change that on the Layout tab). EC ignores this (manual layout). |
| Layout density | Balanced | Compact / Balanced / Spacious — how tightly auto-layout packs the tree. |
| Edge routing | Smart | Smart (route around obstacles) / Direct (plain bezier curves through anything). |

## Layout (per-document)

Unlike the other tabs, these settings live **on the current document**, and only apply to auto-laid-out diagrams (CRT / FRT / PRT / TT / Goal Tree / S&T / NBR). Hand-positioned diagrams (EC, freeform) show an explanatory note instead.

| Setting | Default | What it does |
| --- | --- | --- |
| Direction | (per doc) | Bottom→Top / Top→Bottom / Left→Right / Right→Left — this is where you change an *existing* diagram's orientation. |
| Compactness | 50 | 0–100 slider — denser packing vs. more breathing room. |
| Bias | Auto | Auto, or gravitate the tree toward one corner: Upper-left / Upper-right / Lower-left / Lower-right. |
| Reset to defaults | — | Appears when any of the above is overridden; clears the per-doc overrides. |

The footer's **Restore defaults** button (confirm-gated) resets every app-wide preference at once.
