import { useEffect } from 'react';

import { loadAuth } from './credentials';
import { useServerStore } from './store';

// On startup, re-attach saved auth credentials to each server config so that
// authenticated requests work. The auth values themselves live in secure-store;
// the rest of the server metadata lives in AsyncStorage via zustand persist.
export function useServerCredentialHydration() {
  const servers = useServerStore((s) => s.servers);
  const updateServer = useServerStore((s) => s.updateServer);

  useEffect(() => {
    let cancelled = false;
    const toHydrate = servers.filter((s) => !s.auth);
    if (toHydrate.length === 0) return;
    Promise.all(
      toHydrate.map(async (s) => {
        const auth = await loadAuth(s.id);
        return { id: s.id, auth };
      }),
    ).then((results) => {
      if (cancelled) return;
      for (const { id, auth } of results) {
        if (auth) updateServer(id, { auth });
      }
    });
    return () => {
      cancelled = true;
    };
    // Only re-run when the server list shape changes. updateServer is stable
    // per render-pass of the zustand store anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.length]);
}
