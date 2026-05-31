export type Rating = 'safe' | 'questionable' | 'explicit' | 'unknown';

export type TagCategory =
  | 'general'
  | 'artist'
  | 'character'
  | 'copyright'
  | 'meta'
  | 'species'
  | 'lore'
  | 'unknown';

export type Tag = {
  name: string;
  category: TagCategory;
  postCount?: number;
};

export type Post = {
  id: string;
  sourceUrl: string;
  previewUrl: string;
  sampleUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  rating: Rating;
  tags: string[];
  tagsByCategory?: Partial<Record<TagCategory, string[]>>;
  score?: number;
  md5?: string;
  fileExt?: string;
  // Bytes; not all adapters populate this. Used to gate inline video autoplay.
  fileSize?: number;
  // Bytes for the sample (large) variant when distinct from `fileSize`. Many
  // adapters only expose the full-file size; this is preferred for autoplay
  // checks when present.
  sampleFileSize?: number;
  createdAt?: string;
  uploader?: string;
  blurhash?: string;
};

export type Page<T> = {
  items: T[];
  nextPage: number | null;
};

export type SortOrder = 'newest' | 'score' | 'random';

export type SearchQuery = {
  tags: string[];
  ratings?: Rating[];
  limit?: number;
  order?: SortOrder;
};

export type TagSuggestion = {
  name: string;
  category: TagCategory;
  postCount?: number;
};

export type SourceCapabilities = {
  autocomplete: boolean;
  ratingFilter: boolean;
  maxLimit: number;
  pagination: 'page' | 'cursor';
};

export type AuthConfig =
  | { type: 'none' }
  | { type: 'basic'; username: string; apiKey: string }
  | { type: 'apiKey'; header: string; key: string }
  | { type: 'queryParams'; params: Record<string, string> }
  | { type: 'cookie'; cookie: string };

export type AuthKind = AuthConfig['type'];

export type ServerConfig = {
  id: string;
  name: string;
  kind: SourceKind;
  baseUrl: string;
  auth?: AuthConfig;
  custom?: CustomSiteDefinition;
  // Route all API requests through an embedded WebView (Safari WebKit) instead
  // of native fetch. Useful for sites with TLS-fingerprint / JS-based bot
  // detection (e.g. ATF's verification gate). Slower per-request but works
  // when nothing else will.
  useWebViewFetch?: boolean;
};

export type SourceKind =
  | 'danbooru'
  | 'gelbooru'
  | 'e621'
  | 'moebooru'
  | 'kemono'
  | 'custom';

export type CustomSiteDefinition = {
  baseKind: Exclude<SourceKind, 'custom'>;
  paths?: {
    search?: string;
    autocomplete?: string;
    post?: string;
  };
  ratingMap?: Partial<Record<Rating, string>>;
  tagsField?: string;
};

export interface Source {
  readonly kind: SourceKind;
  readonly config: ServerConfig;
  readonly capabilities: SourceCapabilities;
  search(query: SearchQuery, page: number, signal?: AbortSignal): Promise<Page<Post>>;
  autocompleteTag(prefix: string, signal?: AbortSignal): Promise<TagSuggestion[]>;
  getPost(id: string, signal?: AbortSignal): Promise<Post>;
}
