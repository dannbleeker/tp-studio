import { slug } from '@/services/exporters';
import { describe, expect, it } from 'vitest';

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

  it('drops unicode characters outside ASCII alphanumerics', () => {
    expect(slug('Café résumé 你好')).toBe('caf-r-sum');
  });
});
