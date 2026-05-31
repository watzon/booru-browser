/**
 * Tiny logging shim. In dev, forwards to the console; in production it stays
 * silent. All call sites should go through here rather than calling console
 * directly — that keeps prod logs clean and gives us a single seam to route
 * logs to a reporter later if we ever add one. (The app intentionally ships
 * with no analytics/crash reporting, matching the privacy promise in Settings.)
 */

type Breadcrumb = {
  category?: string;
  message: string;
  data?: Record<string, unknown>;
  level?: 'debug' | 'info' | 'warning' | 'error';
};

const isDev = __DEV__;

export function debug(...args: unknown[]) {
  if (isDev) console.log('[debug]', ...args);
}

export function info(...args: unknown[]) {
  if (isDev) console.log('[info]', ...args);
}

export function warn(...args: unknown[]) {
  if (isDev) console.warn('[warn]', ...args);
}

export function error(...args: unknown[]) {
  if (isDev) console.error('[error]', ...args);
}

export function breadcrumb(crumb: Breadcrumb) {
  if (isDev) console.log(`[crumb:${crumb.category ?? 'app'}]`, crumb.message, crumb.data ?? '');
}

export function reportError(err: unknown, extra?: Record<string, unknown>) {
  if (isDev) console.error('[reportError]', err, extra);
}
