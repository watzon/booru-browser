import { DanbooruSource } from './adapters/danbooru';
import { GelbooruSource } from './adapters/gelbooru';
import { E621Source } from './adapters/e621';
import { MoebooruSource } from './adapters/moebooru';
import { KemonoSource } from './adapters/kemono';
import { createCustomSource } from './adapters/custom';
import type { ServerConfig, Source, SourceKind } from './types';

export const SOURCE_KINDS: { kind: SourceKind; label: string; description: string }[] = [
  { kind: 'danbooru', label: 'Danbooru', description: 'Danbooru, AIBooru, and forks' },
  { kind: 'gelbooru', label: 'Gelbooru', description: 'Gelbooru, Safebooru, Rule34, TBIB' },
  { kind: 'e621', label: 'e621', description: 'e621, e926' },
  { kind: 'moebooru', label: 'Moebooru', description: 'Konachan, yande.re, Sakugabooru' },
  { kind: 'kemono', label: 'Kemono', description: 'Kemono.party and forks' },
  { kind: 'custom', label: 'Custom', description: 'Declarative custom site definition' },
];

const cache = new Map<string, Source>();

export function getSource(config: ServerConfig): Source {
  const cached = cache.get(config.id);
  if (cached && cached.config === config) return cached;
  const source = create(config);
  cache.set(config.id, source);
  return source;
}

export function invalidateSource(id: string): void {
  cache.delete(id);
}

function create(config: ServerConfig): Source {
  switch (config.kind) {
    case 'danbooru':
      return new DanbooruSource(config);
    case 'gelbooru':
      return new GelbooruSource(config);
    case 'e621':
      return new E621Source(config);
    case 'moebooru':
      return new MoebooruSource(config);
    case 'kemono':
      return new KemonoSource(config);
    case 'custom':
      return createCustomSource(config);
  }
}
