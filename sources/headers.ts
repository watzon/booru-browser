// Many booru sites sit behind Cloudflare and block requests that don't look
// like a real browser. We use a Safari UA + a same-origin Referer for both API
// calls (via fetchJson) and image loads (via expo-image source headers).

export const BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

export function refererFor(url: string): string | undefined {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return undefined;
  }
}

export function imageHeaders(baseUrl?: string): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': BROWSER_UA };
  const r = baseUrl ? refererFor(baseUrl) : undefined;
  if (r) headers.Referer = r;
  return headers;
}
