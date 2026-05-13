import { parseQuickCapture } from '@/domain/quickCapture';
import { describe, expect, it } from 'vitest';

const titles = (forest: ReturnType<typeof parseQuickCapture>): string[] =>
  forest.roots.flatMap(function flat(n): string[] {
    return [n.title, ...n.children.flatMap(flat)];
  });

describe('parseQuickCapture', () => {
  it('returns an empty forest on empty input', () => {
    const r = parseQuickCapture('');
    expect(r.total).toBe(0);
    expect(r.roots).toEqual([]);
  });

  it('treats each line as a root when un-indented', () => {
    const r = parseQuickCapture('Apples\nBananas\nCherries');
    expect(r.total).toBe(3);
    expect(r.roots).toHaveLength(3);
  });

  it('strips bullet markers (-, *, •, 1., 1), >)', () => {
    const r = parseQuickCapture('- one\n* two\n• three\n1. four\n2) five\n> six');
    expect(titles(r)).toEqual(['one', 'two', 'three', 'four', 'five', 'six']);
  });

  it('strips a single leading emoji + space', () => {
    const r = parseQuickCapture('✅ done\n🔥 hot');
    expect(titles(r)).toEqual(['done', 'hot']);
  });

  it('treats 2-space indent as parent → child', () => {
    const r = parseQuickCapture('Parent\n  Child A\n  Child B');
    expect(r.roots).toHaveLength(1);
    expect(r.roots[0]!.title).toBe('Parent');
    expect(r.roots[0]!.children.map((c) => c.title)).toEqual(['Child A', 'Child B']);
  });

  it('supports deeper nesting (2 + 4 spaces)', () => {
    const r = parseQuickCapture('A\n  B\n    C\n    D\n  E');
    expect(r.roots).toHaveLength(1);
    const a = r.roots[0]!;
    expect(a.children.map((c) => c.title)).toEqual(['B', 'E']);
    expect(a.children[0]!.children.map((c) => c.title)).toEqual(['C', 'D']);
  });

  it('skips blank lines and lines that are only markers', () => {
    const r = parseQuickCapture('one\n\n-\ntwo');
    expect(titles(r)).toEqual(['one', 'two']);
  });

  it('handles tab indents as one level (= 2 spaces)', () => {
    const r = parseQuickCapture('Parent\n\tChild');
    expect(r.roots[0]!.children.map((c) => c.title)).toEqual(['Child']);
  });

  it('snaps over-indented children to one level under their nearest ancestor', () => {
    // No level-1 line; "X" is at indent 2 (4 spaces). It should land as a
    // direct child of "Root" rather than being dropped or thrown on.
    const r = parseQuickCapture('Root\n    X');
    expect(r.roots[0]!.children.map((c) => c.title)).toEqual(['X']);
  });

  it('strips a leading bullet and emoji together', () => {
    const r = parseQuickCapture('- ✅ Win the day');
    expect(titles(r)).toEqual(['Win the day']);
  });
});
