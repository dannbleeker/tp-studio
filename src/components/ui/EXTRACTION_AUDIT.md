# `ui/` extraction audit

Working notes behind the [extraction readiness guide](./README.md). Captures the
state of `src/components/ui/`, `src/domain/tokens.ts`, `src/styles/`, and the
hooks `ui/` depends on, ahead of vendoring a shared `@studio/ui` + `@studio/tokens`
package into `mece-studio` and `mindmap-studio` via automated git sync.

Scope of this pass: **audit + the one ConfirmDialog refactor.** No packages were
created, no build config touched, no code extracted.

---

## 1. Store-coupling audit

**Method:** scanned every file under `src/components/ui/` and `src/domain/tokens.ts`
for `@/store`, `useDocumentStore`, and `zustand` imports.

### Findings

| File | Store import before | Disposition |
| --- | --- | --- |
| `ConfirmDialog.tsx` | `useDocumentStore((s) => s.confirmDialog)`, `useDocumentStore((s) => s.resolveConfirm)` (2 selectors; the component also derived `open`/`message`/`confirmLabel`/`cancelLabel` from `confirmDialog`) | **Refactored** — now a pure, prop-driven shell. The store wiring moved to a new app-layer host, `src/components/ConfirmDialogHost.tsx`. See §4. |
| every other file in `ui/` | none | Already store-free. |
| `src/domain/tokens.ts` | none (only a type import: `EntityType` from `./types`) | Pure data. The `EntityType`-keyed records (`ENTITY_STRIPE_COLOR`) are **domain-shaped**, not store-coupled — they're a static map, no React, no Zustand. For extraction this means `@studio/tokens` either ships the generic tokens (palettes, surfaces, accent) and leaves the TP-specific `ENTITY_STRIPE_COLOR` behind, or carries a generic version keyed by the consumer's own entity enum. Noted, left as-is. |

**Result after the refactor: zero `useDocumentStore` / `@/store` / `zustand`
imports anywhere in `src/components/ui/`.** The rule in the README is now true and
enforceable.

### Why ConfirmDialog needed the store (and why it was refactorable)

