import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

const Boom = () => {
  throw new Error('boom');
};

// React logs the caught error to console.error before the boundary
// renders its fallback. Silence it so the test output stays clean —
// asserting on the boundary's effect is the whole point.
const withSilencedConsole = (run: () => void) => {
  const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    run();
  } finally {
    errSpy.mockRestore();
  }
};

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>healthy child</div>
      </ErrorBoundary>
    );
    expect(getByText('healthy child')).toBeTruthy();
  });

  it('renders the root full-screen recovery card when label is omitted', () => {
    withSilencedConsole(() => {
      const { getByText } = render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      );
      expect(getByText('Something went wrong')).toBeTruthy();
      // Reload button is the primary CTA on the root path.
      expect(getByText('Reload')).toBeTruthy();
    });
  });

  it('renders the inline labeled card when label is supplied', () => {
    withSilencedConsole(() => {
      const { getByText, queryByText } = render(
        <ErrorBoundary label="Inspector">
          <Boom />
        </ErrorBoundary>
      );
      expect(getByText('Inspector failed to render')).toBeTruthy();
      // Root-mode CTAs should NOT appear on the nested path.
      expect(queryByText('Reload')).toBeNull();
      expect(queryByText('Something went wrong')).toBeNull();
      // Retry is the nested-mode CTA.
      expect(getByText('Retry')).toBeTruthy();
    });
  });

  it('respects an explicit fallback prop', () => {
    withSilencedConsole(() => {
      const { queryByText, getByText } = render(
        <ErrorBoundary fallback={<span>custom fallback</span>}>
          <Boom />
        </ErrorBoundary>
      );
      expect(getByText('custom fallback')).toBeTruthy();
      expect(queryByText('Something went wrong')).toBeNull();
    });
  });
});
