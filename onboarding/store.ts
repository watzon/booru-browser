import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Tracks whether the first-run intro has been seen. Not a secret, so it lives in
// AsyncStorage (unlike the age gate). `hydrated` flips once persisted state has
// been read back, so routing can wait before deciding to show onboarding.
type State = {
  completed: boolean;
  hydrated: boolean;
};

type Actions = {
  complete: () => void;
  reset: () => void;
  setHydrated: () => void;
};

export const useOnboardingStore = create<State & Actions>()(
  persist(
    (set) => ({
      completed: false,
      hydrated: false,
      complete: () => set({ completed: true }),
      reset: () => set({ completed: false }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'booru-browser:onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ completed: s.completed }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
