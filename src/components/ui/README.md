# `@/components/ui` — shared UI primitives

This directory is the source of the future **`@studio/ui`** package that will be
vendored into `mece-studio` and `mindmap-studio` via automated git sync. Everything
here is being kept **extraction-ready**: decoupled from the app's Zustand store,
documented, and free of hardcoded app-specific values.

For the detailed audit behind this guide (store-coupling scan, tokens scan, hooks
scan), see [`EXTRACTION_AUDIT.md`](./EXTRACTION_AUDIT.md). For the per-primitive
catalogue, see [`INVENTORY.md`](./INVENTORY.md).

## The rule

> **Components in `ui/` never call `useDocumentStore()`. They take all their state
> as props.**

If a piece of UI needs store state, the wiring lives in an **app-layer host** (a
small connector component outside `ui/`) that reads the store and passes plain props
down to the primitive. The primitive stays portable; the store coupling stays in the
app.

## Two kinds of component

### Pure primitives

Zero store coupling, zero app-specific imports, fully prop-driven. Copy-paste-safe
into any React app. Examples: `Button`, `ButtonGroup`, `Modal`, `LargeDialog`,
`TabBar`, `InsetCard`, and the class-constant modules (`buttonClasses`,
`focusClasses`, `textClasses`).

> **Example:** `Button` is pure — it takes `variant`, `size`, and standard button
> props, and renders a styled `<button>`. Nothing about it knows the app exists.

### App-aware shells

Still store-free and fully prop-driven, but they bake in an **app-shaped
interaction** — a fixed set of semantic callbacks like `onConfirm` / `onCancel` /
`onClose` — rather than being a fully generic primitive. They're safe to vendor (no
store import), but a consumer must wire the callbacks to its own logic.

> **Example:** `ConfirmDialog` is an app-aware shell. It accepts `onConfirm` and
> `onCancel` as props instead of reading `resolveConfirm` from the store. The
> TP-specific bit — the `confirm(): Promise<boolean>` store action — lives in
> `src/components/ConfirmDialogHost.tsx` (the app-layer host), which reads the store
> and passes `onConfirm={() => resolveConfirm(true)}` down to the shell.

### App-coupled (not extraction-ready as-is)

A few files in `ui/` import app **services** (not the store, but app-specific
modules) and so can't be vendored without also vendoring or stubbing those deps:

- `ErrorBoundary` — imports `@/services/errors` + `@/services/logger`.
- `MarkdownPreview` — imports `@/services/markdown` + `@/services/entityRefs`.
- `loadToast.ts` — imports the `TPDocument` domain type; it's an app helper, not a
  primitive.

These are flagged in `INVENTORY.md`; extraction needs a decision (parameterise the
service dependency, or leave the component behind). They do **not** violate the
store rule above.

## Hooks

The only `src/hooks/` hooks used by `ui/` primitives are `useFocusTrap`,
`useOutsideAndEscape`, and `useEscapeKey`. All three are generic DOM/keyboard
utilities with no store or app coupling — safe to vendor alongside the primitives.
See the hooks table in `EXTRACTION_AUDIT.md`.

## Tokens

Colour, spacing, radii, and typography come from one of:

- `src/domain/tokens.ts` (raw hex for SVG strokes, palettes, surfaces),
- the Tailwind `@theme` block in `src/styles/index.css` (fonts, breakpoints,
  per-surface text sizes, duration tokens), or
- the class-constant modules in this directory (`buttonClasses`, `focusClasses`,
  `textClasses`).

No primitive hardcodes a hex value. The one open item is that the **indigo accent**
is restated as Tailwind utility classes across the primitives rather than read from
a single token — see the tokens section of `EXTRACTION_AUDIT.md` for the
recommendation.

---

## Extraction readiness checklist

- [x] **All pure primitives have zero store imports.** Verified by scan — after the
      `ConfirmDialog` refactor, nothing in `ui/` imports `@/store`, `useDocumentStore`,
      or `zustand`.
- [x] **All app-aware shells are documented with their prop signature.**
      `ConfirmDialog` (`open`, `children`, `confirmLabel?`, `cancelLabel?`,
      `onConfirm`, `onCancel`); `Modal` (`onDismiss`); `LargeDialog` (`onClose`). See
      `INVENTORY.md`.
- [x] **All tokens are in `domain/tokens.ts` and the Tailwind `@theme`.** No raw hex
      in `ui/` components; design tokens centralised. (Open: accent not yet a
      semantic token — documented.)
- [x] **No hardcoded colours in `ui/`.** Confirmed — zero hex / `rgb()` in
      `src/components/ui/`. `src/styles/` still holds app-global theme literals;
      flagged in `EXTRACTION_AUDIT.md` as app-level, out of the primitive surface.
- [x] **Generic hooks listed and decoupled.** `useFocusTrap`, `useOutsideAndEscape`,
      `useEscapeKey` — all store-free, ready to vendor.
- [ ] **Storybook coverage for pure primitives.** Partial. Stories exist for
      `Button`, `Modal`, `ErrorBoundary`, `MarkdownPreview`. **Gaps:** `ButtonGroup`,
      `LargeDialog`, `TabBar`, `InsetCard`, `ConfirmDialog` have no stories yet. See
      `INVENTORY.md` for the per-primitive status.
