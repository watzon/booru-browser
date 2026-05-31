import { useInfiniteQuery } from '@tanstack/react-query';

import { applyRatingFilter } from '@/gate/ratingFilter';
import { useGateStore } from '@/gate/store';
import { useSearchStore } from '@/hooks/use-search-store';
import { getSource } from '@/sources/registry';
import type { Post, SearchQuery, ServerConfig } from '@/sources/types';

export function usePostSearch(server: ServerConfig | null) {
  const tags = useSearchStore((s) => s.tags);
  const order = useSearchStore((s) => s.order);
  const ratingFilter = useSearchStore((s) => s.ratingFilter);
  const gateUnlocked = useGateStore((s) => s.unlocked);
  const gateHydrated = useGateStore((s) => s.hydrated);

  return useInfiniteQuery({
    queryKey: ['posts', server?.id, tags, order, ratingFilter, gateUnlocked],
    enabled: !!server && gateHydrated,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      if (!server) throw new Error('No server selected');
      const source = getSource(server);
      const baseQuery: SearchQuery = {
        tags,
        order: order === 'newest' ? undefined : order,
      };
      const query = applyRatingFilter(baseQuery, gateUnlocked, ratingFilter);
      return source.search(query, pageParam as number, signal);
    },
    getNextPageParam: (last) => last.nextPage,
  });
}

export function flattenPages<T>(
  data: { pages: { items: T[] }[] } | undefined,
): T[] {
  if (!data) return [];
  return data.pages.flatMap((p) => p.items);
}

export type { Post };
