/**
 * Render a millisecond timestamp as a human-readable relative time
 * (`5m ago`, `2h ago`, etc.). Falls back to an ISO date (YYYY-MM-DD)
 * for revisions older than a week — at that age the exact day matters
 * more than the running counter.
 *
 * Exported as `formatRelativeTime` (not just `formatTime`) so the
 * import name conveys what shape the output has — the previous local
 * `formatTime` left callers guessing whether it produced relative or
 * absolute time.
 */
export const formatRelativeTime = (ms: number): string => {
  const diff = Date.now() - ms;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toISOString().slice(0, 10);
};
