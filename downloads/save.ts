import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

import type { Post } from '@/sources/types';

export type DownloadController = {
  uri: string;
  promise: Promise<string>;
  cancel: () => Promise<void>;
};

export type DownloadOptions = {
  headers?: Record<string, string>;
  onProgress?: (fraction: number) => void;
};

function filenameFor(post: Post): string {
  const ext = post.fileExt ?? extensionFromUrl(post.fullUrl) ?? 'jpg';
  return `${post.id}.${ext}`;
}

function extensionFromUrl(url: string): string | undefined {
  const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return m ? m[1].toLowerCase() : undefined;
}

// Cancellable download with progress. Resolves with the local URI of the
// downloaded file. Reject reason is the literal string 'canceled' when the
// caller cancels, so the UI can swallow that case quietly.
// Downloads land in a dedicated cache subdirectory so Settings can measure and
// clear them in isolation. It lives under cacheDirectory (OS-evictable) because
// a "download" is transient — it's immediately saved to Photos or handed to the
// share sheet, so we don't want it counting against persistent app storage.
export function downloadsDir(): string | null {
  return FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}downloads/` : null;
}

async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

export function startDownload(post: Post, opts: DownloadOptions = {}): DownloadController {
  const dir = downloadsDir();
  if (!dir) throw new Error('No cache directory available');
  const target = `${dir}${filenameFor(post)}`;

  const resumable = FileSystem.createDownloadResumable(
    post.fullUrl,
    target,
    opts.headers ? { headers: opts.headers } : {},
    (data) => {
      const total = data.totalBytesExpectedToWrite;
      if (!total || total <= 0) return;
      opts.onProgress?.(data.totalBytesWritten / total);
    },
  );

  let canceled = false;

  const promise = (async () => {
    await ensureDir(dir);
    const result = await resumable.downloadAsync();
    if (!result || canceled) throw new Error('canceled');
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Download failed with HTTP ${result.status}`);
    }
    return result.uri;
  })();

  return {
    uri: target,
    promise,
    cancel: async () => {
      canceled = true;
      try {
        await resumable.cancelAsync();
      } catch {
        // already finished
      }
    },
  };
}

export async function shareLink(post: Post): Promise<void> {
  await Share.share({
    url: post.sourceUrl,
    message: post.sourceUrl,
  });
}

export async function saveLocalUriToPhotos(uri: string): Promise<'saved' | 'denied'> {
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) return 'denied';
  await MediaLibrary.saveToLibraryAsync(uri);
  return 'saved';
}

export async function shareLocalUri(uri: string, post: Post): Promise<'shared' | 'denied'> {
  if (!(await Sharing.isAvailableAsync())) return 'denied';
  await Sharing.shareAsync(uri, { dialogTitle: `Share post ${post.id}` });
  return 'shared';
}
