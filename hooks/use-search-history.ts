import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_RECENTS = 20;

export type RecentSearch = {
  tags: string[];
  serverId: string;
  ts: number;
};

export type SavedSearch = {
  id: string;
  name: string;
  tags: string[];
  serverId?: string;
};

type State = {
  recents: RecentSearch[];
  saved: SavedSearch[];
};

type Actions = {
  pushRecent: (tags: string[], serverId: string) => void;
  removeRecent: (key: string) => void;
  clearRecents: () => void;
  saveSearch: (input: { name: string; tags: string[]; serverId?: string }) => SavedSearch;
  renameSaved: (id: string, name: string) => void;
  deleteSaved: (id: string) => void;
};

export const recentKey = (r: { serverId: string; tags: string[] }) =>
  `${r.serverId}|${r.tags.slice().sort().join(' ')}`;

export const useSearchHistoryStore = create<State & Actions>()(
  persist(
    (set) => ({
      recents: [],
      saved: [],

      pushRecent: (tags, serverId) =>
        set((state) => {
          const normalized = tags.map((t) => t.trim()).filter(Boolean);
          if (normalized.length === 0) return state;
          const entry: RecentSearch = { tags: normalized, serverId, ts: Date.now() };
          const key = recentKey(entry);
          const filtered = state.recents.filter((r) => recentKey(r) !== key);
          const next = [entry, ...filtered].slice(0, MAX_RECENTS);
          return { recents: next };
        }),

      removeRecent: (key) =>
        set((state) => ({
          recents: state.recents.filter((r) => recentKey(r) !== key),
        })),

      clearRecents: () => set({ recents: [] }),

      saveSearch: ({ name, tags, serverId }) => {
        const entry: SavedSearch = {
          id: `s_${Date.now().toString(36)}`,
          name: name.trim() || tags.join(' '),
          tags: tags.map((t) => t.trim()).filter(Boolean),
          serverId,
        };
        set((state) => ({ saved: [entry, ...state.saved] }));
        return entry;
      },

      renameSaved: (id, name) =>
        set((state) => ({
          saved: state.saved.map((s) => (s.id === id ? { ...s, name: name.trim() || s.name } : s)),
        })),

      deleteSaved: (id) =>
        set((state) => ({ saved: state.saved.filter((s) => s.id !== id) })),
    }),
    {
      name: 'booru-browser:search-history',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    },
  ),
);
