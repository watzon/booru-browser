/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors, type ColorToken } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: ColorToken,
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}

/** Returns the full palette object for the active scheme. */
export function useThemeColors() {
  const theme = useColorScheme() ?? 'light';
  return Colors[theme];
}

export function useThemeName() {
  return useColorScheme() ?? 'light';
}
