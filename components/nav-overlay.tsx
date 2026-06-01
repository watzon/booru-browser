import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SearchSheet } from '@/components/search-sheet';
import { GlassSurface, liquidGlassActive } from '@/components/ui/glass-surface';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandGradient, FontSize, Shadows, Spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { BAR_MAX_WIDTH, useResponsive } from '@/hooks/use-responsive';
import { useThemeColors, useThemeName } from '@/hooks/use-theme-color';
import { useSearchStore } from '@/hooks/use-search-store';
import { useServerStore } from '@/servers/store';
import type { ServerConfig } from '@/sources/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Press-and-hold-to-switch geometry. After a brief hold the booru button sprouts
// a vertical menu of servers the user can drag through and release to pick.
const LONG_PRESS_MS = 200;
const ITEM_H = 50;
const ITEM_GAP = 8;
const MENU_GAP = 12; // gap between the button's top edge and the first menu item
const STEP = ITEM_H + ITEM_GAP;

// Center-switcher geometry. Inactive segments collapse to a square icon button of
// ICON_SEG width; the active one expands to fill the rest. The pink indicator
// slides + resizes across, all driven by one `pos` shared value (the active
// index). With `weight = clamp(1 - |pos - i|)`, the segment widths always sum to
// the row width, so nothing overflows mid-transition.
const ICON_SEG = 56;
const SEG_H = 48;
const SEG_SPRING = { damping: 16, stiffness: 170, mass: 0.9 } as const;

// The bottom bar belongs to the main tab screens only — keep it off the
// presented modals (and onboarding). '/server/' has a trailing slash so the
// Servers tab ('/servers') still shows it.
const HIDDEN_PREFIXES = [
  '/post/',
  '/server/',
  '/servers',
  '/onboarding',
  '/import',
  '/scan',
  '/search',
  '/filter',
];

function shouldHideOn(pathname: string): boolean {
  return HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
}

// Most-recently-used servers first, then any never-selected ones in their
// existing order. The active server is always treated as most-recent so it sits
// at the bottom even before any recency has been recorded. Stale ids (removed
// servers) simply don't match and are dropped from the ranking.
function orderByRecency(
  servers: ServerConfig[],
  recentIds: string[],
  activeId: string | null,
): ServerConfig[] {
  const order = activeId ? [activeId, ...recentIds.filter((x) => x !== activeId)] : recentIds;
  const rank = new Map(order.map((id, i) => [id, i] as const));
  const ranked: ServerConfig[] = [];
  const rest: ServerConfig[] = [];
  for (const s of servers) {
    if (rank.has(s.id)) ranked.push(s);
    else rest.push(s);
  }
  ranked.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  return [...ranked, ...rest];
}

// The three primary views in the center switcher. Booru selection lives in the
// search sheet now; the Servers management screen is reached from there too.
const VIEWS = [
  { key: 'browse', label: 'Browse', href: '/(tabs)', icon: 'photo.fill' },
  { key: 'favorites', label: 'Favorites', href: '/(tabs)/favorites', icon: 'star.fill' },
  { key: 'settings', label: 'Settings', href: '/(tabs)/settings', icon: 'gearshape.fill' },
] as const;

const SEG_COUNT = VIEWS.length;

function isViewActive(pathname: string, key: string): boolean {
  if (key === 'favorites') return pathname.endsWith('/favorites');
  if (key === 'settings') return pathname.endsWith('/settings');
  // Browse is the index tab — anything that isn't another known tab.
  if (pathname.endsWith('/favorites') || pathname.endsWith('/settings') || pathname.endsWith('/servers')) {
    return false;
  }
  return true;
}

