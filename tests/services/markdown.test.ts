/**
 * @vitest-environment jsdom
 */
import { renderMarkdown } from '@/services/markdown';
import { describe, expect, it } from 'vitest';

describe('renderMarkdown', () => {
  it('returns an empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('renders **bold** as <strong>', () => {
    expect(renderMarkdown('**bold**')).toContain('<strong>bold</strong>');
  });

  it('renders *italic* as <em>', () => {
    expect(renderMarkdown('*italic*')).toContain('<em>italic</em>');
  });

  it('renders ordered and unordered lists', () => {
    const ul = renderMarkdown('- one\n- two');
    expect(ul).toContain('<ul>');
    expect(ul).toContain('<li>one</li>');
    const ol = renderMarkdown('1. one\n2. two');
    expect(ol).toContain('<ol>');
  });

  it('renders external links with target=_blank rel=noopener', () => {
    const out = renderMarkdown('[click](https://example.com)');
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('rewrites `#42` internal references to data-entity-ref="#42"', () => {
    const out = renderMarkdown('[see entity](#42)');
    expect(out).toContain('data-entity-ref="#42"');
    expect(out).not.toContain('href="#42"');
  });

  it('rewrites `#entity:ID` references to data-entity-ref="ID"', () => {
    const out = renderMarkdown('[node](#entity:abc123)');
    expect(out).toContain('data-entity-ref="abc123"');
    expect(out).not.toContain('href="#entity:abc123"');
  });

  it('neutralizes <script> tags via DOMPurify (escapes or removes them)', () => {
    const out = renderMarkdown('hello\n\n<script>alert(1)</script>');
    // The literal opening tag must not appear as a real element.
    expect(out).not.toMatch(/<script[^>]*>/);
    // If the body text survives, it must be HTML-escaped (no live JS).
    if (out.includes('alert(1)')) {
      expect(out).toContain('&lt;script&gt;');
    }
  });

  it('strips javascript: URI schemes', () => {
    const out = renderMarkdown('[bad](javascript:alert(1))');
    // Either the anchor is dropped or its href is sanitized away.
    expect(out).not.toContain('javascript:');
  });

  it('renders inline `code` with <code>', () => {
    expect(renderMarkdown('use `clsx` here')).toContain('<code>clsx</code>');
  });
});
