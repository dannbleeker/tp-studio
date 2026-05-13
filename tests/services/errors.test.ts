import { errorMessage } from '@/services/errors';
import { describe, expect, it } from 'vitest';

describe('errorMessage', () => {
  it('returns message from an Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the fallback when Error.message is empty', () => {
    expect(errorMessage(new Error(''))).toBe('Unknown error');
  });

  it('returns the string unchanged when err is a non-empty string', () => {
    expect(errorMessage('parse failed')).toBe('parse failed');
  });

  it('falls back when err is a whitespace-only string', () => {
    expect(errorMessage('   ')).toBe('Unknown error');
  });

  it('falls back for plain objects, numbers, null, undefined', () => {
    expect(errorMessage({ message: 'fake' })).toBe('Unknown error');
    expect(errorMessage(42)).toBe('Unknown error');
    expect(errorMessage(null)).toBe('Unknown error');
    expect(errorMessage(undefined)).toBe('Unknown error');
  });

  it('honors a custom fallback string', () => {
    expect(errorMessage({}, 'boom')).toBe('boom');
  });
});
