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
 * This test grep-walks `src/` and asserts the contract:
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
 * Test runs against the file system, not against built output — fast
 * (~10 ms) and doesn't require a build to have happened.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(__dirname, '..', '..', 'src');

const collectFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      collectFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

describe('dagre lazy-load static-import boundary (Session 99)', () => {
  const files = collectFiles(SRC_ROOT);

  it('only src/domain/layout.ts statically imports `dagre`', () => {
    // Match `from 'dagre'` or `from "dagre"` (also `import 'dagre'`
    // bare side-effect imports, though we have none today).
    const re = /\bfrom\s+['"]dagre['"]|^\s*import\s+['"]dagre['"]/m;
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (re.test(content) && !file.replace(/\\/g, '/').endsWith('src/domain/layout.ts')) {
        offenders.push(file);
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
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (re.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
