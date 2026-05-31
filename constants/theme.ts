import { Platform, type ViewStyle } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#4ea8ff';

export const Colors = {
  light: {
    text: '#11181C',
    textMuted: '#5a6066',
    background: '#fff',
    surface: '#f6f7f8',
    surfaceMuted: '#eceef0',
    border: '#d8dbde',
    tint: tintColorLight,
    accent: tintColorLight,
    accentText: '#ffffff',
    danger: '#cc3344',
    dangerText: '#ffffff',
    success: '#2e8a52',
    warning: '#b06b00',
    overlay: 'rgba(0,0,0,0.55)',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    textMuted: '#9BA1A6',
    background: '#151718',
    surface: '#1f2123',
    surfaceMuted: '#2a2d30',
    border: '#3a3e42',
    tint: tintColorDark,
    accent: tintColorDark,
    accentText: '#0b1822',
    danger: '#ff5e6a',
    dangerText: '#1a0608',
    success: '#5dd28a',
    warning: '#ffb84d',
    overlay: 'rgba(0,0,0,0.7)',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
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

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
