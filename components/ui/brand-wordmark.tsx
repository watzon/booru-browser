import { StyleSheet, View } from 'react-native';

import { GradientText } from '@/components/ui/gradient-text';
import { Sparkle } from '@/components/ui/sparkle';
import { Fonts } from '@/constants/theme';

type Props = {
  size?: number;
  /** Show the small sparkle to the right of the wordmark. */
  sparkle?: boolean;
};

/** The "Booru" gradient wordmark in Baloo 2. The app's signature lockup. */
export function BrandWordmark({ size = 28, sparkle = true }: Props) {
  return (
    <View style={styles.row} accessibilityRole="header">
      <GradientText
        accessibilityLabel="Booru Browser"
        style={{
          fontFamily: Fonts.display,
          fontSize: size,
          lineHeight: size * 1.18,
          letterSpacing: 0.2,
        }}
      >
        Booru Browser
      </GradientText>
      {sparkle ? <Sparkle size={size * 0.5} style={{ marginLeft: 2, marginTop: -size * 0.32 }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
});
