import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, FontSize, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  body?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({ title, body, icon, action, style }: Props) {
  const c = useThemeColors();
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="summary"
      accessibilityLabel={body ? `${title}. ${body}` : title}
    >
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.title, { color: c.text }]} maxFontSizeMultiplier={1.6}>{title}</Text>
      {body ? (
        <Text style={[styles.body, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>{body}</Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.sm,
  },
  icon: {
    marginBottom: Spacing.md,
    opacity: 0.6,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: FontSize.xl,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    textAlign: 'center',
    maxWidth: 360,
  },
  action: {
    marginTop: Spacing.lg,
  },
});
