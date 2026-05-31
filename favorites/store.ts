import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Post } from '@/sources/types';

export type FavoriteEntry = {
  serverId: string;
  post: Post;
  addedAt: number;
};

type FavoritesState = {
  entries: FavoriteEntry[];
};

type FavoritesActions = {
  add: (serverId: string, post: Post) => void;
  remove: (serverId: string, postId: string) => void;
  toggle: (serverId: string, post: Post) => boolean;
  has: (serverId: string, postId: string) => boolean;
  clearForServer: (serverId: string) => void;
  /**
   * Remove favorites whose source server no longer exists. Returns the count
   * removed so the caller can surface a toast.
   */
  pruneOrphans: (activeServerIds: ReadonlySet<string>) => number;
  /**
   * Returns true if the favorite's source server is gone — the Favorites UI
   * uses this to show an "Source removed" badge.
   */
  isOrphan: (serverId: string, activeServerIds: ReadonlySet<string>) => boolean;
};

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  persist(
    (set, get) => ({
      entries: [],
      add: (serverId, post) =>
        set((state) => {
          if (state.entries.some((e) => e.serverId === serverId && e.post.id === post.id)) {
            return state;
          }
          return {
            entries: [{ serverId, post, addedAt: Date.now() }, ...state.entries],
          };
        }),
      remove: (serverId, postId) =>
        set((state) => ({
          entries: state.entries.filter(
            (e) => !(e.serverId === serverId && e.post.id === postId),
          ),
        })),
      toggle: (serverId, post) => {
        const has = get().has(serverId, post.id);
        if (has) get().remove(serverId, post.id);
        else get().add(serverId, post);
        return !has;
      },
      has: (serverId, postId) =>
        get().entries.some((e) => e.serverId === serverId && e.post.id === postId),
      clearForServer: (serverId) =>
        set((state) => ({
          entries: state.entries.filter((e) => e.serverId !== serverId),
        })),
      pruneOrphans: (activeServerIds) => {
        let removed = 0;
        set((state) => {
          const next = state.entries.filter((e) => {
            const keep = activeServerIds.has(e.serverId);
            if (!keep) removed++;
            return keep;
          });
          return removed > 0 ? { entries: next } : state;
        });
        return removed;
      },
      isOrphan: (serverId, activeServerIds) => !activeServerIds.has(serverId),
    }),
    {
      name: 'booru-browser:favorites',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
