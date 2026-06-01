import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { BrandGradient } from '@/constants/theme';
import { useThemeName } from '@/hooks/use-theme-color';

type Props = {
  children: string;
  style?: TextStyle | TextStyle[];
  colors?: readonly [string, string, ...string[]];
  accessibilityLabel?: string;
};

/**
 * Renders text filled with the brand gradient by masking a LinearGradient with
 * the glyphs. Falls back to a flat gradient-start fill on web where MaskedView
 * support is flaky, so the wordmark still reads correctly there.
 */
export function GradientText({ children, style, colors, accessibilityLabel }: Props) {
  const scheme = useThemeName();
  const gradientColors = colors ?? BrandGradient[scheme];

  if (Platform.OS === 'web') {
    return (
      <Text style={[style, { color: gradientColors[0] }]} accessibilityLabel={accessibilityLabel}>
        {children}
      </Text>
    );
  }

  return (
    <MaskedView
      accessible
      accessibilityLabel={accessibilityLabel ?? children}
      maskElement={
        <View style={styles.maskWrap}>
          <Text style={[style, { color: '#000' }]}>{children}</Text>
        </View>
      }
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Transparent copy reserves the exact glyph footprint for the mask. */}
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  maskWrap: { backgroundColor: 'transparent' },
});
