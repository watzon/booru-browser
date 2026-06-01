import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { CONTENT_MAX_WIDTH } from '@/hooks/use-responsive';

/**
 * Centers and caps its children's width on large (iPad-class) screens so line
 * lengths and form fields don't stretch edge-to-edge. A no-op on phones, where
 * the available width is already below CONTENT_MAX_WIDTH.
 */
export function WideContainer({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
  },
});
