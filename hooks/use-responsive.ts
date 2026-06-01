import { useWindowDimensions } from 'react-native';

// Width at/above which we treat the screen as a tablet-class layout: cap and
// center chrome, widen grids, and (in landscape) split Browse into two panes.
export const BREAKPOINT_LARGE = 768;

// Centered max-widths for tablet-class screens so line lengths and controls
// don't stretch edge-to-edge.
export const CONTENT_MAX_WIDTH = 640;
export const BAR_MAX_WIDTH = 560;
export const SHEET_MAX_WIDTH = 560;
export const CARD_MAX_WIDTH = 720;

// Target thumbnail edge; grid column count is derived so tiles stay this size-ish
// regardless of how wide the available space is.
const TARGET_TILE = 180;

export type Responsive = {
  width: number;
  height: number;
  isLarge: boolean;
  isLandscape: boolean;
  /** Both dimensions are large enough to show a side-by-side master/detail. */
  isSplit: boolean;
};

export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isLarge = width >= BREAKPOINT_LARGE;
  const isLandscape = width > height;
  return {
    width,
    height,
    isLarge,
    isLandscape,
    // Only split when there's genuinely room for two usable columns of content.
    isSplit: isLarge && isLandscape && width >= 900,
  };
}

/** Columns that keep tiles ~TARGET_TILE wide for the given available width. */
export function gridColumns(width: number, min = 2, max = 8): number {
  if (width <= 0) return min;
  return Math.min(max, Math.max(min, Math.round(width / TARGET_TILE)));
}
