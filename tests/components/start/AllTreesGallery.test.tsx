import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AllTreesGallery } from '@/components/start/AllTreesGallery';
import type { SavedTree } from '@/components/start/useSavedTrees';
import type { DiagramType, DocumentId } from '@/domain/types';
import { resetStoreForTest } from '@/store';
import { makeDoc } from '../../domain/helpers';

/**
 * Session 193 — the in-place filter over the "All trees" gallery. Filters the
 * already-loaded SavedTree[] client-side by title + diagram-type tag.
 */

beforeEach(resetStoreForTest);
afterEach(cleanup);

const tree = (title: string, type: DiagramType): SavedTree => {
  const doc = makeDoc([], [], type);
  doc.title = title;
  return { id: `id-${title}` as DocumentId, doc, openWarnings: 0, isOpen: false };
};

const TREES: SavedTree[] = [
  tree('Sales pipeline stall', 'crt'),
  tree('Pricing conflict', 'ec'),
  tree('Onboarding rollout', 'tt'),
];

const cardTitles = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('h4')).map((h) => h.textContent?.trim() ?? '');

describe('AllTreesGallery filter', () => {
  it('shows every tree when the filter is empty', () => {
    const { container } = render(<AllTreesGallery trees={TREES} />);
    expect(cardTitles(container).sort()).toEqual(
      ['Onboarding rollout', 'Pricing conflict', 'Sales pipeline stall'].sort()
    );
  });

  it('filters by title substring, case-insensitively', () => {
    const { container, getByLabelText } = render(<AllTreesGallery trees={TREES} />);
    fireEvent.change(getByLabelText(/Filter trees/), { target: { value: 'pric' } });
    expect(cardTitles(container)).toEqual(['Pricing conflict']);
  });

  it('filters by diagram-type tag (e.g. "crt")', () => {
    const { container, getByLabelText } = render(<AllTreesGallery trees={TREES} />);
    fireEvent.change(getByLabelText(/Filter trees/), { target: { value: 'crt' } });
    expect(cardTitles(container)).toEqual(['Sales pipeline stall']);
  });

  it('shows a no-match empty state when nothing matches', () => {
    const { container, getByText, getByLabelText } = render(<AllTreesGallery trees={TREES} />);
    fireEvent.change(getByLabelText(/Filter trees/), { target: { value: 'zzzzz' } });
    expect(cardTitles(container)).toEqual([]);
    expect(getByText(/No trees match/)).toBeTruthy();
  });
});
