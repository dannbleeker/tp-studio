import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The live dashboard (`public/dashboard.html`) is a self-contained static page
 * served at `/dashboard.html` — it lives OUTSIDE the React app and the type
 * system, so a renamed element id or a dropped data fetch would silently break
 * it with nothing else catching it. This guards the HTML ↔ inline-JS contract:
 *
 *   - the element ids the inline script writes into still exist in the markup,
 *   - the page still fetches its data (stats.json / stats-history.json), and
 *   - the loaders are still wired to `window.load`.
 *
 * The full browser-load behaviour (metrics actually populate, no JS errors) is
 * covered end-to-end in `e2e/dashboard.spec.ts`.
 */
// Resolved from the repo root (vitest's cwd) so the read works regardless of
// how the test module's URL is rewritten by the transform pipeline.
const html = readFileSync(join(process.cwd(), 'public', 'dashboard.html'), 'utf8');

describe('dashboard.html — structure', () => {
  it('is a complete HTML document titled for TP Studio', () => {
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toMatch(/<title>[^<]*TP Studio[^<]*<\/title>/i);
  });

  it('reads its CI metrics from the published stats JSON', () => {
    expect(html).toContain("fetchJson('public/stats.json')");
    expect(html).toContain("fetchJson('public/stats-history.json')");
  });

  it('pulls live repo data from the GitHub API', () => {
    expect(html).toContain('api.github.com');
  });

  it('kicks off both loaders on window load', () => {
    expect(html).toMatch(/addEventListener\(\s*['"]load['"]/);
    expect(html).toContain('loadLive()');
    expect(html).toContain('loadStats()');
  });

  it('degrades gracefully when the live fetch fails', () => {
    // The catch arm must keep the page usable rather than throwing at the user.
    expect(html).toContain('live fetch unavailable');
  });

  // Every id below is BOTH placed in the markup (`id="x"`) and targeted by the
  // inline script (`'x'`). If either side is renamed without the other, a panel
  // silently renders blank — this catches that drift.
  const WIRED_IDS = [
    // headline + live (GitHub API)
    's-age',
    's-7d',
    's-30d',
    's-push',
    's-prs',
    's-issues',
    'gh-commit',
    'commit-list',
    'pr-list',
    // CI metrics (stats.json)
    'stats-pending',
    'stats-body',
    'm-lines',
    'm-tests',
    'm-cov',
    'm-files',
    'code-rows',
    'cov-bars',
    'domain-chips',
    'bigfiles',
    // charts (canvas targets passed to dough()/bar())
    'activityChart',
    'typeChart',
    'authorChart',
    'dowChart',
    'hourChart',
    'prChart',
    'prSplitChart',
    'codeChart',
  ];

  it.each(WIRED_IDS)('keeps the "%s" element wired to the script', (id) => {
    expect(html, `markup is missing id="${id}"`).toContain(`id="${id}"`);
    expect(html, `inline script no longer targets '${id}'`).toContain(`'${id}'`);
  });
});
