import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type SortOrder = 'newest' | 'score' | 'random';
export type RatingFilter = 'all' | 'safe' | 'questionable' | 'explicit';
export type GalleryLayout = 'grid' | 'card';

type State = {
  tags: string[];
  order: SortOrder;
  ratingFilter: RatingFilter;
  layout: GalleryLayout;
};

type Actions = {
  setTags: (tags: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  clear: () => void;
  setOrder: (order: SortOrder) => void;
  setRatingFilter: (filter: RatingFilter) => void;
  resetFilters: () => void;
  setLayout: (layout: GalleryLayout) => void;
  toggleLayout: () => void;
};

// Browse reads from here; the drawer (tag-search) and the filter modal write
// to it. We persist `order`/`ratingFilter`/`layout` so user preferences survive
// restarts. Tags are intentionally NOT persisted — they belong to the recent-
// searches history (`use-search-history.ts`) and should reset between sessions
// so the app opens to "All posts".
export const useSearchStore = create<State & Actions>()(
  persist(
    (set) => ({
      tags: [],
      order: 'newest',
      ratingFilter: 'all',
      layout: 'grid',
      setTags: (tags) => set({ tags: dedupe(tags) }),
      addTag: (tag) =>
        set((s) => (s.tags.includes(tag) ? s : { tags: [...s.tags, tag] })),
      removeTag: (tag) => set((s) => ({ tags: s.tags.filter((t) => t !== tag) })),
      clear: () => set({ tags: [] }),
      setOrder: (order) => set({ order }),
      setRatingFilter: (ratingFilter) => set({ ratingFilter }),
      resetFilters: () => set({ order: 'newest', ratingFilter: 'all' }),
      setLayout: (layout) => set({ layout }),
      toggleLayout: () =>
        set((s) => ({ layout: s.layout === 'grid' ? 'card' : 'grid' })),
    }),
    {
      name: 'booru-browser:search-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        order: state.order,
        ratingFilter: state.ratingFilter,
        layout: state.layout,
      }),
    },
  ),
);

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean)));
}
