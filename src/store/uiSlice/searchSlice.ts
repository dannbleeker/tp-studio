import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import type { SearchOptions } from './types';

/**
 * FL-NA1 in-document search state. The actual matching logic lives in
 * `@/domain/search`; this slice just holds the query, options, and
 * current-match index. The search panel UI reads + writes these fields.
 */
export type SearchSlice = {
  searchOpen: boolean;
  searchQuery: string;
  searchOptions: SearchOptions;
  searchMatchIndex: number;

  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (q: string) => void;
  setSearchOptions: (opts: Partial<SearchOptions>) => void;
  setSearchMatchIndex: (i: number) => void;
};

export type SearchDataKeys = 'searchOpen' | 'searchQuery' | 'searchOptions' | 'searchMatchIndex';

export const searchDefaults = (): Pick<SearchSlice, SearchDataKeys> => ({
  searchOpen: false,
  searchQuery: '',
  searchOptions: { regex: false, caseSensitive: false, wholeWord: false },
  searchMatchIndex: 0,
});

export const createSearchSlice: StateCreator<RootStore, [], [], SearchSlice> = (set) => ({
  searchOpen: false,
  searchQuery: '',
  searchOptions: { regex: false, caseSensitive: false, wholeWord: false },
  searchMatchIndex: 0,

  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  setSearchQuery: (q) => set({ searchQuery: q, searchMatchIndex: 0 }),
  setSearchOptions: (opts) =>
    set((s) => ({
      searchOptions: { ...s.searchOptions, ...opts },
      searchMatchIndex: 0,
    })),
  setSearchMatchIndex: (i) => set({ searchMatchIndex: i }),
});
