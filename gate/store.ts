import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const GATE_KEY = 'booru_browser.gate.unlocked';
const RE_VERIFY_AFTER_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type GateState = {
  unlocked: boolean;
  lastVerifiedAt: number | null;
  hydrated: boolean;
};

type GateActions = {
  hydrate: () => Promise<void>;
  unlock: () => Promise<void>;
  lock: () => Promise<void>;
};

export const useGateStore = create<GateState & GateActions>((set) => ({
  unlocked: false,
  lastVerifiedAt: null,
  hydrated: false,
  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(GATE_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { lastVerifiedAt: number };
      const age = Date.now() - parsed.lastVerifiedAt;
      const stillValid = age < RE_VERIFY_AFTER_MS;
      set({
        unlocked: stillValid,
        lastVerifiedAt: parsed.lastVerifiedAt,
        hydrated: true,
      });
      if (!stillValid) {
        await SecureStore.deleteItemAsync(GATE_KEY);
      }
    } catch {
      set({ hydrated: true });
    }
  },
  unlock: async () => {
    const lastVerifiedAt = Date.now();
    await SecureStore.setItemAsync(GATE_KEY, JSON.stringify({ lastVerifiedAt }));
    set({ unlocked: true, lastVerifiedAt });
  },
  lock: async () => {
    await SecureStore.deleteItemAsync(GATE_KEY);
    set({ unlocked: false, lastVerifiedAt: null });
  },
}));

export function useGateHydration(): boolean {
  const hydrated = useGateStore((s) => s.hydrated);
  const hydrate = useGateStore((s) => s.hydrate);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!started) {
      setStarted(true);
      hydrate();
    }
  }, [started, hydrate]);
  return hydrated;
}
