import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { HitSlop, Radius } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

type Props = {
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  variant?: 'plain' | 'surface' | 'overlay';
  size?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
};

export function IconButton({
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  variant = 'plain',
  size = 44,
  style,
  children,
  testID,
}: Props) {
  const c = useThemeColors();
  const bg =
    variant === 'surface' ? c.surfaceMuted :
    variant === 'overlay' ? 'rgba(0,0,0,0.5)' :
    'transparent';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={HitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          width: size,
          height: size,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
