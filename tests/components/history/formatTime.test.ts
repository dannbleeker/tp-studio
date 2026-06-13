import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '@/components/history/formatTime';

describe('formatRelativeTime', () => {
  const NOW = Date.UTC(2026, 5, 1, 12, 0, 0); // 2026-06-01T12:00:00Z
  afterEach(() => vi.useRealTimers());

  const ago = (ms: number): string => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    return formatRelativeTime(NOW - ms);
  };

  it('renders relative seconds, minutes, hours, and days', () => {
    expect(ago(5_000)).toBe('5s ago');
    expect(ago(5 * 60_000)).toBe('5m ago');
    expect(ago(3 * 3_600_000)).toBe('3h ago');
    expect(ago(2 * 86_400_000)).toBe('2d ago');
  });

  it('falls back to an ISO date for anything older than a week', () => {
    expect(ago(10 * 86_400_000)).toBe('2026-05-22'); // NOW − 10 days
  });
});
