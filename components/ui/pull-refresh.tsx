import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Sparkle } from '@/components/ui/sparkle';

// Overscroll distance (pt) needed to arm a refresh, and the gap held open below
// the header while the refresh runs so the spinner has room to spin.
export const PULL_THRESHOLD = 78;
export const PULL_REFRESH_GAP = 64;

type Props = {
  /** Live overscroll distance (>= 0), written from the list's scroll handler. */
  pull: SharedValue<number>;
  refreshing: boolean;
  /** Top inset (header height) — positions the indicator just below the header. */
  top: number;
};

/**
 * A themed, physics-y pull-to-refresh indicator. A sparkle constellation rides
 * the iOS rubber-band overscroll: it scales and rotates as you pull, the
 * satellites "charge in" past the halfway point, and the whole thing spins on a
 * repeating turn while the refresh runs — settling on a whole rotation when it
 * finishes so it never stops mid-tilt.
 */
export function PullRefresh({ pull, refreshing, top }: Props) {
  const spin = useSharedValue(0);
  const active = useSharedValue(0); // eased 0→1 while refreshing

  useEffect(() => {
    active.value = withTiming(refreshing ? 1 : 0, { duration: 200 });
    if (refreshing) {
      spin.value = withRepeat(
        withTiming(spin.value + 1, { duration: 850, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(spin);
      spin.value = withSpring(Math.round(spin.value), { damping: 15, stiffness: 90 });
    }
  }, [refreshing, spin, active]);

  // The visible gap: the live pull, or the held gap once refreshing takes over.
  const gap = useDerivedValue(() => Math.max(pull.value, active.value * PULL_REFRESH_GAP));

  const containerStyle = useAnimatedStyle(() => ({
    height: gap.value,
    opacity: interpolate(gap.value, [0, 14, 32], [0, 0.5, 1], Extrapolation.CLAMP),
  }));

  const markStyle = useAnimatedStyle(() => {
    const p = interpolate(pull.value, [0, PULL_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    const energy = Math.max(p, active.value);
    const scale = interpolate(energy, [0, 1], [0.35, 1], Extrapolation.CLAMP);
    // Pull tilts it toward an upright "armed" pose; refreshing spins it freely.
    const rot = p * 160 + spin.value * 360;
    return { transform: [{ scale }, { rotate: `${rot}deg` }] };
  });

  const sat1Style = useAnimatedStyle(() => {
    const e = Math.max(interpolate(pull.value, [0, PULL_THRESHOLD], [0, 1], Extrapolation.CLAMP), active.value);
    const o = interpolate(e, [0.45, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: o, transform: [{ scale: o }] };
  });

  const sat2Style = useAnimatedStyle(() => {
    const e = Math.max(interpolate(pull.value, [0, PULL_THRESHOLD], [0, 1], Extrapolation.CLAMP), active.value);
    const o = interpolate(e, [0.7, 1], [0, 1], Extrapolation.CLAMP);
    return { opacity: o, transform: [{ scale: o }] };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.container, { top }, containerStyle]}
    >
      <Animated.View style={[styles.mark, markStyle]}>
        <Sparkle size={30} style={styles.center} />
        <Animated.View style={[styles.sat, styles.satTopRight, sat1Style]}>
          <Sparkle size={12} />
        </Animated.View>
        <Animated.View style={[styles.sat, styles.satBottomLeft, sat2Style]}>
          <Sparkle size={9} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const MARK = 44;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  mark: {
    width: MARK,
    height: MARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { position: 'absolute' },
  sat: { position: 'absolute' },
  satTopRight: { top: 0, right: 0 },
  satBottomLeft: { bottom: 2, left: 2 },
});
