import { ECReadingInstructions } from '@/components/canvas/ECReadingInstructions';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Session 87 / EC PPT comparison item #1 — Reading-instruction strip.
 *
 * The strip is gated on `doc.diagramType === 'ec'` AND
 * `!ecReadingInstructionsDismissed`. Tests pin: gated render on
 * non-EC docs, visible render on EC docs, dismiss button flips the
 * session-scoped flag and hides the strip.
 */

describe('ECReadingInstructions', () => {
  it('renders nothing on non-EC docs', () => {
    // Default doc is CRT.
    expect(useDocumentStore.getState().doc.diagramType).toBe('crt');
    const { container } = render(<ECReadingInstructions />);
    expect(container.querySelector('[data-component="ec-reading-instructions"]')).toBeNull();
  });

  it('renders the 1-2-3 reading pattern on an EC doc', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { getByText, container } = render(<ECReadingInstructions />);
    expect(container.querySelector('[data-component="ec-reading-instructions"]')).not.toBeNull();
    expect(getByText(/In order to/)).toBeTruthy();
    expect(getByText(/we must/)).toBeTruthy();
    expect(getByText(/because/)).toBeTruthy();
  });

  it('dismiss button hides the strip and flips the session flag', () => {
    act(() => useDocumentStore.getState().newDocument('ec'));
    const { container } = render(<ECReadingInstructions />);
    const dismiss = container.querySelector(
      'button[aria-label="Dismiss reading instructions"]'
    ) as HTMLButtonElement;
    expect(dismiss).toBeTruthy();
    act(() => fireEvent.click(dismiss));
    expect(useDocumentStore.getState().ecReadingInstructionsDismissed).toBe(true);
    // Component should now render nothing.
    expect(container.querySelector('[data-component="ec-reading-instructions"]')).toBeNull();
  });
});
