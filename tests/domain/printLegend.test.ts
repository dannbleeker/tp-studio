import { describe, expect, it } from 'vitest';
import { printLegendFor } from '@/domain/printLegend';
import type { DiagramType } from '@/domain/types';

const STRUCTURED: DiagramType[] = ['crt', 'frt', 'prt', 'tt', 'ec', 'goalTree', 'st', 'nbr'];

describe('printLegendFor', () => {
  it('returns a "How to read this …" line for every structured diagram type', () => {
    for (const t of STRUCTURED) {
      const line = printLegendFor(t);
      expect(line).toMatch(/^How to read this /);
      expect(line.length).toBeGreaterThan(40);
    }
  });

  it('returns empty for freeform (no fixed reading rule)', () => {
    expect(printLegendFor('freeform')).toBe('');
  });

  it('names the type and captures its core reading rule', () => {
    expect(printLegendFor('crt')).toContain('Current Reality Tree');
    expect(printLegendFor('crt')).toContain('bottom-up');
    expect(printLegendFor('prt')).toContain('top-down');
    expect(printLegendFor('goalTree')).toContain('Critical Success Factor');
    expect(printLegendFor('st')).toContain('five facets');
    expect(printLegendFor('ec')).toContain('break an assumption');
  });
});
