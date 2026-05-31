import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontSize, HitSlop, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityHint?: string;
  destructive?: boolean;
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
  accessibilityHint,
  destructive,
  selected,
  style,
}: Props) {
  const c = useThemeColors();
  const titleColor = destructive ? c.danger : c.text;
  const label = subtitle ? `${title}, ${subtitle}` : title;

  const inner = (
    <View style={styles.row}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.text}>
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1} maxFontSizeMultiplier={1.6}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.textMuted }]} numberOfLines={2} maxFontSizeMultiplier={1.6}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        hitSlop={HitSlop}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.container,
          { backgroundColor: selected ? c.surfaceMuted : 'transparent', opacity: pressed ? 0.7 : 1 },
          style,
        ]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.container, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  leading: {
    width: 28,
    alignItems: 'center',
  },
  trailing: {
    marginLeft: 'auto',
  },
  text: {
    flex: 1,
    flexShrink: 1,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
});
