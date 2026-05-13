/**
 * Typed catalog of `data-component` attribute values. Components stamp
 * themselves with one of these on their root element so:
 *
 *   - **Tests** can `querySelector('[data-component="top-bar"]')` against
 *     a compile-time-checked name instead of a magic string.
 *   - **Devtools / Playwright** can identify the same surface across
 *     refactors that change the rendered tag tree.
 *
 * The naming convention: kebab-case, no namespace prefix, matches the
 * component's file (`<TopBar />` → `'top-bar'`). New surfaces only get
 * a `data-component` if a test or e2e flow needs to target them.
 */
export const DataComponent = {
  TopBar: 'top-bar',
  TitleBadge: 'title-badge',
  Breadcrumb: 'breadcrumb',
  EmptyHint: 'empty-hint',
  FirstEntityTip: 'first-entity-tip',
  ZoomUpCard: 'zoom-up-card',
  ZoomPercent: 'zoom-percent',
  RevisionPanel: 'revision-panel',
  SearchPanel: 'search-panel',
  Toaster: 'toaster',
  /** Canvas entity card. Stamped on the TPNode root for e2e / visual
   *  regression selectors that need to count or screenshot entities. */
  TPNode: 'tp-node',
} as const;

export type DataComponentName = (typeof DataComponent)[keyof typeof DataComponent];
