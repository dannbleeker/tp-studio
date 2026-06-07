/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { VitePWA } from 'vite-plugin-pwa';

const here = path.dirname(fileURLToPath(import.meta.url));

// Session 111 — About TP Studio dialog needs build-time metadata
// (version, build date, copyright string). Read `package.json` once
// and compute the copyright years string from the current calendar
// year: "2026" through Dec 31 2026, then "2026–2027" from Jan 1 2027,
// "2026–2028" from Jan 1 2028, etc. Auto-rolls forward every January
// without any code edit — each new production build picks it up.
const pkg = JSON.parse(readFileSync(path.join(here, 'package.json'), 'utf8')) as {
  version: string;
};
const __APP_VERSION__ = pkg.version;
const __BUILD_DATE__ = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const __COPYRIGHT_YEARS__ = (() => {
  const y = new Date().getFullYear();
  return y <= 2026 ? '2026' : `2026–${y}`;
})();

// Session 136 — surface the latest security-audit pointer in the
// About dialog so it auto-refreshes whenever SECURITY.md's "Last
// reviewed" line changes. Extract just the `Session N (YYYY-MM-DD)`
// segment of that line — the bullet keeps the trail short. The
// fallback covers the case where SECURITY.md is missing or the line
// shape changed; we don't want a missing audit string to fail the
// build.
const __SECURITY_AUDIT_LABEL__ = (() => {
  try {
    const md = readFileSync(path.join(here, 'SECURITY.md'), 'utf8');
    const m = md.match(/^Last reviewed:\s*(Session\s+\d+\s*\([\d-]+\))/m);
    return m ? m[1] : 'see Security & threat model';
  } catch {
    return 'see Security & threat model';
  }
})();

