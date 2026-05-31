import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontSize, HitSlop, Radius, Spacing } from '@/constants/theme';
import { useThemeColors, useThemeName } from '@/hooks/use-theme-color';
import type { TagCategory } from '@/sources/types';

type Mode = 'static' | 'selectable' | 'removable';

type Props = {
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onRemove?: () => void;
  mode?: Mode;
  selected?: boolean;
  category?: TagCategory;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

// Pill palettes mirror Danbooru / e621 conventions; we ship a light- and
// dark-mode variant of each so tag pills retain meaning when the post viewer
// becomes theme-aware.
const TAG_PALETTE_DARK: Record<TagCategory, { bg: string; fg: string }> = {
  artist: { bg: 'rgba(255, 105, 105, 0.18)', fg: '#ff8a8a' },
  character: { bg: 'rgba(53, 184, 110, 0.18)', fg: '#7ee49e' },
  copyright: { bg: 'rgba(176, 110, 255, 0.18)', fg: '#c4a4ff' },
  species: { bg: 'rgba(255, 138, 76, 0.18)', fg: '#ffb487' },
  general: { bg: 'rgba(79, 156, 231, 0.18)', fg: '#86bff5' },
  meta: { bg: 'rgba(255, 184, 76, 0.18)', fg: '#ffd187' },
  lore: { bg: 'rgba(141, 211, 84, 0.18)', fg: '#b6e596' },
  unknown: { bg: 'rgba(255, 255, 255, 0.12)', fg: 'rgba(255, 255, 255, 0.9)' },
};

const TAG_PALETTE_LIGHT: Record<TagCategory, { bg: string; fg: string }> = {
  artist: { bg: 'rgba(204, 51, 68, 0.12)', fg: '#a3202f' },
  character: { bg: 'rgba(46, 138, 82, 0.14)', fg: '#1f6a3d' },
  copyright: { bg: 'rgba(120, 60, 200, 0.12)', fg: '#5b339a' },
  species: { bg: 'rgba(200, 90, 30, 0.12)', fg: '#8a4515' },
  general: { bg: 'rgba(10, 126, 164, 0.12)', fg: '#0a5a78' },
  meta: { bg: 'rgba(176, 107, 0, 0.14)', fg: '#7e4d00' },
  lore: { bg: 'rgba(80, 140, 40, 0.12)', fg: '#3e6a1f' },
  unknown: { bg: 'rgba(0,0,0,0.06)', fg: '#3d4146' },
};

export function Chip({
  label,
  onPress,
  onLongPress,
  onRemove,
  mode = 'static',
  selected,
  category,
  accessibilityHint,
  style,
}: Props) {
  const c = useThemeColors();
  const theme = useThemeName();
  const palette = category
    ? (theme === 'dark' ? TAG_PALETTE_DARK : TAG_PALETTE_LIGHT)[category] ?? null
    : null;

  const bg = palette
    ? palette.bg
    : selected
      ? c.accent
      : c.surfaceMuted;
  const fg = palette
    ? palette.fg
    : selected
      ? c.accentText
      : c.text;
  const border = selected && !palette ? c.accent : 'transparent';

  const a11yLabel = mode === 'removable' ? `${label}, double-tap to remove` : label;

  const inner = (
    <View style={styles.row}>
      <Text style={[styles.text, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
      {mode === 'removable' ? (
        <Text style={[styles.remove, { color: fg }]} maxFontSizeMultiplier={1.4}>×</Text>
      ) : null}
    </View>
  );

  if (onPress || onLongPress || onRemove) {
    return (
      <Pressable
        onPress={mode === 'removable' ? onRemove : onPress}
        onLongPress={onLongPress}
        hitSlop={HitSlop}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.pill,
          { backgroundColor: bg, borderColor: border, borderWidth: border === 'transparent' ? 0 : 1, opacity: pressed ? 0.7 : 1 },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={a11yLabel}
      style={[styles.pill, { backgroundColor: bg, borderColor: border, borderWidth: border === 'transparent' ? 0 : 1 }, style]}
    >
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.pill,
    minHeight: 32,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  remove: {
    fontSize: FontSize.lg,
    marginTop: -2,
  },
});
