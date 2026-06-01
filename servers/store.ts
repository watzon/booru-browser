import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ServerConfig } from '@/sources/types';
import { invalidateSource } from '@/sources/registry';

type ServerStoreState = {
  servers: ServerConfig[];
  activeServerId: string | null;
  /** Server ids in most-recently-used order (index 0 = most recent). Drives the
   *  ordering of the hold-to-switch menu so frequent boorus stay in thumb reach. */
  recentServerIds: string[];
};

/** Move `id` to the front of the MRU list (deduped). */
function bumpRecent(list: string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)];
}

type ServerStoreActions = {
  addServer: (server: ServerConfig) => void;
  updateServer: (id: string, patch: Partial<ServerConfig>) => void;
  removeServer: (id: string) => void;
  setActiveServer: (id: string | null) => void;
  importMany: (servers: ServerConfig[], defaultId?: string) => { added: number; updated: number };
};

export type ServerStore = ServerStoreState & ServerStoreActions;

export const useServerStore = create<ServerStore>()(
  persist(
    (set, get) => ({
      servers: [],
      activeServerId: null,
      recentServerIds: [],
      addServer: (server) =>
        set((state) => {
          const existing = state.servers.findIndex((s) => s.id === server.id);
          const next = [...state.servers];
          if (existing >= 0) next[existing] = server;
          else next.push(server);
          invalidateSource(server.id);
          const activeServerId = state.activeServerId ?? server.id;
          return {
            servers: next,
            activeServerId,
            recentServerIds: bumpRecent(state.recentServerIds, activeServerId),
          };
        }),
      updateServer: (id, patch) =>
        set((state) => {
          const next = state.servers.map((s) => (s.id === id ? { ...s, ...patch } : s));
          invalidateSource(id);
          return { servers: next };
        }),
      removeServer: (id) =>
        set((state) => {
          invalidateSource(id);
          const next = state.servers.filter((s) => s.id !== id);
          const activeServerId =
            state.activeServerId === id ? (next[0]?.id ?? null) : state.activeServerId;
          let recentServerIds = state.recentServerIds.filter((x) => x !== id);
          if (activeServerId) recentServerIds = bumpRecent(recentServerIds, activeServerId);
          return { servers: next, activeServerId, recentServerIds };
        }),
      setActiveServer: (id) =>
        set((state) => ({
          activeServerId: id,
          recentServerIds: id ? bumpRecent(state.recentServerIds, id) : state.recentServerIds,
        })),
      importMany: (incoming, defaultId) => {
        let added = 0;
        let updated = 0;
        set((state) => {
          const map = new Map(state.servers.map((s) => [s.id, s]));
          for (const s of incoming) {
            if (map.has(s.id)) updated++;
            else added++;
            map.set(s.id, s);
            invalidateSource(s.id);
          }
          const servers = Array.from(map.values());
          const activeServerId =
            defaultId && servers.some((s) => s.id === defaultId)
              ? defaultId
              : (state.activeServerId ?? servers[0]?.id ?? null);
          return {
            servers,
            activeServerId,
            recentServerIds: activeServerId
              ? bumpRecent(state.recentServerIds, activeServerId)
              : state.recentServerIds,
          };
        });
        return { added, updated };
      },
    }),
    {
      name: 'booru-browser:servers',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        servers: state.servers.map(({ auth: _auth, ...rest }) => rest),
        activeServerId: state.activeServerId,
        recentServerIds: state.recentServerIds,
      }),
    },
  ),
);

export function useActiveServer(): ServerConfig | null {
  const id = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);
  return servers.find((s) => s.id === id) ?? null;
}
