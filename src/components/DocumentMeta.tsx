import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Session 120 — Dynamic browser-tab title.
 *
 * React 19 lets components render `<title>` / `<meta>` / `<link>`
 * directly; React hoists them into `<head>` automatically. We use it
 * here for the simplest possible value-add: tab-juggling users with
 * multiple TP Studio docs open in different tabs can now tell their
 * tabs apart by the doc title rather than every tab reading "TP
 * Studio."
 *
 * The static `<title>` in `index.html` stays as the first-paint /
 * pre-hydration fallback; the moment React mounts, this component
 * takes over and React reconciles the head.
 *
 * No state of its own — reads the doc title from the Zustand store
 * and renders. Empty titles fall back to "Untitled" so the tab still
 * displays something useful.
 */

/**
 * Pure title-computation. Extracted from the React component so the
 * "empty falls back to Untitled" / suffix logic can be unit-tested
 * directly — jsdom's React 19 metadata hoisting doesn't populate
 * `document.title` the way real browsers do, so asserting on the
 * pure function is more reliable than DOM observation.
 */
export const computeBrowserTitle = (docTitle: string): string => {
  const display = docTitle.trim() || 'Untitled';
  return `${display} · TP Studio`;
};

export function DocumentMeta() {
  const docTitle = useDocumentStore((s) => currentDoc(s).title);
  return <title>{computeBrowserTitle(docTitle)}</title>;
}
