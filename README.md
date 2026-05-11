# TP Studio

A focused, modern alternative to Flying Logic for **Theory of Constraints Thinking Process** diagrams. Build sufficiency-logic graphs (Current Reality Trees, Future Reality Trees), let the tool auto-layout, and surface Categories of Legitimate Reservation (CLR) as soft warnings.

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

| Command         | What it does                  |
| --------------- | ----------------------------- |
| `pnpm dev`      | Start Vite dev server         |
| `pnpm build`    | Type-check + production build |
| `pnpm preview`  | Preview the production build  |
| `pnpm test`     | Run Vitest test suite once    |
| `pnpm test:watch` | Vitest in watch mode        |
| `pnpm lint`     | Biome lint                    |
| `pnpm format`   | Biome format (write)          |

## Data model

The model is a typed directed graph. One canonical schema; diagram types (CRT, FRT) are projections of it. See [src/domain/types.ts](src/domain/types.ts).

Key shape decisions:

- **AND-junctions are not separate nodes.** They are an attribute on a group of edges sharing a target (`andGroupId`). The renderer draws the visual junction.
- **Assumptions are first-class entities** (type `'assumption'`) attachable to edges via `assumptionIds`.

## Status

v1 in progress. Domain layer first, then canvas, inspector, command palette, export.
