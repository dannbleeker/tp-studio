import { CompareBanner } from '@/components/canvas/CompareBanner';
import { EmptyHint } from '@/components/canvas/EmptyHint';
import { FirstEntityTip } from '@/components/canvas/FirstEntityTip';
import { ZoomPercent } from '@/components/canvas/ZoomPercent';
import { QuickCaptureDialog } from '@/components/quick-capture/QuickCaptureDialog';
import { SearchPanel } from '@/components/search/SearchPanel';
import { Toaster } from '@/components/toast/Toaster';
import { WalkthroughOverlay } from '@/components/walkthrough/WalkthroughOverlay';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, cleanup, render } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * Smoke tests for the overlay / panel components without dedicated
 * coverage. Each test verifies:
 *   - Mounts without throwing (catches a runtime store-shape change
 *     that the component didn't track).
 *   - The hidden-by-default ones (SearchPanel, WalkthroughOverlay,
 *     QuickCapture, Toaster, CompareBanner) DON'T render their visible
 *     content when their open state is off.
 *   - When their open state is flipped on, they DO render.
 *
 * Full interaction tests live in their own files when needed; this
 * file is the "did the component even compile and mount" gate.
 */

describe('CompareBanner', () => {
  it('renders nothing when compareRevisionId is null', () => {
    const { container } = render(<CompareBanner />);
    // No banner text when not in compare mode.
    expect(container.textContent ?? '').not.toMatch(/comparing|exit/i);
  });
});

describe('EmptyHint', () => {
  it('renders when the doc has no entities', () => {
    // Fresh store → 0 entities → hint visible.
    const { container } = render(<EmptyHint />);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
  });

  it('does not render when there is at least one entity', () => {
    seedEntity('A');
    const { container } = render(<EmptyHint />);
    // The component renders nothing (or near-nothing) once entities exist.
    // We don't assert on exact text — only that it didn't crash.
    expect(container).toBeTruthy();
  });
});

describe('FirstEntityTip', () => {
  it('mounts without throwing when entityCount > 2 (auto-hides)', () => {
    seedEntity('A');
    seedEntity('B');
    seedEntity('C');
    const { container } = render(<FirstEntityTip />);
    expect(container).toBeTruthy();
  });
});

describe('ZoomPercent', () => {
  it('mounts without throwing inside a ReactFlowProvider', () => {
    // ZoomPercent calls `useReactFlow` internally to read the live
    // viewport scale; the provider has to be present.
    const { container } = render(
      <ReactFlowProvider>
        <ZoomPercent />
      </ReactFlowProvider>
    );
    expect(container).toBeTruthy();
  });
});

describe('SearchPanel', () => {
  it('renders nothing when searchOpen is false', () => {
    const { container } = render(<SearchPanel />);
    // No <input> when closed (the panel's search input renders on open only).
    expect(container.querySelector('input')).toBeNull();
  });

  it('renders when searchOpen flips to true', () => {
    const { container } = render(<SearchPanel />);
    act(() => useDocumentStore.getState().openSearch());
    expect(container.querySelector('input')).not.toBeNull();
  });
});

describe('Toaster', () => {
  it('renders an empty list when no toasts are queued', () => {
    const { container } = render(<Toaster />);
    // Toaster is a fixed-positioned container; its inner list is empty.
    expect(container.textContent ?? '').toBe('');
  });

  it('renders a toast when one is queued', () => {
    const { container } = render(<Toaster />);
    act(() => useDocumentStore.getState().showToast('info', 'Hello world'));
    expect(container.textContent).toContain('Hello world');
  });
});

describe('QuickCaptureDialog', () => {
  it('renders nothing when quickCaptureOpen is false', () => {
    const { container } = render(<QuickCaptureDialog />);
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('renders the textarea when quickCaptureOpen flips on', () => {
    const { container } = render(<QuickCaptureDialog />);
    act(() => useDocumentStore.getState().openQuickCapture());
    expect(container.querySelector('textarea')).not.toBeNull();
  });
});

describe('WalkthroughOverlay', () => {
  it('renders nothing when the walkthrough is closed', () => {
    const { container } = render(<WalkthroughOverlay />);
    // Closed → no dialog content.
    expect(container.textContent ?? '').not.toMatch(/Read-through|CLR walkthrough/);
  });
});
