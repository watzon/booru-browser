import type WebView from 'react-native-webview';

export type WebFetchResult = {
  status: number;
  contentType: string;
  body: string;
};

type Pending = {
  resolve: (r: WebFetchResult) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Singleton that proxies fetch() calls through an invisible WebView. Used for
// sites with bot detection that blocks native fetch (TLS fingerprinting,
// in-page-only cookies, etc.). The WebView is mounted by WebFetcherHost and
// kept loaded for the lifetime of the active server.
class WebViewFetcher {
  private webRef: WebView | null = null;
  private pending = new Map<string, Pending>();
  private readyForBaseUrl: string | null = null;
  private readyWaiters: ((ok: boolean) => void)[] = [];

  setRef(ref: WebView | null) {
    this.webRef = ref;
  }

  setReady(baseUrl: string) {
    this.readyForBaseUrl = baseUrl;
    const waiters = this.readyWaiters.splice(0);
    waiters.forEach((cb) => cb(true));
  }

  reset() {
    this.readyForBaseUrl = null;
    const waiters = this.readyWaiters.splice(0);
    waiters.forEach((cb) => cb(false));
    // Reject everything pending so callers don't hang.
    const pending = Array.from(this.pending.values());
    this.pending.clear();
    pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('WebView fetcher reset'));
    });
  }

  private waitReady(timeoutMs = 30_000): Promise<void> {
    if (this.readyForBaseUrl) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.readyWaiters.indexOf(cb);
        if (idx >= 0) this.readyWaiters.splice(idx, 1);
        reject(new Error('WebView fetcher not ready (timed out)'));
      }, timeoutMs);
      const cb = (ok: boolean) => {
        clearTimeout(timer);
        if (ok) resolve();
        else reject(new Error('WebView fetcher reset before ready'));
      };
      this.readyWaiters.push(cb);
    });
  }

  async fetch(url: string, headers?: Record<string, string>): Promise<WebFetchResult> {
    if (!this.webRef) throw new Error('WebView fetcher has no ref yet');
    await this.waitReady();
    const id = Math.random().toString(36).slice(2);
    const headersJson = JSON.stringify(headers ?? {});
    const urlJson = JSON.stringify(url);
    const idJson = JSON.stringify(id);
    const script = `
      (async () => {
        const id = ${idJson};
        try {
          const res = await fetch(${urlJson}, { credentials: 'include', headers: ${headersJson} });
          const body = await res.text();
          const ct = (res.headers && res.headers.get) ? (res.headers.get('content-type') || '') : '';
          window.ReactNativeWebView.postMessage(JSON.stringify({
            __wf: true, id, status: res.status, contentType: ct, body,
          }));
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            __wf: true, id, error: String((e && e.message) || e),
          }));
        }
      })();
      true;
    `;
    return new Promise<WebFetchResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`WebView fetch timeout for ${url}`));
        }
      }, 30_000);
      this.pending.set(id, { resolve, reject, timer });
      this.webRef!.injectJavaScript(script);
    });
  }

  handleMessage(data: string) {
    let parsed: {
      __wf?: boolean;
      id?: string;
      status?: number;
      contentType?: string;
      body?: string;
      error?: string;
    };
    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }
    if (!parsed.__wf || !parsed.id) return;
    const pending = this.pending.get(parsed.id);
    if (!pending) return;
    this.pending.delete(parsed.id);
    clearTimeout(pending.timer);
    if (parsed.error) {
      pending.reject(new Error(parsed.error));
      return;
    }
    pending.resolve({
      status: parsed.status ?? 0,
      contentType: parsed.contentType ?? '',
      body: parsed.body ?? '',
    });
  }
}

export const webFetcher = new WebViewFetcher();
