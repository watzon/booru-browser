import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Order must stay in sync with the bottom-tab order in app/(tabs)/_layout.tsx
// and the VIEWS list in components/nav-overlay.tsx. Swiping right-to-left
// advances (Browse → Favorites → Settings); left-to-right goes back.
const TAB_ORDER = ['/(tabs)', '/(tabs)/favorites', '/(tabs)/settings'] as const;

function tabIndex(pathname: string): number {
  if (pathname.endsWith('/favorites')) return 1;
  if (pathname.endsWith('/settings')) return 2;
  return 0;
}

/**
 * Wraps a tab screen so a horizontal swipe moves to the adjacent tab. The
 * gesture only engages once the drag is clearly horizontal and yields to
 * vertical movement, so the grid / scroll views underneath keep working.
 */
export function TabSwipe({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const gesture = useMemo(() => {
    const go = (dir: 1 | -1) => {
      const next = tabIndex(pathname) + dir;
      if (next < 0 || next >= TAB_ORDER.length) return;
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      router.navigate(TAB_ORDER[next] as never);
    };
    return Gesture.Pan()
      .activeOffsetX([-24, 24])
      .failOffsetY([-18, 18])
      .onEnd((e) => {
        const committed = Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 650;
        if (!committed) return;
        go(e.translationX < 0 ? 1 : -1);
      })
      .runOnJS(true);
  }, [pathname, router]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
