import { beforeEach, describe, expect, it } from 'vitest';
import type { DiagramType } from '@/domain/types';
import { logicTypeMismatchRule } from '@/domain/validators/logicTypeMismatch';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 179 (Theme C2) — logic-type consistency lint. Flags an edge whose
 * `kind` contradicts the diagram's primary logic.
 */
beforeEach(resetIds);

describe('logicTypeMismatchRule', () => {
  it('flags a necessity edge on a CRT (a sufficiency tree)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const w = logicTypeMismatchRule(
      makeDoc([a, b], [makeEdge(a.id, b.id, { kind: 'necessity' })], 'crt')
    );
    expect(w).toHaveLength(1);
    expect(w[0]?.target.kind).toBe('edge');
    expect(w[0]?.message).toMatch(/sufficiency logic/);
  });

  it('does not flag a sufficiency edge on a CRT', () => {
    const a = makeEntity();
    const b = makeEntity();
    expect(
      logicTypeMismatchRule(makeDoc([a, b], [makeEdge(a.id, b.id, { kind: 'sufficiency' })], 'crt'))
    ).toEqual([]);
  });

  it('flags a sufficiency edge on a Goal Tree (a necessity tree)', () => {
    const a = makeEntity({ type: 'goal' });
    const b = makeEntity({ type: 'criticalSuccessFactor' });
    const w = logicTypeMismatchRule(
      makeDoc([a, b], [makeEdge(a.id, b.id, { kind: 'sufficiency' })], 'goalTree')
    );
    expect(w).toHaveLength(1);
    expect(w[0]?.message).toMatch(/necessity logic/);
  });

  it('does not fire on out-of-scope diagram types', () => {
    const a = makeEntity();
    const b = makeEntity();
    for (const dt of ['ec', 'prt', 'freeform', 'st'] satisfies DiagramType[]) {
      expect(
        logicTypeMismatchRule(makeDoc([a, b], [makeEdge(a.id, b.id, { kind: 'necessity' })], dt))
      ).toEqual([]);
    }
  });
});
