import { describe, expect, it } from 'vitest';
import { slug } from '@/services/exporters';

describe('slug', () => {
  it('lowercases, replaces non-alphanumeric runs with hyphens', () => {
    expect(slug('Customer Satisfaction CRT')).toBe('customer-satisfaction-crt');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slug('  --hello world!--  ')).toBe('hello-world');
  });

  it('collapses multiple separators into one hyphen', () => {
    expect(slug('a   b___c!!!d')).toBe('a-b-c-d');
  });

  it('falls back to "untitled" for empty input', () => {
    expect(slug('')).toBe('untitled');
  });

  it('falls back to "untitled" for whitespace-only input', () => {
    expect(slug('   \t  \n')).toBe('untitled');
  });

  it('falls back to "untitled" for symbol-only input', () => {
    expect(slug('!!!@@@###')).toBe('untitled');
  });

  it('caps the slug at 60 characters', () => {
    const long = 'a'.repeat(100);
    expect(slug(long)).toHaveLength(60);
  });

  // Was `drops unicode characters outside ASCII alphanumerics`, asserting
  // 'caf-r-sum'. That behaviour meant EVERY CJK / Cyrillic / Arabic / Greek
  // title slugged to the empty string and downloaded as `untitled.<ext>`, so
  // they all collided in the downloads folder. Letters and digits in any script
  // are kept; only characters a filesystem would object to are replaced.
  it('keeps letters and digits from any script', () => {
    expect(slug('Café résumé 你好')).toBe('café-résumé-你好');
    expect(slug('Отчёт 2026')).toBe('отчёт-2026');
  });

  it('still replaces punctuation and path separators', () => {
    expect(slug('a/b\\c:d*e?f')).toBe('a-b-c-d-e-f');
  });
});
