import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { ServerConfig } from '@/sources/types';
import type { BoorucfgFile, SharedServer } from './schema';

export function buildExportPayload(
  servers: ServerConfig[],
  defaultServerId?: string | null,
): BoorucfgFile {
  return {
    version: 1,
    servers: servers.map(stripSecrets),
    defaultServerId: defaultServerId ?? undefined,
  };
}

function stripSecrets(s: ServerConfig): SharedServer {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { auth: _auth, ...rest } = s;
  return rest as SharedServer;
}

export function buildShareableUrl(payload: BoorucfgFile): string {
  const json = JSON.stringify(payload);
  return `boorubrowser://import?data=${encodeBase64Url(json)}`;
}

export async function shareAsFile(payload: BoorucfgFile): Promise<void> {
  const filename = 'servers.booruconfig.json';
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!dir) throw new Error('No writable directory available');
  const uri = `${dir}${filename}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export server list',
      UTI: 'public.json',
    });
  }
}

function encodeBase64Url(input: string): string {
  const std =
    typeof globalThis.btoa === 'function' ? globalThis.btoa(input) : encodeBase64Fallback(input);
  return std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function encodeBase64Fallback(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  if (i < bytes.length) {
    const rest = bytes.length - i;
    const n = (bytes[i] << 16) | ((rest === 2 ? bytes[i + 1] : 0) << 8);
    out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63];
    out += rest === 2 ? chars[(n >> 6) & 63] : '=';
    out += '=';
  }
  return out;
}
