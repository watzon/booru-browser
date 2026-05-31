import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontSize, HitSlop, Radius, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leadingIcon,
  trailingIcon,
  style,
  accessibilityHint,
  testID,
}: Props) {
  const c = useThemeColors();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary' ? c.accent :
    variant === 'danger' ? c.danger :
    variant === 'secondary' ? c.surfaceMuted :
    'transparent';
  const fg =
    variant === 'primary' ? c.accentText :
    variant === 'danger' ? c.dangerText :
    variant === 'secondary' ? c.text :
    c.accent;
  const border =
    variant === 'ghost' ? 'transparent' :
    variant === 'secondary' ? c.border :
    bg;

  const padV = size === 'sm' ? Spacing.sm : size === 'lg' ? Spacing.lg : Spacing.md;
  const padH = size === 'sm' ? Spacing.md : size === 'lg' ? Spacing.xl : Spacing.lg;
  const fontSize = size === 'sm' ? FontSize.sm : size === 'lg' ? FontSize.lg : FontSize.md;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={HitSlop}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          paddingVertical: padV,
          paddingHorizontal: padH,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.row}>
          {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
          <Text
            style={[styles.label, { color: fg, fontSize }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
          >
            {label}
          </Text>
          {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
  },
});
