import { buildUrl, fetchJson } from '../http';
import type {
  Page,
  Post,
  SearchQuery,
  ServerConfig,
  Source,
  SourceCapabilities,
  TagSuggestion,
} from '../types';

// Kemono is not a booru — it's a creator-post archive. We model each "post"
// as a gallery entry; if a post has multiple attachments we treat the first
// image as primary and surface the others via tags/source metadata.

type KemonoPost = {
  id: string;
  user: string;
  service: string;
  title: string;
  content?: string;
  added: string;
  published: string;
  file?: { name?: string; path?: string };
  attachments?: { name?: string; path?: string }[];
  tags?: string[] | null;
};

function attachmentUrl(baseUrl: string, path?: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/, '')}${clean}`;
}

function normalizePost(p: KemonoPost, baseUrl: string): Post {
  const primaryPath = p.file?.path ?? p.attachments?.[0]?.path;
  const url = attachmentUrl(baseUrl, primaryPath) ?? '';
  const tags = [
    `service:${p.service}`,
    `creator:${p.user}`,
    ...(p.tags ?? []),
  ];
  return {
    id: `${p.service}/${p.user}/${p.id}`,
    sourceUrl: `${baseUrl.replace(/\/$/, '')}/${p.service}/user/${p.user}/post/${p.id}`,
    previewUrl: url,
    sampleUrl: url,
    fullUrl: url,
    width: 0,
    height: 0,
    rating: 'unknown',
    tags,
    createdAt: p.published ?? p.added,
    uploader: p.user,
  };
}

export class KemonoSource implements Source {
  readonly kind = 'kemono' as const;
  readonly capabilities: SourceCapabilities = {
    autocomplete: false,
    ratingFilter: false,
    maxLimit: 50,
    pagination: 'cursor',
  };

  constructor(readonly config: ServerConfig) {}

  async search(query: SearchQuery, page: number, signal?: AbortSignal): Promise<Page<Post>> {
    const limit = Math.min(query.limit ?? 50, this.capabilities.maxLimit);
    const offset = (page - 1) * limit;
    const search = query.tags.join(' ');
    const url = buildUrl(this.config.baseUrl, 'api/v1/posts', {
      o: offset,
      q: search || undefined,
    });
    const data = await fetchJson<KemonoPost[]>(url, { auth: this.config.auth, signal, viaWebView: this.config.useWebViewFetch });
    const items = data
      .map((p) => normalizePost(p, this.config.baseUrl))
      .filter((p) => p.previewUrl || p.sampleUrl || p.fullUrl);
    return {
      items,
      nextPage: data.length < limit ? null : page + 1,
    };
  }

  async autocompleteTag(): Promise<TagSuggestion[]> {
    return [];
  }

  async getPost(id: string, signal?: AbortSignal): Promise<Post> {
    const [service, user, postId] = id.split('/');
    if (!service || !user || !postId) throw new Error(`Invalid kemono post id: ${id}`);
    const url = buildUrl(this.config.baseUrl, `api/v1/${service}/user/${user}/post/${postId}`, {});
    const data = await fetchJson<{ post: KemonoPost }>(url, {
      auth: this.config.auth,
      signal,
      viaWebView: this.config.useWebViewFetch,
    });
    return normalizePost(data.post, this.config.baseUrl);
  }
}
