import { log } from '@/services/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Vitest runs with `import.meta.env.MODE === 'test'`, so the logger
 * silences all calls by design. These tests verify that contract:
 *   - `log.warn` / `log.error` don't reach `console.*` in test mode.
 *
 * Verifying the OTHER side of the contract (logger DOES call `console.*`
 * in non-test modes) would require mocking `import.meta.env.MODE`,
 * which Vite/Vitest doesn't expose cleanly. The contract is documented
 * in the logger module itself; the test here covers the side that
 * matters for test-output cleanliness.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

describe('log (test-mode silence)', () => {
  it('log.warn does not call console.warn in test mode', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    log.warn('this should be silent');
    expect(spy).not.toHaveBeenCalled();
  });

  it('log.error does not call console.error in test mode', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log.error('this should be silent', new Error('payload'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('does not throw when called with structured payloads', () => {
    expect(() => log.error('summary', { ctx: 'foo' }, new Error('x'))).not.toThrow();
    expect(() => log.warn('summary', 1, 2, 3)).not.toThrow();
  });
});