The two selectors were pure **UI state** ("is a confirm prompt open, and what does
it say"), not domain logic. That's exactly the case the brief says to refactor to
props. The async `confirm(): Promise<boolean>` plumbing is genuinely app logic, so
it stays in the store — but it now lives behind an app-layer host instead of
inside the primitive. The primitive renders and reports a choice; the host owns the
promise.

---

## 2. Tokens audit

**Method:** searched `src/components/ui/` and `src/styles/` for raw hex (`#rgb` /
`#rrggbb`), `rgb(` / `rgba(`, and magic spacing/radius numbers, cross-checked
against `src/domain/tokens.ts` and the Tailwind `@theme` block in
`src/styles/index.css`.

### `ui/` components — clean ✓

No hardcoded hex or `rgb()/rgba()` anywhere in `src/components/ui/`. Colour comes
from one of two sanctioned sources:

- **Tailwind palette utilities** (`indigo-500`, `neutral-200`, `red-700`, …) — these
  resolve from Tailwind's theme, not inline literals.
- **Caller-supplied tokens** — `ButtonGroup`'s `style={{ backgroundColor: opt.stripe }}`
  takes its colour from a prop; call sites pass values from
  `tokens.ts#ENTITY_STRIPE_COLOR`. The primitive itself hardcodes nothing.

Radii/spacing are Tailwind scale utilities (`rounded-md`, `px-3`, `gap-2`), not magic
pixel values. The lone exception is intentional design tokens already centralised in
class-constant modules (`buttonClasses.ts`, `focusClasses.ts`, `textClasses.ts`).

### Accent colour — now a semantic token ✅ (resolved)

Previously every primitive hard-coded the **indigo** accent as Tailwind utility
classes, with no single re-skin knob. **Resolved by the app-wide accent-token
refactor:**

- A full `accent` colour scale (`--color-accent-50…950`, = the old indigo values) is
  defined in the `@theme` block of `src/styles/index.css`, generating
  `bg-accent-*` / `text-accent-*` / `ring-accent-*` / `border-accent-*` (with
  `/opacity` + `dark:` support). `tokens.ts` carries the paired `ACCENT` (=
  `--color-accent-500`) for JS/SVG/export contexts.
- **157 `indigo-*` utility lines across 66 files** were swept to `accent-*`, and the
  raw indigo hex/rgb literals (CSS `index.css` + JS `JunctorOverlay` / `edgeVisuals`
  / `Canvas` minimap / `htmlExport` / `ecWorkshopExport`) now read from the token.
  Because the token maps to the current indigo values, the app is **pixel-identical**.
- **Re-skin knob:** change `--color-accent-*` (+ `ACCENT`/`ACCENT_400`) in one place.
- **Deliberately NOT swept (categorical, not the accent):** the `indigo` *group tint*
  (`groupColors.ts`), the `indigo` *chip palette* (`chipColors.ts`), the
  `desiredEffect` *entity stripe* (`tokens.ts`), and the `indigo` *tones* in
  `InsetCard` / `StatusStrip` (peers of amber/emerald/rose/violet). A guard test
  (`tests/components/ui/accentToken.test.ts`) enforces that the accent-carrying
  primitives use `accent-`, not raw `indigo-`, and that the CSS token + `ACCENT`
  stay in sync.

### `src/styles/` — many raw hex, all app-level (flagged, not refactored)

`index.css` and `print.css` carry ~40 raw hex / `rgb()` values. They fall in three
buckets:

1. **Tailwind-palette duplicates** — `#d4d4d4` (neutral-300), `#525252`
   (neutral-600), `#404040` (neutral-700), `#737373` (neutral-500), `#e5e5e5`
   (neutral-200). Hand-authored CSS rules (the `.prose-tp` block, print styles) can't
   use Tailwind utilities, so they restate the neutral palette as literals.
   *(The indigo accent literals that used to live here — the focus outline, the
   selection-glow `drop-shadow`s, the prose-link colour, the entity-ref background —
   were migrated to `var(--color-accent-*)` / `color-mix()` by the accent-token
   refactor; only neutrals remain.)*
2. **Bespoke theme backgrounds** — the per-theme `body` colours (`#1c1410` rust,
   `#0c0d10` coal, `#0a1628` navy, `#0f1419` ayu, plus their `outline-color`
   accents). These have **no token** anywhere; they're defined only in CSS.
3. **Surface literals that DO have tokens** — `index.css` body `#fafafa`/`#0a0a0a`
   and `print.css` `#ffffff`/`#171717` duplicate `tokens.ts#SURFACE_LIGHT` /
   `SURFACE_DARK` (`#ffffff` / `#0a0a0a`) by value.

**Disposition:** flagged, not changed. `src/styles/` is **app-global theming**, not
part of the `@studio/ui` primitive surface — the extraction target is the
components + their tokens, and the consuming apps own their own global stylesheet.
The clean way to share these would be CSS custom properties driven from `@studio/tokens`
(`--surface`, `--accent`, `--prose-border`), but that's a build-config / theming
change explicitly out of scope here.

---

## 3. Hooks audit

**Method:** found every hook in `src/hooks/` actually imported by a `ui/` primitive,
then checked each hook's own imports.

Only **three** hooks are used by `ui/` primitives:

| Hook | Used by | Imports the store? | Other app-specific deps? | Verdict |
| --- | --- | --- | --- | --- |
| `useFocusTrap` | `Modal` | no | none (only `react`) | **generic — safe to vendor** |
| `useOutsideAndEscape` | `Modal` | no | none (only `react`) | **generic — safe to vendor** |
| `useEscapeKey` | `LargeDialog` | no | none (only `react`) | **generic — safe to vendor** |

All three are pure DOM/keyboard utilities with a `react` import and nothing else.
They should ship alongside `@studio/ui` (e.g. as `@studio/ui/hooks`).

The remaining ~20 hooks in `src/hooks/` (`useThemeClass`, `useSelected`,
`useGlobalShortcuts`, `usePrintCanvas`, `useCompareDiff`, …) are **app-coupled** —
they read `useDocumentStore` / `@/store/selectors` — but **none of them are imported
by `ui/`**, so they're not part of the extraction surface. They stay behind.

---

## 4. ConfirmDialog refactor (done)

**Before:** `ui/ConfirmDialog.tsx` read `confirmDialog` + `resolveConfirm` from the
store and rendered the prompt.

**After:**

- `ui/ConfirmDialog.tsx` — pure, prop-driven shell. New signature:

  ```tsx
  type ConfirmDialogProps = {
    open: boolean;
    children: ReactNode;        // the message
    confirmLabel?: string;      // default 'Confirm'
    cancelLabel?: string;       // default 'Cancel'
    onConfirm: () => void;
    onCancel: () => void;
  };
  ```

- `src/components/ConfirmDialogHost.tsx` — **new** app-layer connector. Reads
  `confirmDialog` + `resolveConfirm` and maps them onto the shell's props
  (`onConfirm → resolveConfirm(true)`, `onCancel → resolveConfirm(false)`).

- `src/App.tsx` — mounts `<ConfirmDialogHost />` instead of `<ConfirmDialog />`.

- Tests — `tests/components/ConfirmDialog.test.tsx` now tests the pure shell via
  props; `tests/components/ConfirmDialogHost.test.tsx` (new) preserves the
  store-driven open/close + Promise coverage that the old component test had.

Net effect: the primitive is vendorable as-is; the only TP-specific thing
(the store-backed promise) is isolated in the app layer.
