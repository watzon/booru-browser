import { create } from 'zustand';

type State = {
  capturedCookie: string | null;
};

type Actions = {
  capture: (cookie: string) => void;
  consume: () => string | null;
  clear: () => void;
};

// Tiny in-memory store the validate-client WebView writes to, and the server
// form reads from on focus. Not persisted — only meaningful within a single
// add/edit session.
export const useValidateScratchpad = create<State & Actions>((set, get) => ({
  capturedCookie: null,
  capture: (cookie) => set({ capturedCookie: cookie }),
  consume: () => {
    const v = get().capturedCookie;
    set({ capturedCookie: null });
    return v;
  },
  clear: () => set({ capturedCookie: null }),
}));
