import { describe, expect, it } from 'vitest';
import { effectiveLayoutMode, FORCE_RADIAL, LAYOUT_STRATEGY } from '@/domain/layoutStrategy';

describe('LAYOUT_STRATEGY', () => {
  it('marks every existing diagram type as auto-layout', () => {
    // If a future diagram type wants hand positioning (e.g. Evaporating
    // Cloud), it lands here as `'manual'` and TypeScript forces it to be
    // listed via the `Record<DiagramType, _>` shape on the map itself.
    expect(LAYOUT_STRATEGY.crt).toBe('auto');
    expect(LAYOUT_STRATEGY.frt).toBe('auto');
    expect(LAYOUT_STRATEGY.prt).toBe('auto');
    expect(LAYOUT_STRATEGY.tt).toBe('auto');
  });
});

describe('effectiveLayoutMode', () => {
  it('forces radial for a forced-radial type regardless of the global mode', () => {
    expect(FORCE_RADIAL.id).toBe(true);
    expect(effectiveLayoutMode('id', 'flow')).toBe('radial');
    expect(effectiveLayoutMode('id', 'radial')).toBe('radial');
  });

  it('passes the global mode through for a non-forced type', () => {
    expect(effectiveLayoutMode('crt', 'flow')).toBe('flow');
    expect(effectiveLayoutMode('crt', 'radial')).toBe('radial');
  });
});
