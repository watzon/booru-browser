import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, style, ...rest },
  ref,
) {
  const c = useThemeColors();
  const showError = !!error;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text
          accessibilityRole="text"
          style={[styles.label, { color: c.textMuted }]}
          maxFontSizeMultiplier={1.6}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label ?? rest.placeholder ?? undefined}
        accessibilityHint={hint}
        placeholderTextColor={c.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: c.surface,
            color: c.text,
            borderColor: showError ? c.danger : c.border,
          },
          style,
        ]}
        {...rest}
      />
      {showError ? (
        <Text style={[styles.help, { color: c.danger }]} maxFontSizeMultiplier={1.6}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.help, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  input: {
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
  },
  help: {
    fontSize: FontSize.xs,
  },
});
