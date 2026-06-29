# `ui/` primitive inventory

Per-primitive catalogue for the `@studio/ui` extraction. See
[`README.md`](./README.md) for the export contract and
[`EXTRACTION_AUDIT.md`](./EXTRACTION_AUDIT.md) for the audit detail.

**Store-coupling legend:**

- **none** — pure primitive, no store, fully prop-driven, copy-paste-safe.
- **prop-driven shell** — app-aware shell: store-free but bakes in app-shaped
  callbacks (`onConfirm`/`onClose`/…); wire it via an app-layer host.
- **app-coupled (services)** — imports app services (not the store); needs a
  decision before extraction.

## Components

| Primitive | Category | Store coupling | Storybook | One-liner |
| --- | --- | --- | --- | --- |
| `Button` | input | none | ✅ `Button.stories.tsx` | Variant/size styled `<button>` (primary / ghost / softNeutral / softViolet / destructive). |
| `ButtonGroup` | input | none | ❌ gap | Single-select toggle-button grid (`aria-pressed`), `default` + `plain` (stripe) variants. |
| `TabBar` | layout | none | ❌ gap | Equal-width horizontal `role="tablist"` with the indigo-underline active pattern. |
| `InsetCard` | feedback | none | ❌ gap | Tinted inset note card (indigo / amber / neutral / emerald / rose tones). |
| `Modal` | dialog | none (`onDismiss` prop) | ✅ `Modal.stories.tsx` | Focus-trapped modal shell; backdrop + Esc + outside-click dismiss. |
| `LargeDialog` | dialog | none (`onClose` prop) | ❌ gap | Card-grid picker shell (native `showModal()`, header band + close X). |
| `ConfirmDialog` | dialog | prop-driven shell (`onConfirm`/`onCancel`) | ❌ gap | In-app `window.confirm` replacement; renders prompt + 2 buttons, reports the choice. |
| `ErrorBoundary` | feedback | app-coupled (`@/services/errors`, `@/services/logger`) | ✅ `ErrorBoundary.stories.tsx` | Render-error recovery card (root full-screen / nested inline modes). |
| `MarkdownPreview` | feedback | app-coupled (`@/services/markdown`, `@/services/entityRefs`) | ✅ `MarkdownPreview.stories.tsx` | Sanitized markdown → HTML with internal entity-ref navigation. |

## Class-constant & helper modules

| Module | Category | Store coupling | One-liner |
| --- | --- | --- | --- |
| `buttonClasses.ts` | tokens | none (static exports) | Toggle/selected button class strings (`SELECTED_BUTTON_CLASS`, `TOGGLE_BUTTON_BASE`, …). |
| `focusClasses.ts` | tokens | none (static exports) | Focus-ring class strings (`INPUT_FOCUS`, `CARD_FOCUS`). |
| `textClasses.ts` | tokens | none (static exports) | Typography token (`EYEBROW` uppercase section-label treatment). |
| `loadToast.ts` | helper | app-coupled (`TPDocument` type) | `undoRestoreAction` helper for post-load toasts; app-specific, not a primitive. |

**Class-constant modules are side-effect-free** — each is a plain `export const`
string (or record of strings) with no top-level execution, no imports beyond types.
Copy-paste-safe.

## App-aware shell prop signatures

```tsx
// ConfirmDialog — the message comes in as children
type ConfirmDialogProps = {
  open: boolean;
  children: ReactNode;     // the message
  confirmLabel?: string;   // default 'Confirm'
  cancelLabel?: string;    // default 'Cancel'
  onConfirm: () => void;
  onCancel: () => void;
};

// Modal
type ModalProps = {
  open: boolean;
  onDismiss: () => void;
  children: ReactNode;
  align?: 'center' | 'top';
  widthClass?: string;
  labelledBy?: string;
};

// LargeDialog
type LargeDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  closeAriaLabel?: string;
  widthClass?: string;
  cardClassName?: string;
  children: ReactNode;
};
```

## Gaps & notes for the extractor

- **No `Toaster` primitive exists.** The app's toast surface is
  `src/components/toast/Toaster.tsx`, which is **app-aware** (reads `s.toasts` /
  `s.dismissToast` from the store). If `@studio/ui` wants a toast primitive, it needs
  a pure presentational `Toaster` (takes a `toasts` array + `onDismiss` prop) with an
  app-layer host doing the store wiring — mirroring the `ConfirmDialog` /
  `ConfirmDialogHost` split.
- **`ErrorBoundary` and `MarkdownPreview` are app-coupled via services**, not the
  store. To vendor them, parameterise the service dependency (pass a `logError`
  callback / a `renderMarkdown` function as props) or leave them behind.
- **Storybook gaps:** `ButtonGroup`, `TabBar`, `InsetCard`, `LargeDialog`,
  `ConfirmDialog` have no `*.stories.tsx`. Adding stories for the pure ones is the
  cheapest way to make them "documented and safe to extract."
- **`tokens.ts#ENTITY_STRIPE_COLOR`** is keyed by the TP `EntityType` enum — it's
  domain-shaped. `@studio/tokens` should ship the generic tokens (palettes,
  surfaces, accent, edge palettes) and leave the entity-stripe map app-side, or
  re-key it on the consumer's own entity type.
