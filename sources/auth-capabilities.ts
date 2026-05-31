import type { AuthKind, SourceKind } from './types';

// Which auth modes each source family supports. The server form filters its
// option chips by this map so users only see relevant choices.
const AUTH_BY_KIND: Record<SourceKind, AuthKind[]> = {
  danbooru: ['none', 'basic', 'cookie'],
  gelbooru: ['none', 'queryParams', 'cookie'],
  e621: ['none', 'basic', 'cookie'],
  moebooru: ['none', 'basic', 'cookie'],
  kemono: ['none', 'cookie'],
  custom: ['none', 'basic', 'apiKey', 'queryParams', 'cookie'],
};

export function supportedAuthKinds(kind: SourceKind): AuthKind[] {
  return AUTH_BY_KIND[kind] ?? ['none'];
}

export const AUTH_LABEL: Record<AuthKind, string> = {
  none: 'None',
  basic: 'Username + API key',
  apiKey: 'API key header',
  queryParams: 'URL query params',
  cookie: 'Cookies',
};

export const AUTH_HINT: Partial<Record<SourceKind, Partial<Record<AuthKind, string>>>> = {
  danbooru: {
    basic:
      'Use your account login and API key. Authenticated API requests bypass site verification gates, so this is the most reliable option for Danbooru forks like ATF.',
  },
  e621: { basic: 'Use your username and the API key from your account settings.' },
  gelbooru: {
    queryParams:
      'Paste the api_key & user_id string from My Account → Options → API Access Credentials.',
  },
};

// Per-source path where users can create / view their API key. The form
// surfaces a one-tap shortcut that opens this in the embedded WebView, so the
// user can sign in once, copy their key, and paste it back into the form.
export const API_KEY_PATH: Partial<Record<SourceKind, string>> = {
  danbooru: '/api_keys',
  e621: '/users/home',
  moebooru: '/user/show', // shows the user profile with password-hash auth info
};
