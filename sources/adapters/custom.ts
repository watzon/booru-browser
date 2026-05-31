import type { ServerConfig, Source } from '../types';
import { DanbooruSource } from './danbooru';
import { E621Source } from './e621';
import { GelbooruSource } from './gelbooru';
import { MoebooruSource } from './moebooru';

// Declarative custom adapter: reuse one of the family adapters under the hood
// based on the `custom.baseKind`. No JS code is ever loaded from imports.
export function createCustomSource(config: ServerConfig): Source {
  if (!config.custom) throw new Error('Custom source requires custom site definition');
  const base: ServerConfig = { ...config, kind: config.custom.baseKind };
  switch (config.custom.baseKind) {
    case 'danbooru':
      return new DanbooruSource(base);
    case 'gelbooru':
      return new GelbooruSource(base);
    case 'e621':
      return new E621Source(base);
    case 'moebooru':
      return new MoebooruSource(base);
    case 'kemono':
      // Kemono custom variant not supported via family map — fall back to Gelbooru
      throw new Error('Custom kemono variants not supported; use kind=kemono directly');
  }
}
