import { GROUP_PRESETS, presetById, presetByTitle } from '@/domain/groupPresets';
import { describe, expect, it } from 'vitest';

describe('group presets catalog', () => {
  it('has five canonical preset entries', () => {
    expect(GROUP_PRESETS).toHaveLength(5);
  });

  it('every preset has a non-empty title + color + hint', () => {
    for (const p of GROUP_PRESETS) {
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.color.length).toBeGreaterThan(0);
      expect(p.hint.length).toBeGreaterThan(0);
    }
  });

  it('every preset id is unique', () => {
    const ids = GROUP_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Archive preset defaults to collapsed=true', () => {
    const archive = presetById('archive');
    expect(archive?.collapsed).toBe(true);
  });

  it('Negative Branch + PRL + Step + NSP default to collapsed=false', () => {
    for (const id of [
      'negative-branch',
      'positive-reinforcing-loop',
      'step',
      'nsp-block',
    ] as const) {
      expect(presetById(id)?.collapsed).toBe(false);
    }
  });

  it('presetByTitle is case-insensitive + trim-tolerant', () => {
    expect(presetByTitle('Archive')?.id).toBe('archive');
    expect(presetByTitle('  archive  ')?.id).toBe('archive');
    expect(presetByTitle('ARCHIVE')?.id).toBe('archive');
    expect(presetByTitle('not-a-preset')).toBeUndefined();
  });
});
