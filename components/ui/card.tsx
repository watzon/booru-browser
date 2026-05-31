import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  selected?: boolean;
  padding?: keyof typeof Spacing | 'none';
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  selected,
  padding = 'lg',
  style,
}: Props) {
  const c = useThemeColors();
  const pad = padding === 'none' ? 0 : Spacing[padding];

  const surface = {
    backgroundColor: c.surface,
    borderColor: selected ? c.accent : c.border,
    borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
    padding: pad,
  };

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.base, surface, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.base, surface, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
  },
});
