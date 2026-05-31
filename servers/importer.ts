import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import type { ServerConfig } from '@/sources/types';
import { BOORUCONFIG_FILE_SCHEMA, type BoorucfgFile } from './schema';

export type ImportResult = {
  file: BoorucfgFile;
  servers: ServerConfig[];
};

export async function importFromFile(): Promise<ImportResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri);
  return parsePayload(content);
}

export async function importFromUrlScheme(url: string): Promise<ImportResult | null> {
  const parsed = new URL(url);
  const srcUrl = parsed.searchParams.get('src');
  const dataB64 = parsed.searchParams.get('data');
  if (srcUrl) {
    const res = await fetch(srcUrl);
    if (!res.ok) throw new Error(`Failed to fetch list: HTTP ${res.status}`);
    const text = await res.text();
    return parsePayload(text);
  }
  if (dataB64) {
    const text = decodeBase64Url(dataB64);
    return parsePayload(text);
  }
  return null;
}

export async function importFromClipboard(): Promise<ImportResult | null> {
  const text = await Clipboard.getStringAsync();
  if (!text) return null;
  return parsePayload(text);
}

export function parsePayload(text: string): ImportResult {
  const trimmed = text.trim();
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch (e) {
    // Maybe it's a boorubrowser:// URL pasted as text
    if (trimmed.startsWith('boorubrowser://')) {
      throw new Error('URL detected — open the link directly instead of pasting.');
    }
    throw new Error('Not valid JSON: ' + (e as Error).message);
  }
  const parsed = BOORUCONFIG_FILE_SCHEMA.parse(json);
  return {
    file: parsed,
    servers: parsed.servers as ServerConfig[],
  };
}

function decodeBase64Url(input: string): string {
  const normal = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normal.length % 4 === 0 ? '' : '='.repeat(4 - (normal.length % 4));
  const decoded =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(normal + pad)
      : decodeBase64Fallback(normal + pad);
  return decoded;
}

function decodeBase64Fallback(s: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const c of s) {
    if (c === '=') break;
    const v = chars.indexOf(c);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 0xff);
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}
