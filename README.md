# Booru Browser

A modern, gallery-focused Expo app for browsing booru-style image sites. Supports Danbooru, Gelbooru, e621, Moebooru/Konachan, and Kemono via pluggable adapters.

## Key features

- **No bundled server list.** Add servers manually, import a `.booruconfig.json`, or scan a QR code.
- **SFW by default.** Mature content is gated behind an age-confirmation toggle hidden under Settings → tap "Booru Browser v1.0.0" 7 times.
- **Per-site authentication.** API keys are stored in the iOS Keychain via `expo-secure-store`, never in plain storage.
- **Fast image grids.** Virtualized via `@shopify/flash-list`, with `expo-image` caching.
- **Tag search with autocomplete** per-source.
- **Local favorites + downloads to Photos.**

## Development

```sh
pnpm install
pnpm ios     # or pnpm android
```

The first build requires a development build (not Expo Go) because of `expo-camera`, `expo-media-library`, and `expo-secure-store`.

```sh
pnpm exec eas build --profile development --platform ios
```

## Importing a server list

The app deep-links via `boorubrowser://`. Two payload styles are supported:

```
boorubrowser://import?src=https://example.com/list.json
boorubrowser://import?data=<base64-url-encoded JSON>
```

A sample list lives in [`examples/sample.booruconfig.json`](examples/sample.booruconfig.json).

## Architecture

```
sources/       Source adapter interface + per-family adapters
servers/       User's server list (zustand + AsyncStorage) and auth (secure-store)
gate/          NSFW age-gate (secure-store) and rating-filter enforcement
favorites/     Locally-saved posts
downloads/     File-system + share-sheet helpers
components/    UI primitives (post grid, viewer, server form, tag search)
app/           expo-router screens
```

The age gate is enforced through a single `applyRatingFilter` wrapper that every search query passes through — UI code cannot accidentally bypass it.
