@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is an Expo SDK 54 app managed with **pnpm**.

```sh
pnpm install
pnpm ios          # expo start --ios   (requires a dev build, not Expo Go)
pnpm android      # expo start --android
pnpm web          # expo start --web
pnpm start        # expo start (choose target interactively)
pnpm lint         # expo lint (eslint-config-expo)
```

A dev build is mandatory — `expo-camera`, `expo-media-library`, and `expo-secure-store` are not available in Expo Go:

```sh
pnpm exec eas build --profile development --platform ios
```

There is no test runner configured.

TypeScript path alias: `@/*` resolves to the repo root (see `tsconfig.json`). Use it for all internal imports.

## Architecture

### Layer separation (enforced by directory layout)

```
sources/       Source adapter interface + per-family adapters (danbooru, gelbooru, e621, moebooru, kemono, custom)
servers/       User's server list (zustand+AsyncStorage) and auth credentials (expo-secure-store)
gate/          NSFW age-gate + the single rating-filter enforcement point
favorites/     Locally-saved posts
downloads/     File-system + share-sheet helpers
services/      Cross-cutting services (e.g. webview-fetcher)
components/    UI primitives (post grid, viewer, server form, tag search)
hooks/         React Query hooks + zustand search-state store
app/           expo-router screens (typedRoutes enabled)
```

### The age gate is structural, not advisory

`gate/ratingFilter.ts` exports `applyRatingFilter(query, gateUnlocked, userFilter)`. **Every** call to `Source.search` must pass its query through this function. Locked gate → `ratings: ['safe']` is forced regardless of user filter. The whole point is that UI code cannot accidentally bypass it — preserve this invariant. The canonical caller is `hooks/use-post-search.ts`; new search paths must follow the same pattern.

The gate is unlocked via a hidden gesture: Settings → tap the version string 7 times. Unlock state persists 30 days in secure-store (`gate/store.ts`).

### Sources are pluggable adapters behind one interface

`sources/types.ts` defines `Source` (search / autocompleteTag / getPost) and `ServerConfig`. `sources/registry.ts` is the factory; it caches one `Source` instance per `ServerConfig` and exposes `invalidateSource(id)` which **must** be called whenever a `ServerConfig` is mutated (the server store already does this — match that pattern in any new mutation path).

A `kind: 'custom'` server uses `CustomSiteDefinition` to declaratively reskin one of the built-in adapters (paths, ratingMap, tagsField).

### HTTP layer is intentionally browser-mimicking

`sources/http.ts#fetchJson` sends Safari-like headers (full `Sec-Fetch-*`, `Accept: text/html…`, Referer derived per-host in `sources/headers.ts`). Many booru sites gate raw-API-looking traffic; this is the workaround. **Don't replace this with a plain `fetch`** unless you understand why these headers are here.

Two failure modes get first-class treatment:
- `HttpError` — non-2xx, carries status and url.
- `VerificationRequired` — response body looks like a Cloudflare / ATF / captcha interstitial (see `VERIFICATION_PATTERNS`). UI surfaces a "open in WebView to verify" action.

When a server has `useWebViewFetch: true`, requests are routed through `services/webview-fetcher.ts` — a singleton that proxies fetches through an invisible `<WebView>` mounted at the root by `components/web-fetcher-host.tsx`. Slower per request but bypasses TLS-fingerprinting / JS-only-cookie defenses.

### Credentials vs. config

`ServerConfig.auth` (an `AuthConfig` discriminated union: none | basic | apiKey | queryParams | cookie) is **stripped from persisted server state** in `servers/store.ts` via `partialize`. The auth payload itself lives in `expo-secure-store` (`servers/credentials.ts`) keyed by server id. On app start, `servers/hydrate.ts#useServerCredentialHydration` re-attaches it. When adding a new auth flow, follow this split — never persist secrets through AsyncStorage / zustand.

### Data flow for the post grid

`app/(tabs)/index.tsx` → `usePostSearch(activeServer)` (`hooks/use-post-search.ts`) → React Query `useInfiniteQuery` keyed on `[server.id, tags, order, ratingFilter, gateUnlocked]` → `applyRatingFilter` → `getSource(server).search(...)`. Query is gated by `gateHydrated` so we never fire a request before the SFW gate decision is known.

Search state (`tags`, `order`, `ratingFilter`) lives in the zustand store `hooks/use-search-store.ts`; it's not URL state.

### Root providers

`app/_layout.tsx` wires `GestureHandlerRootView` → `QueryClientProvider` (staleTime 30s, retry 1, no refocus refetch) → `ThemeProvider`. It also mounts `<NavOverlay />` and `<WebFetcherHost />` as siblings of the `<Stack>` — needed by the WebView fetcher described above. Reanimated must be imported here.

### Deep links

Scheme is `boorubrowser://`. Import flows:
- `boorubrowser://import?src=<url>` — fetch list JSON
- `boorubrowser://import?data=<base64url>` — inline JSON
QR scanning hits the same import path via `app/scan.tsx`.

Sample payload: `examples/sample.booruconfig.json`.

## Expo SDK version

This project targets Expo SDK 54 with the new architecture (`newArchEnabled: true`) and the React Compiler experiment on. **Read https://docs.expo.dev/versions/v54.0.0/ before touching any Expo or React Native APIs** — your training data likely predates breaking changes (expo-file-system rewrite, expo-image-picker changes, etc.). When in doubt about a module's API, fetch the v54 docs rather than guessing.
