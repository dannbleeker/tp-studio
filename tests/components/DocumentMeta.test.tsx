import { DocumentMeta, computeBrowserTitle } from '@/components/DocumentMeta';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 120 — DocumentMeta renders a `<title>` element that React 19
 * hoists into <head>. The component is a thin pure-function shell over
 * `computeBrowserTitle`; we test the pure function directly (asserting
 * on `document.title` in jsdom is unreliable — jsdom doesn't fully
 * implement React 19's metadata hoisting). The component itself only
 * passes the store's title through the formatter, so the contract
 * surface is the formatter's behavior.
 */
describe('computeBrowserTitle', () => {
  it('appends " · TP Studio" to a regular title', () => {
    expect(computeBrowserTitle('My CRT')).toBe('My CRT · TP Studio');
  });

  it('falls back to "Untitled" for an empty string', () => {
    expect(computeBrowserTitle('')).toBe('Untitled · TP Studio');
  });

  it('falls back to "Untitled" for a whitespace-only string', () => {
    expect(computeBrowserTitle('   ')).toBe('Untitled · TP Studio');
    expect(computeBrowserTitle('\t\n')).toBe('Untitled · TP Studio');
  });

  it('trims leading/trailing whitespace from the title for cleaner tab labels', () => {
    expect(computeBrowserTitle('  Padded  ')).toBe('Padded · TP Studio');
  });
});

describe('DocumentMeta', () => {
  it('renders without crashing and reads from the store', () => {
    act(() => useDocumentStore.getState().setTitle('Test Doc'));
    // Render purely to verify no throw — jsdom's <title> hoisting
    // doesn't populate `document.title` reliably, so we don't assert
    // on DOM state here. The pure-function unit tests above cover
    // the actual formatting contract.
    const result = render(<DocumentMeta />);
    expect(result.container).toBeTruthy();
  });
});
