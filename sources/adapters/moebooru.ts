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

type MoebooruPost = {
  id: number;
  preview_url?: string;
  sample_url?: string;
  jpeg_url?: string;
  file_url: string;
  width: number;
  height: number;
  rating: 's' | 'q' | 'e';
  tags: string;
  score?: number;
  md5?: string;
  source?: string;
  created_at?: number;
  author?: string;
  file_size?: number;
  sample_file_size?: number;
  jpeg_file_size?: number;
};

type MoebooruTag = {
  id: number;
  name: string;
  count: number;
  type: number;
};

function mapRating(r: string): Rating {
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

function normalizePost(p: MoebooruPost, baseUrl: string): Post {
  const sample = p.sample_url ?? p.jpeg_url ?? p.file_url;
  return {
    id: String(p.id),
    sourceUrl: `${baseUrl.replace(/\/$/, '')}/post/show/${p.id}`,
    previewUrl: p.preview_url ?? sample,
    sampleUrl: sample,
    fullUrl: p.file_url,
    width: p.width,
    height: p.height,
    rating: mapRating(p.rating),
    tags: (p.tags ?? '').split(/\s+/).filter(Boolean),
    score: p.score,
    md5: p.md5,
    fileSize: p.file_size,
    sampleFileSize: p.sample_file_size ?? p.jpeg_file_size,
    createdAt: p.created_at ? new Date(p.created_at * 1000).toISOString() : undefined,
    uploader: p.author,
  };
}

function ratingTag(ratings: Rating[] | undefined): string | null {
  if (!ratings || ratings.length === 0) return null;
  const codes: string[] = [];
  for (const r of ratings) {
    if (r === 'safe' || r === 'questionable' || r === 'explicit') codes.push(r);
  }
  if (codes.length === 0) return null;
  if (codes.length === 1) return `rating:${codes[0]}`;
  return null;
}

export class MoebooruSource implements Source {
  readonly kind = 'moebooru' as const;
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
    if (query.order === 'score') tagParts.push('order:score');
    else if (query.order === 'random') tagParts.push('order:random');
    const url = buildUrl(this.config.baseUrl, 'post.json', {
      tags: tagParts.join(' '),
      limit,
      page,
    });
    const data = await fetchJson<MoebooruPost[]>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    const items = data
      .map((p) => normalizePost(p, this.config.baseUrl))
      .filter((p) => p.previewUrl || p.sampleUrl || p.fullUrl);
    return {
      items,
      nextPage: data.length < limit ? null : page + 1,
    };
  }

  async autocompleteTag(prefix: string, signal?: AbortSignal): Promise<TagSuggestion[]> {
    if (!prefix.trim()) return [];
    const url = buildUrl(this.config.baseUrl, 'tag.json', {
      name: prefix,
      limit: 10,
      order: 'count',
    });
    try {
      const data = await fetchJson<MoebooruTag[]>(url, {
        auth: this.config.auth,
        signal,
      });
      return data.map((t) => ({
        name: t.name,
        category: 'general',
        postCount: t.count,
      }));
    } catch {
      return [];
    }
  }

  async getPost(id: string, signal?: AbortSignal): Promise<Post> {
    const url = buildUrl(this.config.baseUrl, 'post.json', { tags: `id:${id}` });
    const data = await fetchJson<MoebooruPost[]>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    if (data.length === 0) throw new Error(`Post ${id} not found`);
    return normalizePost(data[0], this.config.baseUrl);
  }
}
