import * as SecureStore from 'expo-secure-store';

import type { AuthConfig } from '@/sources/types';

const KEY_PREFIX = 'booru_browser.auth.';

// SecureStore only allows [A-Za-z0-9._-] in keys.
function keyFor(serverId: string): string {
  return KEY_PREFIX + serverId.replace(/[^A-Za-z0-9._-]/g, '_');
}

export async function loadAuth(serverId: string): Promise<AuthConfig | undefined> {
  const raw = await SecureStore.getItemAsync(keyFor(serverId));
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AuthConfig;
  } catch {
    return undefined;
  }
}

export async function saveAuth(serverId: string, auth: AuthConfig | undefined): Promise<void> {
  if (!auth || auth.type === 'none') {
    await SecureStore.deleteItemAsync(keyFor(serverId));
    return;
  }
  await SecureStore.setItemAsync(keyFor(serverId), JSON.stringify(auth));
}

export async function deleteAuth(serverId: string): Promise<void> {
  await SecureStore.deleteItemAsync(keyFor(serverId));
}
