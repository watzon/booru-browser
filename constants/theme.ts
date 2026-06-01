import { Platform, type ViewStyle } from 'react-native';

// Brand palette is lifted straight from the app icon: a bento of anime art
// under a magnifying glass — hot-pink/magenta hair, electric violet, cyan, a
// kitsune gold, all on deep navy. Magenta is the primary accent.
const tintColorLight = '#D81B82'; // magenta
const tintColorDark = '#FF5FB0'; // hot pink

export const Colors = {
  light: {
    text: '#1C1420',
    textMuted: '#6A6270',
    background: '#FFFFFF',
    surface: '#FAF5F8',
    surfaceMuted: '#F0E8EE',
    border: '#E4D9E1',
    tint: tintColorLight,
    accent: tintColorLight,
    accentText: '#FFFFFF',
    danger: '#E2384C',
    dangerText: '#FFFFFF',
    success: '#2E8A52',
    warning: '#C07A00',
    overlay: 'rgba(20,8,18,0.55)',
    icon: '#7A7280',
    tabIconDefault: '#7A7280',
    tabIconSelected: tintColorLight,
    // Brand accents (the icon's character palette)
    brandPink: '#FF4FA3',
    brandViolet: '#7C4DFF',
    brandCyan: '#2BB6E0',
    brandGold: '#F5A623',
    brandDeep: '#010C2E',
    gradientStart: '#FF4FA3',
    gradientEnd: '#7C4DFF',
  },
  dark: {
    text: '#F2ECF2',
    textMuted: '#A39BAA',
    background: '#141019',
    surface: '#1E1826',
    surfaceMuted: '#2A2235',
    border: '#3A3145',
    tint: tintColorDark,
    accent: tintColorDark,
    accentText: '#2A0716',
    danger: '#FF5E6A',
    dangerText: '#1A0608',
    success: '#5DD28A',
    warning: '#FFB84D',
    overlay: 'rgba(0,0,0,0.7)',
    icon: '#A39BAA',
    tabIconDefault: '#A39BAA',
    tabIconSelected: tintColorDark,
    // Brand accents (the icon's character palette)
    brandPink: '#FF5FB0',
    brandViolet: '#9B6BFF',
    brandCyan: '#3FC9FF',
    brandGold: '#FFB23E',
    brandDeep: '#010C2E',
    gradientStart: '#FF5FB0',
    gradientEnd: '#9B6BFF',
  },
};

/** The signature pink→violet brand gradient, for hero surfaces and the FAB. */
export const BrandGradient = {
  light: ['#FF4FA3', '#7C4DFF'] as const,
  dark: ['#FF5FB0', '#9B6BFF'] as const,
};

export type ThemeName = keyof typeof Colors;
export type ColorToken = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const LineHeight = {
  xs: 16,
  sm: 18,
  md: 20,
  lg: 22,
  xl: 26,
  xxl: 30,
  xxxl: 38,
} as const;

export const Shadows: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const HitSlop = { top: 8, right: 8, bottom: 8, left: 8 } as const;

// Baloo 2 (loaded in app/_layout.tsx) is the playful, rounded display face used
// for the wordmark and headings. Body copy stays on the system font. The
// `display`/`displaySemibold` family names match the @expo-google-fonts keys.
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    display: 'Baloo2_700Bold',
    displaySemibold: 'Baloo2_600SemiBold',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: 'Baloo2_700Bold',
    displaySemibold: 'Baloo2_600SemiBold',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    display: "'Baloo2_700Bold', 'SF Pro Rounded', system-ui, sans-serif",
    displaySemibold: "'Baloo2_600SemiBold', 'SF Pro Rounded', system-ui, sans-serif",
  },
})!;
