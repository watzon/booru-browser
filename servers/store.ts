import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ServerConfig } from '@/sources/types';
import { invalidateSource } from '@/sources/registry';

type ServerStoreState = {
  servers: ServerConfig[];
  activeServerId: string | null;
};

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
      addServer: (server) =>
        set((state) => {
          const existing = state.servers.findIndex((s) => s.id === server.id);
          const next = [...state.servers];
          if (existing >= 0) next[existing] = server;
          else next.push(server);
          invalidateSource(server.id);
          return {
            servers: next,
            activeServerId: state.activeServerId ?? server.id,
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
          return {
            servers: next,
            activeServerId:
              state.activeServerId === id ? (next[0]?.id ?? null) : state.activeServerId,
          };
        }),
      setActiveServer: (id) => set({ activeServerId: id }),
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
          return {
            servers,
            activeServerId:
              defaultId && servers.some((s) => s.id === defaultId)
                ? defaultId
                : (state.activeServerId ?? servers[0]?.id ?? null),
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
      }),
    },
  ),
);

export function useActiveServer(): ServerConfig | null {
  const id = useServerStore((s) => s.activeServerId);
  const servers = useServerStore((s) => s.servers);
  return servers.find((s) => s.id === id) ?? null;
}