export default defineConfig(({ command, mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(__APP_VERSION__),
    __BUILD_DATE__: JSON.stringify(__BUILD_DATE__),
    __COPYRIGHT_YEARS__: JSON.stringify(__COPYRIGHT_YEARS__),
    __SECURITY_AUDIT_LABEL__: JSON.stringify(__SECURITY_AUDIT_LABEL__),
  },
  // Session 85 / #18 — vite-plugin-checker runs `tsc --noEmit` (and
  // Biome lint) in a worker alongside the dev server and surfaces
  // errors as a browser overlay. Without it, type errors are only
  // caught at `pnpm build` time (or by the editor's own tsserver,
  // which can lag). Dev-only — `pnpm build` already runs `tsc
  // --noEmit` ahead of `vite build`, so adding the checker plugin
  // there would just duplicate the work. The `command === 'serve'`
  // guard keeps the build step's plugin list untouched.
  plugins: [
    // Session 118 enabled the React Compiler (`babel-plugin-react-
    // compiler`). Session 119 disabled it again after the perf-trace
    // comparison against Session 108's baseline showed mixed results:
    //
    //   • all-actions p95: 5.68 → 3.09 ms (−45%, win)
    //   • edit-heavy p95: 9.10 → 17.21 ms (+89%, loss)
    //   • +24 KB gz on the eager index chunk
    //   • Two CI e2e regressions (delete-flow + chapter14 screenshot
    //     both timed out on `getByRole('button')` clicks — the kind of
    //     interaction the Compiler's auto-memoization could perturb)
    //
    // For our specific workload — a doc-editing app where rapid
    // small mutations are the hot path — the Compiler's instrumentation
    // overhead doesn't pay back the win it delivers on rarer
    // interaction patterns. The plugin install + this config stays in
    // the tree as a one-line opt-in for a future re-evaluation when
    // either the Compiler matures further or our hot path shifts.
    //
    // To re-enable: uncomment the `babel.plugins` line below.
    react({
      // babel: {
      //   plugins: [['babel-plugin-react-compiler', { target: '19' }]],
      // },
    }),
    // Session 126 — Tailwind v4 Vite plugin. Replaces v3's
    // postcss-plugin + autoprefixer pair. Reads the CSS-first config
    // from `src/styles/index.css`'s `@theme` block.
    tailwindcss(),
    // Session 114 — `rollup-plugin-visualizer` emits a
    // `dist/bundle-stats.html` treemap. Session 135 / Perf #14 — gate it
    // behind `--mode analyze` (run via `pnpm visualize`) so the normal
    // `pnpm build` (and CI) skip the treemap emit entirely rather than
    // paying ~50 ms + writing a ~1.6 MB HTML file on every build. Using
    // Vite's `--mode` keeps this cross-platform (no shell env-var
    // syntax). The HTML file is gitignored.
    ...(mode === 'analyze'
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }),
        ]
      : []),
    ...(command === 'serve'
      ? [
          checker({
            typescript: true,
            biome: { command: 'check', flags: '' },
            // Overlay defaults to on; setting it explicit makes the
            // intent obvious and pins the contract if future plugin
            // versions flip the default.
            overlay: { initialIsOpen: false },
          }),
        ]
      : []),
    // Session 89 — PWA wiring. `registerType: 'prompt'` means we
    // surface an explicit "New version available" toast (via
    // `src/services/pwaUpdate.ts`) instead of force-reloading the
    // tab when a new SW lands. The precache glob covers every asset
    // type the build emits today (JS / CSS / HTML / icons / fonts);
    // `navigateFallback` makes the SW behave correctly for an SPA so
    // any deep link served by GitHub Pages falls back to index.html.
    // Dev-mode SW is disabled — the plugin's defaults caused a
    // confusing reload loop in earlier prototypes and we have no
    // reason to debug the SW flow during normal dev.
    VitePWA({
      registerType: 'prompt',
      workbox: {
        // Session 136 — `.pdf` + `.epub` added so the book artifacts
        // (`docs/guide/Causal-Thinking-with-TP-Studio.{pdf,epub}`,
        // copied into `public/` by `scripts/build-docs-bundle.mjs`)
        // pre-cache on install rather than waiting for the user to
        // open the book online first. Dann's offline-on-a-plane
        // repro: the runtimeCaching rule below was hit on first open
        // — but only AFTER an online visit. Pre-caching trades ~1 MB
        // of cold-install bandwidth for a guaranteed offline-from-
        // first-launch story. The matching `.epub` was completely
        // uncached before; now it's bundled with the rest of the
        // shell.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2,pdf,epub}'],
        // Bump the per-file cache ceiling so the larger PDF (~1 MB)
        // fits the precache. Default is 2 MB; we set 4 MB explicitly
        // both for headroom and as documentation that the book is
        // the largest precached artifact.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Session 114 — exclude the bundle-stats.html treemap emitted
        // by rollup-plugin-visualizer (~1.6 MB, dev-only artifact).
        // Session 132 / Tier 3 #31 — also exclude the PDF-export
        // vendor trio. jspdf, html2canvas, and svg2pdf together add
        // up to ~672 KB raw (~220 KB gz) of bytes that 95% of users
        // never touch on first visit. They're lazy-loaded behind the
        // export menu and runtime-cached below so the first export
        // still works offline once the user has performed it once.
        // The win is the cold first-visit precache download for
        // users who never export.
        //
        // Session 134 — pptxgen joins the vendor exclusion list when
        // PowerPoint export shipped (~368 KB raw / ~123 KB gz). Same
        // logic: lazy-loaded behind the Export… picker; runtime-cached
        // below for offline use after first invocation.
        globIgnores: [
          'bundle-stats.html',
          'assets/jspdf*.js',
          'assets/html2canvas*.js',
          'assets/svg2pdf*.js',
          'assets/pptxgen*.js',
          // Session 135 / Perf #34 — the MarkdownPreview chunk bundles
          // micromark + the GFM extensions + DOMPurify (~75 KB raw /
          // ~25 KB gz). It's lazy-loaded behind the description
          // markdown-preview toggle, which most first-time visitors
          // never open. Keep it out of the cold precache; the
          // runtimeCaching rule below serves it offline after first use.
          // (The small dialog chunks — CommandPalette, PatternLibrary,
          // Walkthrough — stay precached: they're core UX and only a few
          // KB each, so deferring them would risk offline-first breakage
          // for no meaningful bandwidth gain.)
          'assets/MarkdownPreview*.js',
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        // Session 114 — runtime-cache the practitioner book PDF
        // (`Causal-Thinking-with-TP-Studio.pdf`). The PDF is ~1 MB; we
        // deliberately keep it out of the precache `globPatterns` so
        // the first-visit download isn't bloated by a doc that most
        // users won't immediately open. But when a user does open it
        // (from the AboutDialog), workbox now caches the response so
        // subsequent visits — including offline ones — serve from the
        // SW. `CacheFirst` because the PDF only changes when we
        // rebuild + redeploy, in which case Vite's hashed-asset
        // pipeline normally invalidates the cache; for a name-stable
        // path like this one we cap the cache age explicitly so
        // stale-but-valid responses don't linger forever.
        //
        // Session 132 / Tier 3 #31 — same pattern applied to the
        // PDF-export vendor chunks. The chunks are content-hashed by
        // Vite, so a redeploy emits a new filename and the SW fetches
        // the new chunk on demand; the cached old one ages out.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.endsWith('.pdf'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tp-studio-pdf-v1',
              expiration: {
                maxEntries: 4,
                // 30 days; long enough to be useful offline, short
                // enough that a rare rebuild eventually propagates.
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
          {
            // Hashed asset filenames keep this regex stable across rebuilds.
            // Perf #34 adds MarkdownPreview (micromark + DOMPurify) to the
            // on-demand vendor set — precache-excluded above, fetched +
            // cached the first time the markdown preview is opened.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /\/assets\/(jspdf|html2canvas|svg2pdf|pptxgen|MarkdownPreview)/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tp-studio-export-vendor-v1',
              expiration: {
                // 10 = jspdf + html2canvas + svg2pdf + pptxgen +
                // MarkdownPreview + a few older hashed names while a
                // deploy ages out.
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      manifest: {
        name: 'TP Studio',
        short_name: 'TP Studio',
        description:
          'Theory of Constraints diagramming tool — CRTs, FRTs, PRTs, TTs, Goal Trees, and Evaporating Clouds.',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      // Session 89 — `virtual:pwa-register` is a virtual module
      // generated by `vite-plugin-pwa`; vitest's transform pipeline
      // can't resolve it during unit tests. Alias it to a small stub
      // in tests/ so the import resolves without dragging the real
      // SW registration code into jsdom.
      ...(process.env.VITEST
        ? { 'virtual:pwa-register': path.join(here, 'tests', 'stubs', 'virtual-pwa-register.ts') }
        : {}),
    },
  },
  // Session 126 — Tailwind v4 ships its own Vite plugin
  // (`@tailwindcss/vite`) that replaces the v3 postcss-plugin + autoprefixer
  // pair. The plugin reads the CSS-first config from `src/styles/index.css`
  // (`@theme` block) and handles vendor-prefixing internally.
  build: {
    // Split heavy vendor libs into their own chunks so a feature commit
    // only invalidates one chunk's cache, and html-to-image (only used by
    // the PNG exporter) ships as a separate chunk that loads on demand.
    rollupOptions: {
      output: {
        // Session 125 — Vite 8 ships Rolldown by default; its manualChunks
        // API expects a function, not an object map. The function form is
        // also more flexible (we can match on path substrings, not just
        // exact package names). Each branch must return the same name we
        // used in the object form so `bundle-budget.json` continues to
        // measure the same chunks.
        //
        // Session 118 — `react-dom/client` matched explicitly. In React 19
        // the createRoot renderer lives at `react-dom/client`; without this,
        // `cjs/react-dom-client.production.js` (~93 KB gz) leaks into the
        // index chunk because the bundler doesn't auto-resolve subpath
        // exports into the parent package's chunk.
        //
        // Session 81 — `dagre` deliberately NOT pinned to the flow chunk so
        // it can be code-split. `useGraphPositions` lazy-loads
        // `@/domain/layout` via `await import()`, which lets the bundler
        // place dagre in its own chunk that only loads when an auto-layout
        // diagram (non-EC) is first laid out. ~25 KB gz off the eager
        // critical path.
        manualChunks: (id) => {
          if (id.includes('node_modules/react-dom/') || id.includes('node_modules/react/')) {
            return 'react';
          }
          if (id.includes('node_modules/@xyflow/react/')) return 'flow';
          // Session 135 / Perf #13 — `lucide-react` is deliberately NOT
          // pinned to its own chunk anymore. The old `return 'icons'`
          // forced *every* imported icon — including ones used only by
          // lazy dialogs (Settings / History / Export) — into a single
          // chunk that the eager index pulls in, so the whole catalogue
          // loaded on first paint. Letting Rollup co-locate each icon
          // with its consuming chunk pushes lazy-only icons into their
          // lazy chunks and keeps just the eagerly-used glyphs in index;
          // measured eager index dropped ~16 KB gz (86 → 70).
          return undefined;
        },
      },
    },
  },
  // Session 84 — persist Vitest's transform cache across runs so the
  // dev-loop `pnpm test:watch` and the explicit `pnpm test` skip
  // recompiling unchanged files. ~50s cold run drops to ~5–10s warm.
  // The cache dir is gitignored alongside `dist/` and `coverage/`.
  //
  // Session 125 — vitest 4 moved this from `test.cache.dir` to the top-level
  // Vite `cacheDir`. Using the Vite key directly avoids the v4 deprecation
  // warning while keeping the same on-disk location.
  cacheDir: 'node_modules/.cache/vitest',
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Session 130 — flag slow tests so a future regression doesn't hide
    // inside the perf-bench files. The validators perf-bench runs ~6 s
    // (intentionally — it's a 10k-iteration report); 5000 ms is generous
    // enough to skip that one while catching unintended slowdowns in the
    // domain / store / component suites.
    slowTestThreshold: 5000,
    coverage: {
      // V8 is the bundled provider — no extra dep to install. JSON + text
      // covers both human reading and tooling consumers (codecov etc.).
      provider: 'v8',
      // `json-summary` produces `coverage/coverage-summary.json`, which
      // `scripts/pin-coverage-thresholds.mjs` reads to update the
      // measured floor. The plain `json` reporter (full details) is
      // kept for IDE consumers / external tools.
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx', // entry shim — covered transitively
        'src/vite-env.d.ts',
      ],
      // Coverage thresholds are deliberately a *floor* — they fail CI
      // if coverage drops below these numbers. Workflow for tightening:
      //
      //   1. Run `pnpm test:coverage` locally.
      //   2. Read the bottom-of-output summary table (per-metric %).
      //   3. Replace the numbers below with (measured % − 2) so future
      //      drift is caught while leaving 2% slop for noise.
      //   4. Commit; CI now guards the new floor.
      //
      // Today's numbers are the conservative starting set — actual
      // measured coverage on a green run should exceed them. Bump after
      // the first CI run with `@vitest/coverage-v8` installed reports
      // the real baseline.
      thresholds: {
        lines: 94,
        statements: 92,
        functions: 92,
        branches: 82,
      },
    },
  },
}));
