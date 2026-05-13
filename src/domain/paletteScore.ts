/**
 * Substring + per-word-subsequence fuzzy scorer for the command palette.
 *
 * Returns a numeric score so the palette can sort matches by relevance:
 *
 *   - `100` — exact label match (lowercase compared)
 *   - `80`  — prefix match
 *   - `50`  — substring match
 *   - `20`  — per-word subsequence match (letters of the query appear in
 *             order within a single word of the label)
 *   - `-1`  — no match; the caller filters these out
 *
 * The empty query returns `0` and lets every command through unsorted, which
 * is the desired behavior for "user just opened the palette and hasn't
 * typed anything." The per-word subsequence constraint (rather than
 * cross-word) blocks pathological matches like query `"Export"` filtering
 * in `"Load example Evaporating Cloud"` — the letters e-x-p-o-r-t appear
 * in order *across* `example` + `Evaporating` but not within either word.
 * In-word abbreviations (`"exrt"` → `"Export"`) still match because they're
 * contiguous in one word; cross-word ones don't, but those didn't outscore
 * the substring branch anyway (users almost always type a prefix of one
 * word, which `includes` catches at 50).
 *
 * Extracted out of `CommandPalette.tsx` (Session 39) so the per-word
 * branch — which broke the original cross-word version and was fixed in
 * Session 37 — has direct unit tests instead of only being covered
 * indirectly through palette render tests.
 */
export const paletteScore = (label: string, query: string): number => {
  if (!query) return 0;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.includes(q)) return 50;
  // Per-word subsequence: query letters must appear in order within a
  // single space-delimited word of the label.
  for (const w of l.split(/[^a-z0-9]+/)) {
    if (w.length === 0) continue;
    let i = 0;
    for (const ch of w) {
      if (i < q.length && ch === q[i]) i++;
    }
    if (i === q.length) return 20;
  }
  return -1;
};
