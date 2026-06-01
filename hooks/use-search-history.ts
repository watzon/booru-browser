import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_RECENTS = 30;

// Recents are individual tags, most-recently-used first, per server. A search
// for multiple tags records each tag separately so they can be recombined,
// rather than pinning the whole phrase as one entry.
export type RecentTag = {
  tag: string;
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
  recents: RecentTag[];
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

export const recentTagKey = (r: { serverId: string; tag: string }) => `${r.serverId}|${r.tag}`;

export const useSearchHistoryStore = create<State & Actions>()(
  persist(
    (set) => ({
      recents: [],
      saved: [],

      // Records each tag of a search individually, newest first. Iterating in
      // order and unshifting means the last tag of the search lands frontmost,
      // so the most-recently-added tag is the most recent.
      pushRecent: (tags, serverId) =>
        set((state) => {
          const normalized = tags.map((t) => t.trim()).filter(Boolean);
          if (normalized.length === 0) return state;
          const now = Date.now();
          let recents = state.recents;
          for (const tag of normalized) {
            const key = recentTagKey({ serverId, tag });
            recents = [{ tag, serverId, ts: now }, ...recents.filter((r) => recentTagKey(r) !== key)];
          }
          return { recents: recents.slice(0, MAX_RECENTS) };
        }),

      removeRecent: (key) =>
        set((state) => ({
          recents: state.recents.filter((r) => recentTagKey(r) !== key),
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
      version: 2,
      // v1 stored recents as whole searches ({ tags: string[] }). Flatten them
      // into individual tags, newest-first, deduped per server.
      migrate: (persisted, version) => {
        const state = persisted as State & { recents?: unknown };
        if (version < 2 && Array.isArray(state?.recents)) {
          const flat: RecentTag[] = [];
          const seen = new Set<string>();
          for (const entry of state.recents as { tags?: string[]; serverId: string; ts?: number }[]) {
            for (const tag of entry.tags ?? []) {
              const key = `${entry.serverId}|${tag}`;
              if (!tag || seen.has(key)) continue;
              seen.add(key);
              flat.push({ tag, serverId: entry.serverId, ts: entry.ts ?? 0 });
            }
          }
          state.recents = flat.slice(0, MAX_RECENTS);
        }
        return state as State;
      },
    },
  ),
);
