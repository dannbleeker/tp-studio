import { shortcutToAria } from '@/domain/shortcuts';
import { describe, expect, it } from 'vitest';

describe('shortcutToAria', () => {
  it('converts Ctrl+K display string to ARIA Control+K', () => {
    expect(shortcutToAria('Ctrl+K')).toBe('Meta+K Control+K');
  });

  it('converts ⌘+K display string to both ARIA chord forms', () => {
    expect(shortcutToAria('⌘+K')).toBe('Meta+K Control+K');
  });

  it('keeps Shift modifier in the chord', () => {
    expect(shortcutToAria('⌘+Shift+Z')).toBe('Meta+Shift+Z Control+Shift+Z');
  });

  it('emits a single chord for non-Cmd shortcuts', () => {
    expect(shortcutToAria('Enter')).toBe('Enter');
    expect(shortcutToAria('Tab')).toBe('Tab');
    expect(shortcutToAria('Escape')).toBe('Escape');
  });

  it('returns undefined for non-chord display strings', () => {
    expect(shortcutToAria('Drag handle')).toBeUndefined();
    expect(shortcutToAria('Click')).toBeUndefined();
    expect(shortcutToAria('← → arrows')).toBeUndefined();
  });

  it('returns undefined for aggregate rows', () => {
    expect(shortcutToAria('⌘+C / ⌘+X / ⌘+V')).toBeUndefined();
  });

  it('preserves single-letter keys in uppercase', () => {
    expect(shortcutToAria('⌘+,')).toBe('Meta+, Control+,');
    expect(shortcutToAria('E')).toBe('E');
  });
});
