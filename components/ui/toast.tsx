import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useThemeColors } from '@/hooks/use-theme-color';

// Height of the floating nav pill (components/nav-overlay.tsx). Toasts sit
// above it so they're never hidden behind the bar on the main tab screens.
const NAV_BAR_HEIGHT = 60;

type ToastKind = 'info' | 'success' | 'error' | 'warning';
type ToastItem = { id: number; message: string; kind: ToastKind; duration: number };

type ToastApi = {
  show: (message: string, opts?: { kind?: ToastKind; duration?: number }) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Render-safe no-op if a caller is mounted outside the provider (e.g. tests).
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    };
  }
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi['show']>((message, opts) => {
    const id = ++idRef.current;
    const duration = opts?.duration ?? 2800;
    setItems((prev) => [...prev, { id, message, kind: opts?.kind ?? 'info', duration }]);
    setTimeout(() => dismiss(id), duration);
  }, [dismiss]);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (m, d) => show(m, { kind: 'success', duration: d }),
    error: (m, d) => show(m, { kind: 'error', duration: d }),
    warning: (m, d) => show(m, { kind: 'warning', duration: d }),
    info: (m, d) => show(m, { kind: 'info', duration: d }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastHost items={items} />
    </ToastContext.Provider>
  );
}

function ToastHost({ items }: { items: ToastItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        // Clear the floating nav bar: it's anchored at
        // max(insets.bottom, Spacing.sm) + Spacing.sm with a 60pt pill. On
        // screens without the nav this just floats slightly higher, which is fine.
        { bottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm + NAV_BAR_HEIGHT + Spacing.md },
      ]}
    >
      {items.map((t) => (
        <ToastBubble key={t.id} item={t} />
      ))}
    </View>
  );
}

function ToastBubble({ item }: { item: ToastItem }) {
  const c = useThemeColors();
  const reduce = useReduceMotion();
  const ty = useSharedValue(reduce ? 0 : 8);

  useEffect(() => {
    ty.value = withTiming(0, { duration: reduce ? 0 : 180, easing: Easing.out(Easing.cubic) });
  }, [reduce, ty]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: ty.value }] }));

  const bg =
    item.kind === 'success' ? c.success :
    item.kind === 'error' ? c.danger :
    item.kind === 'warning' ? c.warning :
    c.surface;
  const fg =
    item.kind === 'success' || item.kind === 'error' ? '#fff' :
    item.kind === 'warning' ? '#1a1206' :
    c.text;

  return (
    <Animated.View
      entering={FadeIn.duration(reduce ? 0 : 160)}
      exiting={FadeOut.duration(reduce ? 0 : 160)}
      style={[styles.bubble, animStyle, Shadows.md, { backgroundColor: bg, borderColor: c.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
    >
      <Text style={[styles.text, { color: fg }]} maxFontSizeMultiplier={1.6}>
        {item.message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  bubble: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: 480,
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '500',
    textAlign: 'center',
  },
});
