import { beforeEach, describe, expect, it } from 'vitest';
import { exportToFlyingLogic } from '@/domain/flyingLogic/writer';
import type { Group, GroupId } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const group = (id: string, memberIds: string[], over: Partial<Group> = {}): Group => ({
  id: id as GroupId,
  title: id,
  color: 'indigo',
  memberIds,
  collapsed: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

beforeEach(resetIds);

describe('exportToFlyingLogic', () => {
  it('serializes the document header, author, description, edge weight + label', () => {
    const a = makeEntity({ title: 'Cause', description: 'why' });
    const b = makeEntity({ title: 'Effect' });
    const e = makeEdge(a.id, b.id, { weight: 'negative', label: 'within 30d' });
    const doc = makeDoc([a, b], [e]);
    doc.author = 'Dann';
    doc.description = 'A test CRT';
    const xml = exportToFlyingLogic(doc);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<flyingLogic');
    expect(xml).toContain('key="author"');
    expect(xml).toContain('Dann');
    expect(xml).toContain('key="description"');
    expect(xml).toContain('tp-studio-weight');
    expect(xml).toContain('negative');
    expect(xml).toContain('within 30d');
    expect(xml).toContain('tp-studio-id');
  });

  it('emits AND junctor vertices + junctor edges', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const doc = makeDoc(
      [a, b, c],
      [makeEdge(a.id, c.id, { andGroupId: 'and1' }), makeEdge(b.id, c.id, { andGroupId: 'and1' })]
    );
    const xml = exportToFlyingLogic(doc);
    expect(xml).toContain('type="junctor"');
    expect(xml).toContain('tp-studio-and-group-id');
    expect(xml).toContain('and1');
  });

  it('emits group vertices with member eids + the collapsed flag', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    doc.groups = { g1: group('g1', [a.id], { collapsed: true }) };
    const xml = exportToFlyingLogic(doc);
    expect(xml).toContain('grouped=');
    expect(xml).toContain('collapsed="true"');
    expect(xml).toContain('tp-studio-color');
  });

  it('escapes XML special characters in titles', () => {
    const a = makeEntity({ title: 'A & B <tag>' });
    const xml = exportToFlyingLogic(makeDoc([a], []));
    expect(xml).toContain('A &amp; B &lt;tag&gt;');
  });
});
