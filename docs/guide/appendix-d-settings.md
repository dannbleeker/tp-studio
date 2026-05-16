# Appendix D — Settings reference

> *Everything in `Cmd+K → Open settings`, what it does, when to flip it.*

## Appearance

| Setting | Default | What it does | When to change |
| --- | --- | --- | --- |
| Theme | Light | Light, Dark (4 dark variants: Coal / Navy / Rust / Ayu), High-contrast | Dark for evening work; High-contrast for accessibility / projector use. |
| Animation speed | Normal | Off / Slow / Normal / Fast | Off for screen recordings; Fast for keyboard-driven work. |
| Show minimap | Off | Toggles the bottom-right minimap with viewport indicator | On for large diagrams; off for clean exports. |
| Edge color palette | Default | Default / Colorblind-safe (Wong palette) / Monochrome | Colorblind-safe in mixed-audience workshops. Monochrome for print. |

## Display

| Setting | Default | What it does |
| --- | --- | --- |
| Causality reading | Auto | none / because / therefore / auto (per-diagram-type) — fallback edge label when no per-edge label is set. See [Chapter 3](03-reading-a-diagram.md). |
| Show UDE-reach badge | Off | Toggles the amber `→N UDEs` pill on each entity. |
| Show reverse-reach badge | Off | Toggles the sky `←N root causes` pill. |
| Show annotation numbers | Off | Renders each entity's `annotationNumber` as a small badge. |
| Show entity IDs | Off | Renders the entity's stable id as a tiny corner badge. Mostly for debugging. |

## Behavior

| Setting | Default | What it does |
| --- | --- | --- |
| Default layout direction | Bottom → Top | BT / TB / LR / RL — for newly-created CRT/FRT/PRT/TT/Goal Tree/S&T docs. EC ignores this (manual layout). |
| Show creation wizard for Goal Trees | On | Auto-open the wizard on new Goal Tree docs. |
| Show creation wizard for ECs | On | Auto-open the wizard on new EC docs. |
| Show selection toolbar | On | The floating 3-5 verbs above selected entities. |

## Layout

| Setting | Default | What it does |
| --- | --- | --- |
| Bias | 0.5 | Dagre layout bias parameter — affects horizontal pull. |
| Compactness | Default | Slider — denser packing vs. more breathing room. |

## Behavior — advanced

| Setting | Default | What it does |
| --- | --- | --- |
| Browse Lock on share-link receive | On | Auto-engage Browse Lock when loading a `#!share=` URL. |
| EC chrome collapsed | On | Hide the EC reading-instructions + verbalisation strips by default. Toggle via `Cmd+K → Toggle EC reading guide` when you want them back for a workshop. |
| System scope nudge | Off | Show a soft toast on every CRT load reminding you to fill System Scope. (Most users find this intrusive; off by default.) |
