// Central string dictionary. We're not setting up i18n in v1, but routing user-
// visible strings through this module makes a future i18n pass mechanical.

export const Strings = {
  // Common actions
  ACTION_OK: 'OK',
  ACTION_CANCEL: 'Cancel',
  ACTION_DELETE: 'Delete',
  ACTION_SAVE: 'Save',
  ACTION_RETRY: 'Retry',
  ACTION_OPEN: 'Open',
  ACTION_ADD: 'Add',
  ACTION_IMPORT: 'Import',
  ACTION_EXPORT: 'Export',
  ACTION_SCAN: 'Scan',
  ACTION_SHARE: 'Share',
  ACTION_DOWNLOAD: 'Download',
  ACTION_DONE: 'Done',
  ACTION_CLEAR: 'Clear',

  // Servers
  SERVERS_EMPTY_TITLE: 'No servers yet',
  SERVERS_EMPTY_BODY: 'Add a booru server or import a shared server list to get started.',
  SERVERS_DELETE_TITLE: 'Delete server?',
  SERVERS_DELETE_BODY: 'This removes the server and any saved credentials. Your favorites are kept but their source will show as removed.',
  SERVERS_SAVED: 'Server saved',

  // Favorites
  FAVORITES_EMPTY_TITLE: 'No favorites yet',
  FAVORITES_EMPTY_BODY: 'Tap the star on a post to save it here.',
  FAVORITES_ORPHAN_BADGE: 'Source server removed',
  FAVORITES_PRUNED: (n: number) => `Removed ${n} orphaned ${n === 1 ? 'favorite' : 'favorites'}`,

  // Browse / search
  BROWSE_EMPTY_NO_ACTIVE_SERVER_TITLE: 'No active server',
  BROWSE_EMPTY_NO_ACTIVE_SERVER_BODY: 'Pick a server from the Servers tab.',
  BROWSE_EMPTY_NO_POSTS_TITLE: 'No posts found',
  BROWSE_EMPTY_NO_POSTS_BODY: 'Try different tags or a different sort.',
  BROWSE_OFFLINE: "You're offline — showing cached results.",
  BROWSE_VERIFICATION_REQUIRED: 'This site needs a browser challenge before we can fetch posts.',

  SEARCH_EMPTY_TITLE: 'No tags',
  SEARCH_EMPTY_BODY: 'Type below to add a tag.',
  SEARCH_RECENTS_TITLE: 'Recent',
  SEARCH_SAVED_TITLE: 'Saved',
  SEARCH_SAVE_ACTION: 'Save current search',
  SEARCH_SAVE_PROMPT: 'Name this search',
  SEARCH_AUTOCOMPLETE_ERROR: "Couldn't load suggestions",

  // Import
  IMPORT_SUCCESS: (n: number) => `Imported ${n} ${n === 1 ? 'server' : 'servers'}`,
  IMPORT_FAILED: 'Import failed',

  // Settings
  SETTINGS_TITLE: 'Settings',
  SETTINGS_VERSION_LABEL: (v: string) => `Version ${v}`,
  SETTINGS_STORAGE_TITLE: 'Storage',
  SETTINGS_CLEAR_IMAGE_CACHE: 'Clear image cache',
  SETTINGS_CLEAR_DOWNLOADS: 'Clear downloads',
  SETTINGS_IMAGE_CACHE_SIZE: (size: string) => `Image cache · ${size}`,
  SETTINGS_DOWNLOADS_SIZE: (size: string) => `Downloads · ${size}`,
  SETTINGS_GATE_LOCKED: 'Mature content is hidden',
  SETTINGS_GATE_UNLOCKED: 'Mature content is unlocked',

  // Generic errors
  ERROR_GENERIC_TITLE: 'Something went wrong',
  ERROR_GENERIC_BODY: 'Pull to try again, or report this if it keeps happening.',
  ERROR_NETWORK: 'Network error — check your connection.',
  ERROR_OFFLINE: "You're offline",

  // Toasts
  TOAST_COPIED: 'Copied to clipboard',
  TOAST_DOWNLOAD_DONE: 'Saved to Photos',
  TOAST_DOWNLOAD_FAILED: 'Download failed',
  TOAST_FAVORITED: 'Added to favorites',
  TOAST_UNFAVORITED: 'Removed from favorites',
} as const;
