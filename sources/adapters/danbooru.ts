import { buildUrl, fetchJson } from '../http';
import type {
  Page,
  Post,
  Rating,
  SearchQuery,
  ServerConfig,
  Source,
  SourceCapabilities,
  TagCategory,
  TagSuggestion,
} from '../types';

type DanbooruPost = {
  id: number;
  preview_file_url?: string | null;
  large_file_url?: string | null;
  file_url?: string | null;
  image_width: number;
  image_height: number;
  rating: 's' | 'q' | 'e' | 'g';
  tag_string: string;
  tag_string_general?: string;
  tag_string_artist?: string;
  tag_string_character?: string;
  tag_string_copyright?: string;
  tag_string_meta?: string;
  score?: number;
  md5?: string;
  file_ext?: string;
  file_size?: number;
  created_at?: string;
  uploader_name?: string;
};

type DanbooruTagAutocomplete = {
  type: string;
  label: string;
  value: string;
  category: number;
  post_count: number;
};

const TAG_CATEGORY: Record<number, TagCategory> = {
  0: 'general',
  1: 'artist',
  3: 'copyright',
  4: 'character',
  5: 'meta',
};

function mapRating(r: DanbooruPost['rating']): Rating {
  switch (r) {
    case 'g':
    case 's':
      return 'safe';
    case 'q':
      return 'questionable';
    case 'e':
      return 'explicit';
    default:
      return 'unknown';
  }
}

function normalizePost(p: DanbooruPost, baseUrl: string): Post {
  const preview = p.preview_file_url ?? p.large_file_url ?? p.file_url ?? '';
  const sample = p.large_file_url ?? p.file_url ?? preview;
  const full = p.file_url ?? sample;
  return {
    id: String(p.id),
    sourceUrl: `${baseUrl.replace(/\/$/, '')}/posts/${p.id}`,
    previewUrl: preview,
    sampleUrl: sample,
    fullUrl: full,
    width: p.image_width,
    height: p.image_height,
    rating: mapRating(p.rating),
    tags: (p.tag_string ?? '').split(/\s+/).filter(Boolean),
    tagsByCategory: {
      general: split(p.tag_string_general),
      artist: split(p.tag_string_artist),
      character: split(p.tag_string_character),
      copyright: split(p.tag_string_copyright),
      meta: split(p.tag_string_meta),
    },
    score: p.score,
    md5: p.md5,
    fileExt: p.file_ext,
    fileSize: p.file_size,
    createdAt: p.created_at,
    uploader: p.uploader_name,
  };
}

function split(s?: string): string[] {
  return (s ?? '').split(/\s+/).filter(Boolean);
}

function ratingTag(ratings: Rating[] | undefined): string | null {
  if (!ratings || ratings.length === 0) return null;
  const codes: string[] = [];
  for (const r of ratings) {
    if (r === 'safe') codes.push('g');
    else if (r === 'questionable') codes.push('q');
    else if (r === 'explicit') codes.push('e');
  }
  if (codes.length === 0) return null;
  if (codes.length === 1) return `rating:${codes[0]}`;
  return `rating:${codes.join(',')}`;
}

export class DanbooruSource implements Source {
  readonly kind = 'danbooru' as const;
  readonly capabilities: SourceCapabilities = {
    autocomplete: true,
    ratingFilter: true,
    maxLimit: 200,
    pagination: 'page',
  };

  constructor(readonly config: ServerConfig) {}

  async search(query: SearchQuery, page: number, signal?: AbortSignal): Promise<Page<Post>> {
    const limit = Math.min(query.limit ?? 40, this.capabilities.maxLimit);
    const tagParts = [...query.tags];
    const rating = ratingTag(query.ratings);
    if (rating) tagParts.push(rating);
    if (query.order === 'score') tagParts.push('order:score');
    else if (query.order === 'random') tagParts.push('order:random');
    const url = buildUrl(this.config.baseUrl, 'posts.json', {
      tags: tagParts.join(' '),
      limit,
      page,
    });
    const data = await fetchJson<DanbooruPost[]>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    const items = data
      .map((p) => normalizePost(p, this.config.baseUrl))
      .filter((p) => p.previewUrl || p.sampleUrl || p.fullUrl);
    return {
      // Use the raw response length for pagination — filtered-out posts
      // (banned, gold-only) still count toward the API's page size.
      items,
      nextPage: data.length < limit ? null : page + 1,
    };
  }

  async autocompleteTag(prefix: string, signal?: AbortSignal): Promise<TagSuggestion[]> {
    if (!prefix.trim()) return [];
    const url = buildUrl(this.config.baseUrl, 'autocomplete.json', {
      'search[query]': prefix,
      'search[type]': 'tag_query',
      limit: 10,
    });
    try {
      const data = await fetchJson<DanbooruTagAutocomplete[]>(url, {
        auth: this.config.auth,
        signal,
        viaWebView: this.config.useWebViewFetch,
      });
      return data.map((t) => ({
        name: t.value,
        category: TAG_CATEGORY[t.category] ?? 'unknown',
        postCount: t.post_count,
      }));
    } catch {
      // Autocomplete is best-effort — failures degrade silently to no
      // suggestions. The tag-search-input surfaces this with a small inline
      // "couldn't load suggestions" hint when applicable.
      return [];
    }
  }

  async getPost(id: string, signal?: AbortSignal): Promise<Post> {
    const url = buildUrl(this.config.baseUrl, `posts/${id}.json`, {});
    const p = await fetchJson<DanbooruPost>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    return normalizePost(p, this.config.baseUrl);
  }
}
