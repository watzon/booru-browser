import { buildUrl, fetchJson } from '../http';
import type {
  Page,
  Post,
  Rating,
  SearchQuery,
  ServerConfig,
  Source,
  SourceCapabilities,
  TagSuggestion,
} from '../types';

type E621Response = { posts: E621Post[] };

type E621Post = {
  id: number;
  file: {
    url: string | null;
    width: number;
    height: number;
    ext: string;
    md5: string;
    size?: number;
  };
  preview: { url: string | null };
  sample: { url: string | null; has: boolean };
  rating: 's' | 'q' | 'e';
  score?: { total: number };
  tags: {
    general?: string[];
    species?: string[];
    character?: string[];
    copyright?: string[];
    artist?: string[];
    invalid?: string[];
    lore?: string[];
    meta?: string[];
  };
  created_at?: string;
  uploader_name?: string;
};

type E621Autocomplete = {
  id: number;
  name: string;
  post_count: number;
  category: number;
  antecedent_name: string | null;
};

function mapRating(r: E621Post['rating']): Rating {
  switch (r) {
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

function flatTags(p: E621Post): string[] {
  const all: string[] = [];
  for (const key of Object.keys(p.tags ?? {}) as (keyof E621Post['tags'])[]) {
    const arr = p.tags[key];
    if (arr) all.push(...arr);
  }
  return all;
}

function normalizePost(p: E621Post, baseUrl: string): Post {
  const sample = p.sample.has ? (p.sample.url ?? p.file.url ?? '') : (p.file.url ?? '');
  return {
    id: String(p.id),
    sourceUrl: `${baseUrl.replace(/\/$/, '')}/posts/${p.id}`,
    previewUrl: p.preview.url ?? sample,
    sampleUrl: sample,
    fullUrl: p.file.url ?? sample,
    width: p.file.width,
    height: p.file.height,
    rating: mapRating(p.rating),
    tags: flatTags(p),
    tagsByCategory: {
      general: p.tags.general ?? [],
      artist: p.tags.artist ?? [],
      character: p.tags.character ?? [],
      copyright: p.tags.copyright ?? [],
      species: p.tags.species ?? [],
      meta: p.tags.meta ?? [],
      lore: p.tags.lore ?? [],
    },
    score: p.score?.total,
    md5: p.file.md5,
    fileExt: p.file.ext,
    fileSize: p.file.size,
    createdAt: p.created_at,
    uploader: p.uploader_name,
  };
}

function ratingTag(ratings: Rating[] | undefined): string | null {
  if (!ratings || ratings.length === 0) return null;
  const codes: string[] = [];
  for (const r of ratings) {
    if (r === 'safe') codes.push('s');
    else if (r === 'questionable') codes.push('q');
    else if (r === 'explicit') codes.push('e');
  }
  if (codes.length === 0) return null;
  if (codes.length === 1) return `rating:${codes[0]}`;
  return `~rating:${codes.join(' ~rating:')}`;
}

export class E621Source implements Source {
  readonly kind = 'e621' as const;
  readonly capabilities: SourceCapabilities = {
    autocomplete: true,
    ratingFilter: true,
    maxLimit: 320,
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
    const data = await fetchJson<E621Response>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    const items = data.posts
      .map((p) => normalizePost(p, this.config.baseUrl))
      .filter((p) => p.previewUrl || p.sampleUrl || p.fullUrl);
    return {
      items,
      nextPage: data.posts.length < limit ? null : page + 1,
    };
  }

  async autocompleteTag(prefix: string, signal?: AbortSignal): Promise<TagSuggestion[]> {
    if (!prefix.trim()) return [];
    const url = buildUrl(this.config.baseUrl, 'tags/autocomplete.json', {
      'search[name_matches]': prefix,
      expiry: 7,
    });
    try {
      const data = await fetchJson<E621Autocomplete[]>(url, {
        auth: this.config.auth,
        signal,
      });
      return data.map((t) => ({
        name: t.name,
        category: 'general',
        postCount: t.post_count,
      }));
    } catch {
      return [];
    }
  }

  async getPost(id: string, signal?: AbortSignal): Promise<Post> {
    const url = buildUrl(this.config.baseUrl, `posts/${id}.json`, {});
    const data = await fetchJson<{ post: E621Post }>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    return normalizePost(data.post, this.config.baseUrl);
  }
}
