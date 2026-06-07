// @vitest-environment jsdom
/**
 * Direct tests for every export in src/services/exporters/shared.ts.
 *
 * Covers:
 *   • slug          – all branches (lowercase, collapse, trim, 60-char cap,
 *                     empty/whitespace/symbol fallback, unicode stripping)
 *   • csvCell       – undefined/null → '', empty string → '', plain value,
 *                     number coercion, quote-escaping, comma trigger,
 *                     newline/CR triggers
 *   • csvRow        – joins cells with commas, delegates escaping to csvCell
 *   • triggerDownload      – creates object URL, sets href+download, appends
 *                            anchor, clicks it, removes it, revokes on next tick
 *   • triggerDataUrlDownload – same DOM contract with a data: URL (no object
 *                              URL created/revoked)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  csvCell,
  csvRow,
  slug,
  triggerDataUrlDownload,
  triggerDownload,
} from '@/services/exporters/shared';

// ─── slug ───────────────────────────────────────────────────────────────────

describe('slug', () => {
  it('lowercases and replaces non-alphanumeric runs with a single hyphen', () => {
    expect(slug('Customer Satisfaction CRT')).toBe('customer-satisfaction-crt');
  });

  it('trims leading and trailing whitespace before processing', () => {
    expect(slug('  hello world  ')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens that result from non-alphanumeric edges', () => {
    expect(slug('  --hello world!--  ')).toBe('hello-world');
  });

  it('collapses multiple non-alphanumeric chars into a single hyphen', () => {
    expect(slug('a   b___c!!!d')).toBe('a-b-c-d');
  });

  it('falls back to "untitled" for an empty string', () => {
    expect(slug('')).toBe('untitled');
  });

  it('falls back to "untitled" for a whitespace-only string', () => {
    expect(slug('   \t  \n')).toBe('untitled');
  });

  it('falls back to "untitled" for a symbol-only string', () => {
    expect(slug('!!!@@@###')).toBe('untitled');
  });

  it('caps the result at 60 characters', () => {
    const result = slug('a'.repeat(100));
    expect(result).toHaveLength(60);
    expect(result).toBe('a'.repeat(60));
  });

  it('a 60-char input with non-alphanumeric suffix is trimmed + hyphens stripped', () => {
    // 58 'a's + '!!' — after processing "aaa…aaa" (58 chars) → no trailing hyphen
    const result = slug(`${'a'.repeat(58)}!!`);
    expect(result).toHaveLength(58);
  });

  it('drops unicode characters outside ASCII alphanumerics', () => {
    expect(slug('Café résumé 你好')).toBe('caf-r-sum');
  });

  it('handles a single alphanumeric character', () => {
    expect(slug('A')).toBe('a');
  });

  it('handles a single numeric character', () => {
    expect(slug('9')).toBe('9');
  });

  it('handles mixed digits and letters', () => {
    expect(slug('CRT-2024 v2')).toBe('crt-2024-v2');
  });
});

// ─── csvCell ─────────────────────────────────────────────────────────────────

describe('csvCell', () => {
  it('returns empty string for undefined', () => {
    expect(csvCell(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(csvCell(null)).toBe('');
  });

  it('returns empty string for an empty string', () => {
    expect(csvCell('')).toBe('');
  });

  it('returns the string as-is when it needs no quoting', () => {
    expect(csvCell('hello')).toBe('hello');
  });

  it('coerces a number to its string representation', () => {
    expect(csvCell(42)).toBe('42');
  });

  it('coerces 0 correctly', () => {
    expect(csvCell(0)).toBe('0');
  });

  it('wraps in double-quotes when the value contains a comma', () => {
    expect(csvCell('one,two')).toBe('"one,two"');
  });

  it('wraps in double-quotes when the value contains a double-quote and doubles it', () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('wraps in double-quotes when the value contains a newline', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('wraps in double-quotes when the value contains a carriage return', () => {
    expect(csvCell('line1\rline2')).toBe('"line1\rline2"');
  });

  it('handles a value with both a comma and an embedded quote', () => {
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
  });

  it('handles a string with only a double-quote character', () => {
    expect(csvCell('"')).toBe('""""');
  });
});

// ─── csvRow ───────────────────────────────────────────────────────────────────

describe('csvRow', () => {
  it('joins plain cells with commas', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('escapes cells that need quoting', () => {
    expect(csvRow(['plain', 'has,comma', 'also "quoted"'])).toBe(
      'plain,"has,comma","also ""quoted"""'
    );
  });

  it('handles an empty array', () => {
    expect(csvRow([])).toBe('');
  });

  it('handles a single-cell row', () => {
    expect(csvRow(['only'])).toBe('only');
  });

  it('handles null and undefined cells via csvCell delegation', () => {
    expect(csvRow([null, undefined, 'val'])).toBe(',,val');
  });

  it('handles numeric cells', () => {
    expect(csvRow([1, 2, 3])).toBe('1,2,3');
  });
});

// ─── triggerDownload ──────────────────────────────────────────────────────────

describe('triggerDownload', () => {
  const fakeUrl = 'blob:http://localhost/fake-object-url';

  beforeEach(() => {
    // Stub URL.createObjectURL / revokeObjectURL — jsdom does not implement them.
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => fakeUrl),
      revokeObjectURL: vi.fn(),
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('calls URL.createObjectURL with the supplied blob', () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    triggerDownload(blob, 'test.txt');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('sets the anchor href to the object URL', () => {
    const blob = new Blob(['data']);
    const clickedAnchors: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') clickedAnchors.push(el as HTMLAnchorElement);
      return el;
    });

    triggerDownload(blob, 'output.csv');
    const anchor = clickedAnchors[0];
    expect(anchor).toBeDefined();
    expect(anchor?.href).toContain(fakeUrl);
  });

  it('sets the anchor download attribute to the filename', () => {
    const blob = new Blob(['data']);
    const captured: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') captured.push(el as HTMLAnchorElement);
      return el;
    });

    triggerDownload(blob, 'my-file.json');
    expect(captured[0]?.download).toBe('my-file.json');
  });

  it('appends the anchor to document.body', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const blob = new Blob(['x']);
    triggerDownload(blob, 'x.txt');
    expect(appendSpy).toHaveBeenCalled();
    const appended = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(appended.tagName.toLowerCase()).toBe('a');
  });

  it('clicks the anchor', () => {
    const blob = new Blob(['data']);
    const origCreate = document.createElement.bind(document);
    let clickCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(() => {
          clickCount++;
        });
      }
      return el;
    });

    triggerDownload(blob, 'click-test.txt');
    expect(clickCount).toBe(1);
  });

  it('removes the anchor from document.body after clicking', () => {
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const blob = new Blob(['x']);
    triggerDownload(blob, 'x.txt');
    expect(removeSpy).toHaveBeenCalled();
    const removed = removeSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(removed.tagName.toLowerCase()).toBe('a');
  });

  it('revokes the object URL after a setTimeout(0) tick', () => {
    const blob = new Blob(['x']);
    triggerDownload(blob, 'x.txt');
    // Before tick: not yet revoked
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    // After tick: revoked with the fake URL
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
  });

  it('does not revoke the URL synchronously', () => {
    const blob = new Blob(['data']);
    triggerDownload(blob, 'data.bin');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

// ─── triggerDataUrlDownload ───────────────────────────────────────────────────

describe('triggerDataUrlDownload', () => {
  const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets the anchor href to the supplied data URL', () => {
    const captured: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') captured.push(el as HTMLAnchorElement);
      return el;
    });

    triggerDataUrlDownload(dataUrl, 'image.png');
    expect(captured[0]?.href).toBe(dataUrl);
  });

  it('sets the anchor download attribute to the filename', () => {
    const captured: HTMLAnchorElement[] = [];
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') captured.push(el as HTMLAnchorElement);
      return el;
    });

    triggerDataUrlDownload(dataUrl, 'diagram.svg');
    expect(captured[0]?.download).toBe('diagram.svg');
  });

  it('appends the anchor to document.body', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    triggerDataUrlDownload(dataUrl, 'img.png');
    expect(appendSpy).toHaveBeenCalled();
    const appended = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(appended.tagName.toLowerCase()).toBe('a');
  });

  it('clicks the anchor', () => {
    const origCreate = document.createElement.bind(document);
    let clickCount = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        vi.spyOn(el, 'click').mockImplementation(() => {
          clickCount++;
        });
      }
      return el;
    });

    triggerDataUrlDownload(dataUrl, 'test.png');
    expect(clickCount).toBe(1);
  });

  it('removes the anchor from document.body after clicking', () => {
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    triggerDataUrlDownload(dataUrl, 'test.png');
    expect(removeSpy).toHaveBeenCalled();
    const removed = removeSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(removed.tagName.toLowerCase()).toBe('a');
  });

  it('does not call URL.createObjectURL (data URLs need no object URL)', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL');
    triggerDataUrlDownload(dataUrl, 'no-object-url.png');
    expect(createObjectURLSpy).not.toHaveBeenCalled();
  });

  it('does not call URL.revokeObjectURL (no object URL was created)', () => {
    vi.useFakeTimers();
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL');
    triggerDataUrlDownload(dataUrl, 'no-revoke.png');
    vi.runAllTimers();
    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
