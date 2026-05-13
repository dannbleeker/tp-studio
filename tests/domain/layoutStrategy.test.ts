import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { describe, expect, it } from 'vitest';

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
