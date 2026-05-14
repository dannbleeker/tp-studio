# Scoping — Distribute TP Studio as a PWA on a custom subdomain

**Status:** Spec'd for implementation. Decisions locked Session 88.

## Decisions

| Question | Answer |
|---|---|
| Audience | Public-but-not-discoverable — anyone with the URL can use it, search engines don't index it |
| Hosting | GitHub Pages (free, auto-cert, in-repo deploy) |
| Domain | `tp-studio.struktureretsundfornuft.dk` (CNAME → `dannbleeker.github.io`, already wired) |
| Repo visibility | Public (made public Session 88; no secrets ever committed, confirmed via `git log --all` filter) |
| Update story | **Explicit toast** — "New version available, refresh?" with [Refresh now] / [Later] |
| Offline | First-class — service worker precaches all assets via vite-plugin-pwa defaults |
| App name | TP Studio |
| Theme color | `#6366f1` (indigo-500, matches existing app accent) |
| OG image | Screenshot of the canvas (rendered via Claude Preview on an example EC) |

## Architecture

```
struktureretsundfornuft.dk (existing domain, registrar-managed)
    │
    └── CNAME tp-studio → dannbleeker.github.io  (active, propagated)
            │
            ▼  HTTPS via Let's Encrypt (GitHub Pages auto-provisioned)
        ┌──────────────────────────────────────────────┐
        │ GitHub Pages — static SPA                    │
        │   built from main via GitHub Actions         │
        │   serves: index.html + lazy chunks +         │
        │           manifest.webmanifest + sw.js +     │
        │           icons + robots.txt                 │
        └──────────────────────────────────────────────┘
                          │
                          ▼
              Browser (anyone with the URL)
                          │
        ┌─────────────────┴─────────────────┐
        ▼                                   ▼
  In-browser use                  Install prompt
  (no install required)           (Chrome/Edge offer it)
        │                                   │
        └────────────────┬──────────────────┘
                         │
                         ▼
               On new version push:
               • Service worker fetches new build in background
               • App listens via `useRegisterSW`
               • Toast fires: "New version available, refresh?"
               • User clicks Refresh → page reloads with new SW active
               • User dismisses → next natural reload picks it up anyway
```

## Implementation plan

15 concrete steps; ~4.5 hours focused work; single session.

### 1. Dependencies (5 min)

```
pnpm add -D vite-plugin-pwa workbox-window
```

`vite-plugin-pwa` handles the manifest + service-worker generation. `workbox-window` exposes the registration hook for the toast.

### 2. Wire vite-plugin-pwa into `vite.config.ts` (25 min)

```ts
import { VitePWA } from 'vite-plugin-pwa';

plugins: [
  react(),
  // ... existing checker plugin (dev only) ...
  VitePWA({
    registerType: 'prompt',
    workbox: {
      // Match the project's lazy-chunk shape: precache everything in dist.
      globPatterns: ['**/*.{js,css,html,svg,png,webp,ico,woff2}'],
      // Fall back to index.html for any unresolved navigation — SPA route shape.
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api\//],
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
      // Plugin disables SW in dev by default. Re-enable on demand if
      // we want to debug the SW flow locally; we don't right now.
      enabled: false,
    },
  }),
]
```

### 3. Create icons (30 min)

Four PNG files in `public/`:
- `icon-192.png` — standard, 192×192
- `icon-512.png` — standard, 512×512
- `icon-192-maskable.png` — Android/Windows maskable variant (content in central 80% safe zone)
- `icon-512-maskable.png` — same, 512×512

Design: white "TP" monogram on indigo-500 background, rounded square. Generated programmatically via a small Node script that emits the four PNGs at build time (or pre-generated once and committed). Pre-generate is simpler — commit them.

### 4. Update-prompt toast wiring (30 min)

New file `src/services/pwaUpdate.ts`:

```ts
import { registerSW } from 'virtual:pwa-register';
import { useDocumentStore } from '@/store';

let registered = false;

export const initPwaUpdateToast = (): void => {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  const updateSW = registerSW({
    onNeedRefresh: () => {
      // New version has finished downloading in the background.
      // Surface the toast with an explicit refresh action.
      useDocumentStore.getState().showToast(
        'info',
        'New version of TP Studio is available.',
        {
          action: {
            label: 'Refresh now',
            run: () => {
              void updateSW(true); // Calls skipWaiting + reloads.
            },
          },
        }
      );
    },
    onOfflineReady: () => {
      // First-visit precache complete. Surface a one-time confirmation
      // so the user knows offline-mode is live without extra config.
      useDocumentStore.getState().showToast(
        'success',
        'TP Studio is ready to use offline.'
      );
    },
  });
};
```

Call `initPwaUpdateToast()` from `main.tsx` (the entry file) so registration happens at module load.

### 5. `public/CNAME` (1 min)

One file, one line:

```
tp-studio.struktureretsundfornuft.dk
```

