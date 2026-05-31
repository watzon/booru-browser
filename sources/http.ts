import { breadcrumb, warn } from '@/lib/log';
import { webFetcher } from '@/services/webview-fetcher';
import { BROWSER_UA, refererFor } from './headers';
import type { AuthConfig } from './types';

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// Thrown when a request that should have returned JSON came back as a
// human-verification challenge page (ATF checkbox, Cloudflare interstitial,
// etc.). The UI surfaces an action to open the URL in a WebView so the user
// can complete the challenge once, then we retry.
export class VerificationRequired extends Error {
  constructor(readonly url: string) {
    super(`Verification required for ${url}`);
    this.name = 'VerificationRequired';
  }
}

const VERIFICATION_PATTERNS = [
  /<title>[^<]*\bverification\b[^<]*<\/title>/i,
  /<title>\s*Just a moment\.\.\.\s*<\/title>/i, // Cloudflare
  /id=["']challenge-checkbox["']/i,
  /cf[-_]chl[-_]bypass/i,
  /<noscript>[^<]*captcha/i,
];

function looksLikeVerificationPage(html: string): boolean {
  const head = html.slice(0, 4096);
  return VERIFICATION_PATTERNS.some((re) => re.test(head));
}

export function authHeaders(auth?: AuthConfig): Record<string, string> {
  if (!auth || auth.type === 'none') return {};
  if (auth.type === 'basic') {
    const token = base64(`${auth.username}:${auth.apiKey}`);
    return { Authorization: `Basic ${token}` };
  }
  if (auth.type === 'apiKey') {
    return { [auth.header]: auth.key };
  }
  if (auth.type === 'cookie') {
    return { Cookie: auth.cookie };
  }
  return {};
}

export function applyAuthToUrl(url: string, auth?: AuthConfig): string {
  if (!auth || auth.type !== 'queryParams') return url;
  const parsed = new URL(url);
  for (const [k, v] of Object.entries(auth.params)) {
    parsed.searchParams.set(k, v);
  }
  return parsed.toString();
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'unknown';
  }
}

export async function fetchJson<T>(
  url: string,
  opts: { auth?: AuthConfig; signal?: AbortSignal; viaWebView?: boolean } = {},
): Promise<T> {
  const finalUrl = applyAuthToUrl(url, opts.auth);
  const transport = opts.viaWebView ? 'webview' : 'native';
  breadcrumb({
    category: 'http',
    message: 'GET',
    data: { transport, origin: originOf(finalUrl) },
  });

  if (opts.viaWebView) {
    const result = await webFetcher.fetch(finalUrl, {
      Accept: 'application/json,text/plain,*/*',
    });
    breadcrumb({
      category: 'http',
      message: 'response',
      data: { transport, status: result.status, contentType: result.contentType, origin: originOf(finalUrl) },
      level: result.status >= 400 ? 'warning' : 'info',
    });
    if (result.status >= 400) {
      throw new HttpError(`HTTP ${result.status} for ${finalUrl}`, result.status, finalUrl);
    }
    try {
      return JSON.parse(result.body) as T;
    } catch {
      if (looksLikeVerificationPage(result.body)) {
        throw new VerificationRequired(finalUrl);
      }
      throw new Error(
        `Expected JSON but got ${result.contentType || 'unknown'} from ${finalUrl} (${result.body.slice(0, 80)}…)`,
      );
    }
  }

  const referer = refererFor(finalUrl);
  // Mimic a real browser navigation. Many booru sites (and bot-defense systems
  // in front of them) gate requests that look like raw API calls, even when
  // the actual URL ends in .json.
  const res = await fetch(finalUrl, {
    headers: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.85,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': BROWSER_UA,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      ...(referer ? { Referer: referer } : {}),
      ...authHeaders(opts.auth),
    },
    signal: opts.signal,
  });
  const contentType = res.headers.get('content-type') ?? '';
  breadcrumb({
    category: 'http',
    message: 'response',
    data: { transport, status: res.status, contentType, origin: originOf(finalUrl) },
    level: res.ok ? 'info' : 'warning',
  });
  if (!res.ok) {
    await safeReadBody(res);
    throw new HttpError(`HTTP ${res.status} for ${finalUrl}`, res.status, finalUrl);
  }
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    if (looksLikeVerificationPage(text)) {
      warn('[http] verification page detected', { origin: originOf(finalUrl) });
      throw new VerificationRequired(finalUrl);
    }
    throw new Error(
      `Expected JSON but got ${contentType || 'unknown'} from ${finalUrl} (${text.slice(0, 80)}…)`,
    );
  }
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function base64(input: string): string {
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(input);
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

export function buildUrl(base: string, path: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(path, base.endsWith('/') ? base : base + '/');
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}
