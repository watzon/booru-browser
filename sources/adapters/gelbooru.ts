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

type GelbooruResponse = {
  '@attributes'?: { limit: number; offset: number; count: number };
  post?: GelbooruPost[];
};

type GelbooruPost = {
  id: number;
  preview_url?: string;
  sample_url?: string;
  file_url: string;
  width: number;
  height: number;
  rating: string;
  tags: string;
  score?: number;
  md5?: string;
  source?: string;
  created_at?: string;
  owner?: string;
};

type GelbooruAutocomplete = {
  type?: string;
  label: string;
  value: string;
  post_count?: number;
};

function mapRating(r: string): Rating {
  const v = (r ?? '').toLowerCase();
  if (v === 'safe' || v === 's' || v === 'general' || v === 'g') return 'safe';
  if (v === 'sensitive') return 'safe';
  if (v === 'questionable' || v === 'q') return 'questionable';
  if (v === 'explicit' || v === 'e') return 'explicit';
  return 'unknown';
}

function normalizePost(p: GelbooruPost, baseUrl: string): Post {
  const preview = p.preview_url ?? p.sample_url ?? p.file_url;
  const sample = p.sample_url ?? p.file_url;
  return {
    id: String(p.id),
    sourceUrl: `${baseUrl.replace(/\/$/, '')}/index.php?page=post&s=view&id=${p.id}`,
    previewUrl: preview,
    sampleUrl: sample,
    fullUrl: p.file_url,
    width: p.width,
    height: p.height,
    rating: mapRating(p.rating),
    tags: (p.tags ?? '').split(/\s+/).filter(Boolean),
    score: p.score,
    md5: p.md5,
    createdAt: p.created_at,
    uploader: p.owner,
  };
}

function ratingTag(ratings: Rating[] | undefined): string | null {
  if (!ratings || ratings.length === 0) return null;
  const tags: string[] = [];
  for (const r of ratings) {
    if (r === 'safe') tags.push('rating:safe');
    else if (r === 'questionable') tags.push('rating:questionable');
    else if (r === 'explicit') tags.push('rating:explicit');
  }
  if (tags.length === 0) return null;
  return `( ${tags.join(' ~ ')} )`;
}

export class GelbooruSource implements Source {
  readonly kind = 'gelbooru' as const;
  readonly capabilities: SourceCapabilities = {
    autocomplete: true,
    ratingFilter: true,
    maxLimit: 100,
    pagination: 'page',
  };

  constructor(readonly config: ServerConfig) {}

  async search(query: SearchQuery, page: number, signal?: AbortSignal): Promise<Page<Post>> {
    const limit = Math.min(query.limit ?? 40, this.capabilities.maxLimit);
    const tagParts = [...query.tags];
    const rating = ratingTag(query.ratings);
    if (rating) tagParts.push(rating);
    if (query.order === 'score') tagParts.push('sort:score');
    else if (query.order === 'random') tagParts.push('sort:random');

    const url = buildUrl(this.config.baseUrl, 'index.php', {
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: 1,
      limit,
      pid: page - 1,
      tags: tagParts.join(' '),
    });
    const data = await fetchJson<GelbooruResponse | GelbooruPost[]>(url, {
      auth: this.config.auth,
      signal,
      viaWebView: this.config.useWebViewFetch,
    });
    const posts = Array.isArray(data) ? data : (data.post ?? []);
    const items = posts
      .map((p) => normalizePost(p, this.config.baseUrl))
      .filter((p) => p.previewUrl || p.sampleUrl || p.fullUrl);
    return {
      items,
      nextPage: posts.length < limit ? null : page + 1,
    };
  }

  async autocompleteTag(prefix: string, signal?: AbortSignal): Promise<TagSuggestion[]> {
    if (!prefix.trim()) return [];
    const url = buildUrl(this.config.baseUrl, 'index.php', {
      page: 'autocomplete2',
      term: prefix,
      type: 'tag_query',
      limit: 10,
    });
    try {
      const data = await fetchJson<GelbooruAutocomplete[]>(url, {
        auth: this.config.auth,
        signal,
      });
      return data.map((t) => ({
        name: t.value,
        category: 'unknown' as const,
        postCount: t.post_count,
      }));
    } catch {
      return [];
    }
  }

  async getPost(id: string, signal?: AbortSignal): Promise<Post> {
    const url = buildUrl(this.config.baseUrl, 'index.php', {
      page: 'dapi',
      s: 'post',
      q: 'index',
      json: 1,
      id,
    });
    const data = await fetchJson<GelbooruResponse | GelbooruPost[]>(url, {
      auth: this.config.auth,
      signal,
      viaWebView: this.config.useWebViewFetch,
    });
    const posts = Array.isArray(data) ? data : (data.post ?? []);
    if (posts.length === 0) throw new Error(`Post ${id} not found`);
    return normalizePost(posts[0], this.config.baseUrl);
  }
}