export function NavOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const scheme = useThemeName();
  const c = useThemeColors();
  const reduce = useReduceMotion();
  const { isLarge, width: screenW, height: screenH } = useResponsive();

  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const recentServerIds = useServerStore((s) => s.recentServerIds);

  // The hold menu stacks upward (column-reverse → index 0 sits at the bottom,
  // nearest the thumb), so order most-recently-used first. When the list is too
  // tall to fit, the cap then drops the *least* recent ones off the top.
  const orderedServers = useMemo(
    () => orderByRecency(servers, recentServerIds, activeServerId),
    [servers, recentServerIds, activeServerId],
  );

  const activeIndex = VIEWS.findIndex((v) => isViewActive(pathname, v.key));
  // `pos` is the (possibly fractional, mid-animation) active index. Width of the
  // segment row, measured on layout, feeds the expand math.
  const pos = useSharedValue(activeIndex < 0 ? 0 : activeIndex);
  const rowW = useSharedValue(0);

  useEffect(() => {
    if (activeIndex < 0) return;
    pos.value = reduce ? activeIndex : withSpring(activeIndex, SEG_SPRING);
  }, [activeIndex, reduce, pos]);

  const indicatorStyle = useAnimatedStyle(() => {
    const expand = Math.max(0, rowW.value - SEG_COUNT * ICON_SEG);
    const p = Math.min(Math.max(pos.value, 0), SEG_COUNT - 1);
    return {
      width: ICON_SEG + expand,
      transform: [{ translateX: p * ICON_SEG }],
    };
  });

  // --- Press-and-hold booru switcher -------------------------------------
  // One continuous gesture on the search button: a quick tap opens the search
  // sheet; a brief hold sprouts a vertical server menu the finger can drag
  // through and release to pick. Hit-testing runs on the UI thread off the
  // finger's screen Y; `highlight` drives the per-item highlight and `progress`
  // the open/close transition.
  const [menuOpen, setMenuOpen] = useState(false);
  const [btnRect, setBtnRect] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  const buttonRef = useRef<View>(null);

  const scale = useSharedValue(1);
  const highlight = useSharedValue(-1);
  const prevHL = useSharedValue(-2);
  const progress = useSharedValue(0);
  const anchorY = useSharedValue(0); // button top, in window coords
  const count = useSharedValue(0);

  // How many servers fit above the button without running off the top.
  const maxItems = btnRect
    ? Math.max(1, Math.floor((btnRect.y - MENU_GAP - (insets.top + Spacing.xl) + ITEM_GAP) / STEP))
    : orderedServers.length;
  const visibleServers = orderedServers.slice(0, maxItems);
  const visibleRef = useRef<ServerConfig[]>(visibleServers);
  useEffect(() => {
    visibleRef.current = visibleServers;
    count.value = visibleServers.length;
  }, [visibleServers, count]);

  const measureButton = useCallback(() => {
    buttonRef.current?.measureInWindow((x, y, w, h) => {
      setBtnRect({ x, y, w, h });
      anchorY.value = y;
    });
  }, [anchorY]);

  const onMenuOpen = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setMenuOpen(true);
  }, []);

  const moveHaptic = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  }, []);

  const onTapOpen = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setOpen(true);
  }, []);

  const commitSelection = useCallback(
    (index: number) => {
      const list = visibleRef.current;
      const picked = index >= 0 && index < list.length ? list[index] : null;
      if (picked && picked.id !== useServerStore.getState().activeServerId) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        useSearchStore.getState().clear();
        useServerStore.getState().setActiveServer(picked.id);
        router.navigate('/(tabs)');
      }
    },
    [router],
  );

  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(LONG_PRESS_MS + 120)
      .onEnd((_e, success) => {
        if (success) runOnJS(onTapOpen)();
      });

    const pan = Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .onBegin(() => {
        if (!reduce) scale.value = withTiming(0.9, { duration: LONG_PRESS_MS });
        runOnJS(measureButton)();
      })
      .onStart(() => {
        scale.value = withSpring(1, { damping: 11, stiffness: 240 });
        highlight.value = -1;
        prevHL.value = -2;
        progress.value = withTiming(1, { duration: reduce ? 0 : 160 });
        runOnJS(onMenuOpen)();
      })
      .onUpdate((e) => {
        const base = anchorY.value - MENU_GAP; // bottom edge of the menu region
        const n = count.value;
        let hl = -1;
        if (e.absoluteY <= base && n > 0) {
          hl = Math.round((base - ITEM_H / 2 - e.absoluteY) / STEP);
          if (hl < 0) hl = 0;
          if (hl > n - 1) hl = n - 1;
        }
        if (hl !== highlight.value) {
          highlight.value = hl;
          if (hl !== prevHL.value) {
            prevHL.value = hl;
            if (hl >= 0) runOnJS(moveHaptic)();
          }
        }
      })
      .onEnd(() => {
        runOnJS(commitSelection)(highlight.value);
      })
      .onFinalize(() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 200 });
        highlight.value = -1;
        progress.value = withTiming(0, { duration: reduce ? 0 : 140 }, (finished) => {
          if (finished) runOnJS(setMenuOpen)(false);
        });
      });

    return Gesture.Exclusive(pan, tap);
  }, [
    reduce,
    measureButton,
    onMenuOpen,
    moveHaptic,
    commitSelection,
    onTapOpen,
    anchorY,
    count,
    highlight,
    prevHL,
    progress,
    scale,
  ]);

  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (shouldHideOn(pathname)) return null;

  const switchView = (href: string) => {
    if (pathname && isViewActive(pathname, hrefKey(href))) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.navigate(href as never);
  };

  return (
    <>
      <View
        style={[
          styles.barContainer,
          { bottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm },
        ]}
        pointerEvents="box-none"
      >
       <View
         style={[styles.barInner, isLarge ? { maxWidth: BAR_MAX_WIDTH } : null]}
         pointerEvents="box-none"
       >
        <GlassSurface
          radius={30}
          fallbackColor={c.surface}
          style={[styles.pill, Shadows.lg, { borderColor: c.border }]}
        >
          {activeIndex < 0 ? (
            // Neutral state (e.g. the Servers tab): three plain icon buttons, no
            // highlight — nothing in the switcher is the current screen.
            VIEWS.map((v) => (
              <Pressable
                key={v.key}
                onPress={() => switchView(v.href)}
                accessibilityRole="button"
                accessibilityLabel={v.label}
                style={styles.fallbackSegment}
              >
                <IconSymbol name={v.icon} color={c.textMuted} size={20} />
              </Pressable>
            ))
          ) : (
            <View
              style={styles.segmentRow}
              onLayout={(e) => {
                rowW.value = e.nativeEvent.layout.width;
              }}
            >
              <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none">
                <LinearGradient
                  colors={BrandGradient[scheme]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
              {VIEWS.map((v, i) => (
                <NavSegment
                  key={v.key}
                  index={i}
                  view={v}
                  pos={pos}
                  rowW={rowW}
                  muted={c.textMuted}
                  selected={i === activeIndex}
                  onPress={() => switchView(v.href)}
                />
              ))}
            </View>
          )}
        </GlassSurface>

        <GestureDetector gesture={gesture}>
          <Animated.View
            ref={buttonRef}
            accessibilityRole="button"
            accessibilityLabel="Search"
            accessibilityHint="Tap to search. Touch and hold, then drag, to switch booru."
            onAccessibilityTap={onTapOpen}
            style={buttonStyle}
          >
            <GlassSurface radius={30} style={[styles.circle, Shadows.lg]}>
              {/* Brand gradient kept as the tint. On real liquid glass it's
                  translucent so the glass refracts through; on the fallback it
                  stays opaque so the button looks exactly as before. */}
              <LinearGradient
                colors={BrandGradient[scheme]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 30, opacity: liquidGlassActive ? 0.6 : 1 }]}
              />
              <IconSymbol name="magnifyingglass" color="#FFFFFF" size={24} />
            </GlassSurface>
          </Animated.View>
        </GestureDetector>
       </View>
      </View>
      {menuOpen && btnRect && visibleServers.length > 0 ? (
        <BooruDragMenu
          servers={visibleServers}
          activeServerId={activeServerId}
          highlight={highlight}
          progress={progress}
          rect={btnRect}
          screenW={screenW}
          screenH={screenH}
        />
      ) : null}
      <SearchSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

