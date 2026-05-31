import { z } from 'zod';

export const SOURCE_KIND_SCHEMA = z.enum([
  'danbooru',
  'gelbooru',
  'e621',
  'moebooru',
  'kemono',
  'custom',
]);

export const AUTH_CONFIG_SCHEMA = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({
    type: z.literal('basic'),
    username: z.string().min(1),
    apiKey: z.string().min(1),
  }),
  z.object({
    type: z.literal('apiKey'),
    header: z.string().min(1),
    key: z.string().min(1),
  }),
  z.object({
    type: z.literal('queryParams'),
    params: z.record(z.string(), z.string()),
  }),
  z.object({
    type: z.literal('cookie'),
    cookie: z.string().min(1),
  }),
]);

export const CUSTOM_SITE_DEFINITION_SCHEMA = z.object({
  baseKind: z.enum(['danbooru', 'gelbooru', 'e621', 'moebooru']),
  paths: z
    .object({
      search: z.string().optional(),
      autocomplete: z.string().optional(),
      post: z.string().optional(),
    })
    .optional(),
  ratingMap: z
    .object({
      safe: z.string().optional(),
      questionable: z.string().optional(),
      explicit: z.string().optional(),
    })
    .partial()
    .optional(),
  tagsField: z.string().optional(),
});

export const SERVER_CONFIG_SCHEMA = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  kind: SOURCE_KIND_SCHEMA,
  baseUrl: z.string().url(),
  auth: AUTH_CONFIG_SCHEMA.optional(),
  custom: CUSTOM_SITE_DEFINITION_SCHEMA.optional(),
  useWebViewFetch: z.boolean().optional(),
});

export const SHARED_SERVER_SCHEMA = SERVER_CONFIG_SCHEMA.omit({ auth: true });

export const BOORUCONFIG_FILE_SCHEMA = z.object({
  version: z.literal(1),
  servers: z.array(SHARED_SERVER_SCHEMA).min(1),
  defaultServerId: z.string().optional(),
});

export type BoorucfgFile = z.infer<typeof BOORUCONFIG_FILE_SCHEMA>;
export type SharedServer = z.infer<typeof SHARED_SERVER_SCHEMA>;
