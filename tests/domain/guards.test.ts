import {
  isDiagramType,
  isEdgeKind,
  isEntityType,
  isObject,
  isStringArray,
  isTrueMap,
} from '@/domain/guards';
import { describe, expect, it } from 'vitest';

/**
 * Type guards are the gatekeepers between `unknown`-typed JSON and the
 * branded domain types. Each is small but called from many places — a
 * regression that accepts a new bad value or rejects an existing good
 * one would surface as a downstream "invalid X" crash somewhere far
 * from the actual bug. These tests pin down the accept / reject sets.
 */

describe('isObject', () => {
  it('accepts plain objects', () => {
    expect(isObject({})).toBe(true);
    expect(isObject({ a: 1 })).toBe(true);
  });
  it('rejects null, arrays, primitives, undefined', () => {
    expect(isObject(null)).toBe(false);
    expect(isObject([])).toBe(false);
    expect(isObject('x')).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject(true)).toBe(false);
    expect(isObject(undefined)).toBe(false);
  });
});

describe('isDiagramType', () => {
  it('accepts the five canonical diagram types', () => {
    for (const t of ['crt', 'frt', 'prt', 'tt', 'ec']) {
      expect(isDiagramType(t)).toBe(true);
    }
  });
  it('rejects unknown strings + non-strings', () => {
    expect(isDiagramType('xyz')).toBe(false);
    expect(isDiagramType('CRT')).toBe(false); // case-sensitive
    expect(isDiagramType(42)).toBe(false);
    expect(isDiagramType(null)).toBe(false);
  });
});

describe('isEntityType', () => {
  it('accepts every entity type the codebase uses', () => {
    const types = [
      'ude',
      'effect',
      'rootCause',
      'injection',
      'desiredEffect',
      'assumption',
      'goal',
      'criticalSuccessFactor',
      'necessaryCondition',
      'obstacle',
      'intermediateObjective',
      'action',
      'need',
      'want',
    ];
    for (const t of types) expect(isEntityType(t)).toBe(true);
  });
  it('rejects strings not in the set', () => {
    expect(isEntityType('vampire')).toBe(false);
    expect(isEntityType('')).toBe(false);
    expect(isEntityType(undefined)).toBe(false);
  });
});

describe('isEdgeKind', () => {
  it('accepts the single canonical edge kind', () => {
    expect(isEdgeKind('sufficiency')).toBe(true);
  });
  it('rejects anything else', () => {
    expect(isEdgeKind('necessity')).toBe(false);
    expect(isEdgeKind('')).toBe(false);
    expect(isEdgeKind(null)).toBe(false);
  });
});

describe('isStringArray', () => {
  it('accepts arrays where every element is a string', () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(['a'])).toBe(true);
    expect(isStringArray(['a', 'b', 'c'])).toBe(true);
  });
  it('rejects mixed arrays + non-array values', () => {
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray(['a', null])).toBe(false);
    expect(isStringArray('not-an-array')).toBe(false);
    expect(isStringArray({ 0: 'a' })).toBe(false);
  });
});

describe('isTrueMap', () => {
  it('accepts an empty object', () => {
    // Empty object trivially has "every value is literally true".
    expect(isTrueMap({})).toBe(true);
  });
  it('accepts maps where every value is literally true', () => {
    expect(isTrueMap({ a: true, b: true })).toBe(true);
  });
  it('rejects when any value is not literally true', () => {
    expect(isTrueMap({ a: true, b: false })).toBe(false);
    expect(isTrueMap({ a: 1 })).toBe(false);
    expect(isTrueMap({ a: 'true' })).toBe(false);
  });
  it('rejects non-object inputs', () => {
    expect(isTrueMap(null)).toBe(false);
    expect(isTrueMap([])).toBe(false);
    expect(isTrueMap('true')).toBe(false);
  });
});