// The vertical server menu that pops above the booru button during a hold-drag.
// Purely visual + pointer-transparent: the button's pan gesture owns the touch
// and feeds `highlight`/`progress`; this just renders to match.
function BooruDragMenu({
  servers,
  activeServerId,
  highlight,
  progress,
  rect,
  screenW,
  screenH,
}: {
  servers: ServerConfig[];
  activeServerId: string | null;
  highlight: SharedValue<number>;
  progress: SharedValue<number>;
  rect: { x: number; y: number; w: number; h: number };
  screenW: number;
  screenH: number;
}) {
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * 0.4 }));

  return (
    <View style={[StyleSheet.absoluteFill, styles.menuOverlay]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.menuBackdrop, backdropStyle]} />
      <View
        style={[
          styles.menuColumn,
          {
            right: Math.max(Spacing.lg, screenW - rect.x - rect.w),
            bottom: screenH - rect.y + MENU_GAP,
          },
        ]}
      >
        {servers.map((s, i) => (
          <BooruMenuItem
            key={s.id}
            index={i}
            name={s.name}
            current={s.id === activeServerId}
            highlight={highlight}
            progress={progress}
          />
        ))}
      </View>
    </View>
  );
}

function BooruMenuItem({
  index,
  name,
  current,
  highlight,
  progress,
}: {
  index: number;
  name: string;
  current: boolean;
  highlight: SharedValue<number>;
  progress: SharedValue<number>;
}) {
  const scheme = useThemeName();
  const c = useThemeColors();
  const activeP = useDerivedValue(() =>
    withTiming(highlight.value === index ? 1 : 0, { duration: 110 }),
  );

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: (1 - progress.value) * 12 },
      { scale: 0.96 + 0.04 * progress.value + activeP.value * 0.05 },
    ],
  }));
  const gradStyle = useAnimatedStyle(() => ({ opacity: activeP.value }));
  // The active server keeps its white label permanently (it sits on a solid
  // gradient fill); other items cross-fade to white only while under the finger.
  const mutedTextStyle = useAnimatedStyle(() => ({ opacity: current ? 0 : 1 - activeP.value }));
  const whiteTextStyle = useAnimatedStyle(() => ({ opacity: current ? 1 : activeP.value }));

  // Every item is a liquid-glass pill (frosted backing keeps labels legible over
  // whatever images scroll behind). The active server is additionally filled
  // with the brand gradient so it clearly reads as selected — the faint accent
  // tint it used before was almost invisible over bright art.
  return (
    <Animated.View style={wrapStyle}>
      <GlassSurface
        radius={ITEM_H / 2}
        fallbackColor={c.surface}
        style={[styles.menuItem, Shadows.md, { borderColor: current ? c.accent : c.border }]}
      >
        {current ? (
          <LinearGradient
            colors={BrandGradient[scheme]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.menuItemFill]}
          />
        ) : null}
        <Animated.View style={[StyleSheet.absoluteFill, gradStyle]} pointerEvents="none">
          <LinearGradient
            colors={BrandGradient[scheme]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <View style={styles.menuLabelWrap}>
          <Animated.Text
            numberOfLines={1}
            style={[styles.menuLabel, { color: c.text }, mutedTextStyle]}
          >
            {name}
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            style={[styles.menuLabel, styles.menuLabelWhite, whiteTextStyle]}
          >
            {name}
          </Animated.Text>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

// Map an href back to a VIEWS key for the active-state short-circuit.
function hrefKey(href: string): string {
  return VIEWS.find((v) => v.href === href)?.key ?? 'browse';
}

// One switcher segment. Its width, its label slot, and the icon cross-fade are
// all derived on the UI thread from the shared `pos`, so the whole row morphs in
// lockstep with the sliding gradient indicator.
function NavSegment({
  index,
  view,
  pos,
  rowW,
  muted,
  selected,
  onPress,
}: {
  index: number;
  view: (typeof VIEWS)[number];
  pos: SharedValue<number>;
  rowW: SharedValue<number>;
  muted: string;
  selected: boolean;
  onPress: () => void;
}) {
  // Slot width is the label's actual measured width, so the icon+label group is
  // tight and stays centered (a fixed slot left it visually left-of-center).
  // Seeded with a rough estimate to avoid a first-frame pop before measuring.
  const [labelW, setLabelW] = useState(() => Math.ceil(view.label.length * 8.5));

  const segStyle = useAnimatedStyle(() => {
    const expand = Math.max(0, rowW.value - SEG_COUNT * ICON_SEG);
    const w = Math.min(Math.max(1 - Math.abs(pos.value - index), 0), 1);
    return { width: ICON_SEG + w * expand };
  });
  const labelStyle = useAnimatedStyle(() => {
    const w = Math.min(Math.max(1 - Math.abs(pos.value - index), 0), 1);
    return { width: w * labelW, opacity: w };
  });
  const whiteIconStyle = useAnimatedStyle(() => {
    const w = Math.min(Math.max(1 - Math.abs(pos.value - index), 0), 1);
    return { opacity: w };
  });
  const mutedIconStyle = useAnimatedStyle(() => {
    const w = Math.min(Math.max(1 - Math.abs(pos.value - index), 0), 1);
    return { opacity: 1 - w };
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={view.label}
      style={[styles.segment, segStyle]}
    >
      <View style={styles.segmentContent}>
        <View style={styles.iconStack}>
          <Animated.View style={mutedIconStyle}>
            <IconSymbol name={view.icon} color={muted} size={20} />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, whiteIconStyle]}>
            <IconSymbol name={view.icon} color="#FFFFFF" size={20} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.labelWrap, labelStyle]}>
          {/* Fixed to the full label width so the narrowing slot clips it
              (reveal) instead of the text truncating to an ellipsis mid-animation. */}
          <Text
            style={[styles.segmentLabel, { width: labelW }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {view.label}
          </Text>
        </Animated.View>
        {/* Off-screen copy at natural width, only there to measure the slot. */}
        <Text
          style={[styles.segmentLabel, styles.labelMeasure]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          onLayout={(e) => {
            const w = Math.ceil(e.nativeEvent.layout.width);
            setLabelW((prev) => (prev === w ? prev : w));
          }}
        >
          {view.label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  barContainer: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'center',
    zIndex: 10,
  },
  barInner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
  },
  segmentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
  },
  indicator: {
    position: 'absolute',
    left: 0,
    top: (60 - SEG_H) / 2,
    height: SEG_H,
    borderRadius: SEG_H / 2,
    overflow: 'hidden',
  },
  segment: {
    height: SEG_H,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconStack: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  labelWrap: { height: 22, justifyContent: 'center', overflow: 'hidden' },
  labelMeasure: { position: 'absolute', opacity: 0, left: 0, top: 0 },
  segmentLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: FontSize.md },
  fallbackSegment: {
    flex: 1,
    height: SEG_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuOverlay: { zIndex: 20 },
  menuBackdrop: { backgroundColor: '#000' },
  menuColumn: {
    position: 'absolute',
    flexDirection: 'column-reverse',
    alignItems: 'flex-end',
    gap: ITEM_GAP,
  },
  menuItem: {
    height: ITEM_H,
    minWidth: 150,
    maxWidth: 260,
    borderRadius: ITEM_H / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  // Slightly translucent so the liquid glass still reads through the active
  // server's gradient fill.
  menuItemFill: { opacity: 0.9 },
  menuLabelWrap: { justifyContent: 'center' },
  menuLabel: { fontSize: FontSize.md, fontWeight: '700', maxWidth: 200 },
  menuLabelWhite: { position: 'absolute', top: 0, left: 0, color: '#FFFFFF' },
});
