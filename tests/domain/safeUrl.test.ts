import { describe, expect, it } from 'vitest';
import { isSafeHref } from '@/domain/safeUrl';

/**
 * Goal #A1 — keep `javascript:`/`data:`/etc. URLs out of rendered hrefs.
 * Evidence citation links flow from imported/shared documents into
 * `<a href={url}>`, so a hostile scheme is a stored-XSS vector. `isSafeHref`
 * is the shared gate (used by the persistence validator + EvidenceList).
 */
describe('isSafeHref', () => {
  it('allows http and https URLs', () => {
    expect(isSafeHref('http://example.com')).toBe(true);
    expect(isSafeHref('https://example.com/path?q=1#frag')).toBe(true);
  });

  it('allows mailto and scheme-less / relative values (legitimate citations)', () => {
    expect(isSafeHref('mailto:author@example.com')).toBe(true);
    expect(isSafeHref('www.example.com')).toBe(true);
    expect(isSafeHref('/local/path')).toBe(true);
  });

  it('blocks javascript: regardless of case', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('JavaScript:alert(document.cookie)')).toBe(false);
  });

  it('blocks data:, vbscript:, and file:', () => {
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHref('file:///etc/passwd')).toBe(false);
  });

  it('blocks whitespace-smuggled schemes that browsers would strip and execute', () => {
    expect(isSafeHref('java\tscript:alert(1)')).toBe(false);
    expect(isSafeHref('java\nscript:alert(1)')).toBe(false);
    expect(isSafeHref('java\r\nscript:alert(1)')).toBe(false);
    expect(isSafeHref('   javascript:alert(1)')).toBe(false);
  });
});
