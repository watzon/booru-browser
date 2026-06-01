import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { BrandGradient } from '@/constants/theme';
import { useThemeName } from '@/hooks/use-theme-color';

// A four-point sparkle — the recurring "magic" motif that echoes the icon's
// playful energy without needing bespoke character art.
function sparklePath(cx: number, cy: number, r: number, waist: number) {
  return (
    `M${cx},${cy - r} ` +
    `C${cx + waist},${cy - waist} ${cx + waist},${cy - waist} ${cx + r},${cy} ` +
    `C${cx + waist},${cy + waist} ${cx + waist},${cy + waist} ${cx},${cy + r} ` +
    `C${cx - waist},${cy + waist} ${cx - waist},${cy + waist} ${cx - r},${cy} ` +
    `C${cx - waist},${cy - waist} ${cx - waist},${cy - waist} ${cx},${cy - r} Z`
  );
}

export function Sparkle({ size = 20, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const scheme = useThemeName();
  const [start, end] = BrandGradient[scheme];
  return (
    <View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id="sparkle" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={start} />
            <Stop offset="1" stopColor={end} />
          </SvgGradient>
        </Defs>
        <Path d={sparklePath(50, 50, 50, 14)} fill="url(#sparkle)" />
      </Svg>
    </View>
  );
}

/**
 * A small constellation of sparkles on a soft gradient disc — used as a
 * lightweight brand "mark" in empty states and onboarding.
 */
export function BrandMark({ size = 96 }: { size?: number }) {
  const scheme = useThemeName();
  const gradient = BrandGradient[scheme];
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 100 100">
        <Path d={sparklePath(46, 42, 34, 9)} fill="#FFFFFF" />
        <Path d={sparklePath(76, 70, 16, 4)} fill="#FFFFFF" opacity={0.92} />
        <Path d={sparklePath(22, 72, 11, 3)} fill="#FFFFFF" opacity={0.85} />
      </Svg>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});
