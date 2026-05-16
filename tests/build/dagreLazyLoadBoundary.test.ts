/**
 * Session 99 — Static-import boundary guard for the dagre lazy load.
 *
 * Session 81 split dagre into its own chunk by having
 * `useGraphPositions` lazy-load `@/domain/layout` via `await import()`.
 * That split survives only as long as nothing in `src/` statically
 * imports either `dagre` or `@/domain/layout` (since a static import
 * would let Rollup pull the module into whatever chunk the importer
 * lands in).
 *
 * This test scans every `.ts` / `.tsx` file in `src/` and asserts the
 * contract:
 *   - `dagre` is only imported statically from `src/domain/layout.ts`
 *     (the deliberate dependency boundary).
 *   - `@/domain/layout` is only imported dynamically (`await import()`)
 *     or as `typeof import(...)` for type-only references. No `import
 *     { ... } from '@/domain/layout'` allowed in `src/`.
 *
 * If a future change adds a static import, this test fails with the
 * offending file path so the regression is caught before it ships.
 * The fix is either (a) make the import dynamic, or (b) deliberately
 * accept the lazy-load is gone and update both the test and the
 * `vite.config.ts` comment.
 *
 * Uses Vite's `import.meta.glob` so the test stays in the same
 * Vite/Vitest transform pipeline as the rest of the suite — no
 * `@types/node` dependency, no `node:fs` imports that fail to
 * type-check under the project's tsconfig.
 */
import { describe, expect, it } from 'vitest';

const SRC_FILES = import.meta.glob<string>('/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('dagre lazy-load static-import boundary (Session 99)', () => {
  it('only src/domain/layout.ts statically imports `dagre`', () => {
    // Match `from 'dagre'` or `from "dagre"`. Also catches bare
    // side-effect imports `import 'dagre'` (none today, but cheap
    // to defend against).
    const re = /\bfrom\s+['"]dagre['"]|^\s*import\s+['"]dagre['"]/m;
    const offenders: string[] = [];
    for (const [path, content] of Object.entries(SRC_FILES)) {
      if (re.test(content) && path !== '/src/domain/layout.ts') {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no static `import ... from "@/domain/layout"` in src/', () => {
    // Allowed: `await import('@/domain/layout')` (dynamic; the lazy
    // load) and `typeof import('@/domain/layout')` (type-only; zero
    // runtime cost — Rollup tree-shakes types completely). Forbidden:
    // any bare `from '@/domain/layout'` form.
    const re = /\bfrom\s+['"]@\/domain\/layout['"]/m;
    const offenders: string[] = [];
    for (const [path, content] of Object.entries(SRC_FILES)) {
      if (re.test(content)) offenders.push(path);
    }
    expect(offenders).toEqual([]);
  });
});
