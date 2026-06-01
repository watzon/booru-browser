import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StyleSheet, View, type ViewProps } from 'react-native';

// Resolved once: iOS 26+ with the UIGlassEffect runtime. On every other
// platform/version (Android, web, iOS < 26) the native GlassView renders an
// effect-less square view, so we don't mount it there at all.
const GLASS = isLiquidGlassAvailable();

type Props = ViewProps & {
  /** Corner radius for the surface. */
  radius?: number;
  glassEffectStyle?: 'regular' | 'clear';
  /** Background to show when liquid glass isn't available (ignored on glass,
   *  which is meant to be see-through). */
  fallbackColor?: string;
};

/**
 * A surface that is real liquid glass where available and a plain rounded View
 * everywhere else. Pass tint/gradient children to keep themed coloring.
 *
 * The glass is rendered as an absolutely-filled background *behind* the
 * children and clipped by an `overflow: 'hidden'` rounded layer — the native
 * `cornerConfiguration` in GlassView.swift does not reliably round the effect,
 * so we mask it ourselves. The outer view keeps the caller's border/shadow
 * (and stays un-clipped so the shadow isn't masked away).
 */
export function GlassSurface({
  radius,
  glassEffectStyle = 'regular',
  fallbackColor,
  style,
  children,
  ...rest
}: Props) {
  const rounded = radius != null ? { borderRadius: radius } : null;

  if (!GLASS) {
    return (
      <View
        style={[style, rounded, fallbackColor ? { backgroundColor: fallbackColor } : null]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  return (
    <View style={[style, rounded]} {...rest}>
      <View style={[StyleSheet.absoluteFill, rounded, styles.clip]} pointerEvents="none">
        <GlassView
          glassEffectStyle={glassEffectStyle}
          // borderRadius is a real native prop (GlassEffectModule.swift) but is
          // missing from the exported types; harmless alongside the clip.
          // @ts-expect-error — see above.
          borderRadius={radius}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

/** Whether real liquid glass is active — for callers that tweak overlays
 *  (e.g. a gradient that should be translucent on glass, opaque otherwise). */
export const liquidGlassActive = GLASS;

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