Vite copies `public/*` into `dist/` unchanged; GitHub Pages reads `dist/CNAME` to bind the deploy to the custom domain. (GitHub already created one when we added the domain in the UI — our `public/CNAME` carries the same value so subsequent deploys don't strip it.)

### 6. `public/robots.txt` + noindex meta (10 min)

`public/robots.txt`:

```
User-agent: *
Disallow: /
```

In `index.html` `<head>`:

```html
<meta name="robots" content="noindex, nofollow" />
```

Belt-and-suspenders — search engines respecting either signal won't index. Doesn't prevent direct URL visits.

### 7. OG meta tags in `index.html` (15 min)

```html
<meta property="og:type" content="website" />
<meta property="og:url" content="https://tp-studio.struktureretsundfornuft.dk/" />
<meta property="og:title" content="TP Studio" />
<meta property="og:description" content="Theory of Constraints diagramming tool — Evaporating Clouds, Current Reality Trees, Goal Trees, and more." />
<meta property="og:image" content="https://tp-studio.struktureretsundfornuft.dk/og-image.png" />
<meta name="twitter:card" content="summary_large_image" />
```

`public/og-image.png` is a 1200×630 PNG. Generated by:
1. Spin up the dev server via `mcp__Claude_Preview__preview_start` (already configured at `tp-studio-dev`)
2. Load the EC example doc
3. Resize viewport to 1200×630
4. `mcp__Claude_Preview__preview_screenshot` → save the result to `public/og-image.png`

This step happens during the implementation session, after the rest is wired.

### 8. GitHub Actions deploy workflow (25 min)

New file `.github/workflows/deploy-pages.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Triggers on every push to `main`. Deploys to the Pages target configured in repo settings (which is now active per the manual setup).

### 9. Optional "Install TP Studio" palette command (30 min)

`vite-plugin-pwa` doesn't directly expose the install prompt. We hook into the browser's `beforeinstallprompt` event ourselves:

```ts
// src/services/pwaInstall.ts
let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export const triggerInstallPrompt = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
};
```

New palette command in `src/components/command-palette/commands/`:

```ts
{
  id: 'install-app',
  label: 'Install TP Studio…',
  group: 'Help',
  run: async (s) => {
    const result = await triggerInstallPrompt();
    if (result === 'accepted') s.showToast('success', 'TP Studio installed.');
    else if (result === 'dismissed') s.showToast('info', 'Install cancelled.');
    else s.showToast('info', 'Install prompt not available yet — visit a few times first.');
  },
},
```

The browser only fires `beforeinstallprompt` once it considers the user "engaged" with the site (Chrome's heuristic involves time spent, repeat visits, or PWA criteria met). When the event hasn't fired yet, the palette command toasts a helpful message.

### 10. Tests (30 min)

`tests/services/pwaUpdate.test.ts` — mock `virtual:pwa-register`, fire the `onNeedRefresh` callback, assert the toast appears with the right action. Mock the SW registration since `virtual:` modules aren't available in vitest by default — alias them in `vite.config.ts` test section.

### 11. README + USER_GUIDE updates (20 min)

`README.md`:
- Add a top-of-file "Live demo" section pointing at the URL
- Add an install note: "Chrome / Edge will offer an install prompt after a few visits — click Install to get a desktop app with offline support."

`USER_GUIDE.md`:
- Section "Using TP Studio offline" explaining how PWAs work + that the docs live in localStorage so they persist across launches

### 12. CHANGELOG + NEXT_STEPS (15 min)

`CHANGELOG.md` — new `## Session 88 — PWA + custom-domain distribution` entry summarizing the change.

`NEXT_STEPS.md` — strike through "Make the tool installable" placeholder with `~~item~~` + ✅ Done (Session 88) tag.

### 13. Full quality gates (15 min)

`tsc --noEmit`, full vitest run, `pnpm build` (verify `dist/sw.js` and `dist/manifest.webmanifest` exist), `biome check src tests`. All clean.

### 14. Commit + push (10 min)

One commit, Conventional Commits, heredoc body, `Co-Authored-By: Claude Opus 4.7 (1M context)` trailer. Push to main.

### 15. Watch CI + verify deploy (30 min)

Two CI runs fire:
1. The existing CI workflow (lint / types / tests / build)
2. The new deploy workflow (build + deploy-pages)

Both should land green. Then visit `https://tp-studio.struktureretsundfornuft.dk/` — app should load.

Final manual sanity checks (you do these, the agent can't):
- Open the URL → app loads, theme picker works, EC example loads
- DevTools → Application → Service Workers — should show `sw.js` as `activated and running`
- DevTools → Network → Offline → reload the page → app still loads (offline cache active)
- DevTools → Lighthouse → PWA audit — should score 100/100 or close

## Risks

| Risk | Mitigation |
|---|---|
| `virtual:pwa-register` module not resolvable in vitest | Add a test-side alias to `vitest.config` resolving `virtual:pwa-register` to a stub |
| Service worker debug-loop on dev server | Plugin defaults to `devOptions.enabled: false`; we keep that |
| iOS Safari weak PWA install prompt | Out of scope — Android/Windows/macOS Chrome+Edge install fine |
| Corporate firewall blocks SW | App degrades to plain SaaS; no offline, no install. Still works |
| First-deploy hits a Vite config error | Quality gates run pre-push; CI catches what local doesn't |
| Bundle grows past budget on SW addition | `sw.js` itself is small (~5 KB gz); precache list is a JSON manifest. Budget unaffected |

## Anti-scope (not in this session)

- Analytics (you said no)
- Auth / password gate (URL-obscurity is the gate; can add Cloudflare Access later if needed)
- A backend (would defeat the model)
- Push notifications (TP Studio has no async events to notify on)
- Background sync (no remote data to sync)
- Apple-touch-icon polish (basic icon set is enough; can iterate)

## Deliverable

After the session ships and CI lands green:
- `https://tp-studio.struktureretsundfornuft.dk/` serves the live app
- Anyone with the URL can use it; not in Google
- Chrome/Edge offer Install after a couple of visits
- Once installed (or on second visit), works fully offline
- Pushing to `main` triggers an auto-deploy
- Refresh-toast appears on any new version
