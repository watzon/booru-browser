import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagSearchInput } from '@/components/tag-search-input';
import { Chip } from '@/components/ui/chip';
import { confirm } from '@/components/ui/confirm-dialog';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ui/toast';
import { FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useFavoritesStore } from '@/favorites/store';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useSearchStore } from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useActiveServer, useServerStore } from '@/servers/store';
import { SOURCE_KINDS } from '@/sources/registry';

const ANIM_MS = 220;

function shouldHideOn(pathname: string): boolean {
  return pathname.startsWith('/post/') || pathname.startsWith('/server/validate');
}

export function NavOverlay() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const c = useThemeColors();

  if (shouldHideOn(pathname)) return null;

  const handleOpen = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setOpen(true);
  };

  return (
    <>
      <View
        style={[
          styles.fabContainer,
          { right: Spacing.xl, bottom: Math.max(insets.bottom, Spacing.md) + Spacing.lg },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={handleOpen}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          accessibilityHint="Open server, tag search, and navigation drawer"
          style={({ pressed }) => [
            styles.fab,
            Shadows.lg,
            { backgroundColor: c.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <IconSymbol name="magnifyingglass" color={c.accentText} size={24} />
        </Pressable>
      </View>
      <NavDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(Math.round(width * 0.84), 380);
  const reduce = useReduceMotion();
  const animDuration = reduce ? 0 : ANIM_MS;

  const c = useThemeColors();
  const toast = useToast();

  const { servers, activeServerId, setActiveServer, removeServer } = useServerStore();
  const pruneOrphans = useFavoritesStore((s) => s.pruneOrphans);
  const active = useActiveServer();
  const tags = useSearchStore((s) => s.tags);
  const addTag = useSearchStore((s) => s.addTag);
  const removeTag = useSearchStore((s) => s.removeTag);
  const clearTags = useSearchStore((s) => s.clear);

  const translateX = useSharedValue(drawerWidth);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (open) {
      translateX.value = withTiming(0, { duration: animDuration, easing: Easing.out(Easing.cubic) });
      backdrop.value = withTiming(1, { duration: animDuration });
    } else {
      translateX.value = withTiming(drawerWidth, {
        duration: animDuration,
        easing: Easing.in(Easing.cubic),
      });
      backdrop.value = withTiming(0, { duration: animDuration });
    }
  }, [open, drawerWidth, animDuration, translateX, backdrop]);

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value * 0.5,
  }));

  const pan = Gesture.Pan()
    .activeOffsetX([0, 20])
    .onUpdate((e) => {
      if (e.translationX > 0) translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > 80 || e.velocityX > 800) {
        translateX.value = withTiming(drawerWidth, { duration: animDuration });
        backdrop.value = withTiming(0, { duration: animDuration });
        runOnJS(onClose)();
      } else {
        translateX.value = withTiming(0, { duration: animDuration });
      }
    });

  const navigate = useCallback(
    (href: string) => {
      onClose();
      setTimeout(() => router.push(href as never), 80);
    },
    [onClose, router],
  );

  const confirmRemove = useCallback(
    async (id: string, name: string) => {
      const ok = await confirm({
        title: Strings.SERVERS_DELETE_TITLE,
        message: `Delete "${name}"? ${Strings.SERVERS_DELETE_BODY}`,
        confirmLabel: Strings.ACTION_DELETE,
        destructive: true,
      });
      if (ok) {
        removeServer(id);
        toast.success(`Removed ${name}`);
        const remaining = new Set(useServerStore.getState().servers.map((s) => s.id));
        const pruned = pruneOrphans(remaining);
        if (pruned > 0) toast.info(Strings.FAVORITES_PRUNED(pruned));
      }
    },
    [removeServer, toast, pruneOrphans],
  );

  const handleLongPress = useCallback(
    (id: string, name: string) => {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title: name,
            options: ['Edit', 'Delete', 'Cancel'],
            cancelButtonIndex: 2,
            destructiveButtonIndex: 1,
            userInterfaceStyle: 'dark',
          },
          (idx) => {
            if (idx === 0) navigate(`/server/${id}`);
            else if (idx === 1) confirmRemove(id, name);
          },
        );
      } else {
        confirmRemove(id, name);
      }
    },
    [confirmRemove, navigate],
  );

  const isOnTab = (segment: string) =>
    pathname === '/' + segment || pathname.endsWith('/' + segment) || (segment === '' && pathname === '/');

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close menu"
          onPress={onClose}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        </Pressable>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                backgroundColor: c.background,
                paddingTop: insets.top + Spacing.md,
                paddingBottom: insets.bottom + Spacing.md,
                borderColor: c.border,
              },
              drawerStyle,
            ]}
          >
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={0}
            >
              <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm }}>
                {active ? (
                  <Text
                    style={[styles.scopeLine, { color: c.textMuted }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.4}
                  >
                    Searching{' '}
                    <Text style={{ color: c.text, fontWeight: '600' }}>{active.name}</Text>
                  </Text>
                ) : (
                  <Text style={[styles.scopeLine, { color: c.textMuted }]}>No active server</Text>
                )}
                {active ? (
                  <TagSearchInput
                    server={active}
                    onTagPicked={(tag) => addTag(tag)}
                  />
                ) : null}
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: Spacing.sm, paddingBottom: Spacing.xxl, gap: Spacing.lg }}
              >
                <Section
                  title="TAGS"
                  trailing={
                    tags.length > 0 ? (
                      <Pressable
                        onPress={clearTags}
                        accessibilityRole="button"
                        accessibilityLabel="Clear all tags"
                        hitSlop={8}
                        style={{ padding: 4 }}
                      >
                        <Text style={{ color: c.textMuted, fontSize: FontSize.xs, fontWeight: '700' }}>
                          CLEAR
                        </Text>
                      </Pressable>
                    ) : null
                  }
                >
                  {tags.length === 0 ? (
                    <Text style={[styles.empty, { color: c.textMuted }]}>
                      No tags. Type above to add one.
                    </Text>
                  ) : (
                    <View style={styles.tagWrap}>
                      {tags.map((t) => (
                        <Chip
                          key={t}
                          label={t}
                          mode="removable"
                          onRemove={() => removeTag(t)}
                        />
                      ))}
                    </View>
                  )}
                </Section>

                <Section title="SERVERS">
                  {servers.length === 0 ? (
                    <Text style={[styles.empty, { color: c.textMuted }]}>No servers yet.</Text>
                  ) : (
                    servers.map((s) => {
                      const isActive = s.id === activeServerId;
                      const kindLabel =
                        SOURCE_KINDS.find((k) => k.kind === s.kind)?.label ?? s.kind;
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => {
                            if (s.id !== activeServerId) {
                              clearTags();
                              setActiveServer(s.id);
                            }
                            onClose();
                          }}
                          onLongPress={() => handleLongPress(s.id, s.name)}
                          accessibilityRole="button"
                          accessibilityLabel={`${s.name}, ${kindLabel}${isActive ? ', active' : ''}`}
                          accessibilityHint="Long-press for edit or delete"
                          accessibilityState={{ selected: isActive }}
                          style={[
                            styles.serverRow,
                            {
                              borderColor: isActive ? c.accent : 'transparent',
                              backgroundColor: isActive ? c.surfaceMuted : 'transparent',
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.serverDot,
                              { backgroundColor: isActive ? c.accent : c.border },
                            ]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.serverName,
                                { color: c.text, fontWeight: isActive ? '700' : '500' },
                              ]}
                              numberOfLines={1}
                              maxFontSizeMultiplier={1.6}
                            >
                              {s.name}
                            </Text>
                            <Text
                              style={[styles.serverSub, { color: c.textMuted }]}
                              numberOfLines={1}
                              maxFontSizeMultiplier={1.6}
                            >
                              {kindLabel}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </Section>

                <Section title="MANAGE">
                  <DrawerLink
                    icon="plus"
                    label="Add server"
                    onPress={() => navigate('/server/new')}
                  />
                  <DrawerLink
                    icon="square.and.arrow.down"
                    label="Import list"
                    onPress={() => navigate('/import')}
                  />
                </Section>

                <Section title="VIEW">
                  <DrawerLink
                    icon="photo.fill"
                    label="Browse"
                    active={isOnTab('') || pathname === '/(tabs)' || pathname === '/(tabs)/'}
                    onPress={() => navigate('/(tabs)')}
                  />
                  <DrawerLink
                    icon="star.fill"
                    label="Favorites"
                    active={isOnTab('favorites')}
                    onPress={() => navigate('/(tabs)/favorites')}
                  />
                  <DrawerLink
                    icon="gearshape.fill"
                    label="Settings"
                    active={isOnTab('settings')}
                    onPress={() => navigate('/(tabs)/settings')}
                  />
                </Section>
              </ScrollView>
            </KeyboardAvoidingView>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

function Section({
  title,
  children,
  trailing,
}: {
  title: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.sectionHeader}>
        <Text
          style={[styles.sectionTitle, { color: c.textMuted }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
        >
          {title}
        </Text>
        {trailing}
      </View>
      <View>{children}</View>
    </View>
  );
}

function DrawerLink({
  icon,
  label,
  active,
  onPress,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.linkRow,
        {
          backgroundColor: pressed ? c.surfaceMuted : 'transparent',
        },
      ]}
    >
      <IconSymbol name={icon} color={active ? c.accent : c.text} size={20} />
      <Text
        style={{
          color: active ? c.accent : c.text,
          fontWeight: active ? '700' : '500',
          fontSize: FontSize.md,
        }}
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fabContainer: { position: 'absolute', zIndex: 10 },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: { backgroundColor: '#000' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  scopeLine: { fontSize: FontSize.xs, marginBottom: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: { fontSize: 11, letterSpacing: 0.5 },
  empty: { fontSize: FontSize.sm, padding: Spacing.md },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: 4,
    minHeight: 44,
  },
  serverDot: { width: 8, height: 8, borderRadius: 4 },
  serverName: { fontSize: FontSize.md },
  serverSub: { fontSize: FontSize.xs, marginTop: 2 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    minHeight: 44,
  },
});
