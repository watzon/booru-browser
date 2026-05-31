import type { RatingFilter } from '@/hooks/use-search-store';
import type { Rating, SearchQuery } from '@/sources/types';

// Single enforcement point for SFW-by-default. Every Source.search call must
// pass through this function so the NSFW gate is impossible to bypass from UI
// code by accident.
export function applyRatingFilter(
  query: SearchQuery,
  gateUnlocked: boolean,
  userFilter: RatingFilter = 'all',
): SearchQuery {
  if (!gateUnlocked) {
    return { ...query, ratings: ['safe'] };
  }
  if (userFilter === 'all') return query;
  return { ...query, ratings: [userFilter] };
}

export function isSafe(rating: Rating): boolean {
  return rating === 'safe';
}

export function shouldHidePost(rating: Rating, gateUnlocked: boolean): boolean {
  if (gateUnlocked) return false;
  return !isSafe(rating);
}
