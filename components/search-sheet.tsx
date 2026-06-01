import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandGradient, FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { recentTagKey, useSearchHistoryStore } from '@/hooks/use-search-history';
import { useSearchStore } from '@/hooks/use-search-store';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { SHEET_MAX_WIDTH, useResponsive } from '@/hooks/use-responsive';
import { useThemeColors, useThemeName } from '@/hooks/use-theme-color';
import { useActiveServer, useServerStore } from '@/servers/store';
import { getSource } from '@/sources/registry';
import type { TagSuggestion } from '@/sources/types';

const ANIM_MS = 240;

function lastTagSegment(s: string): string {
  const parts = s.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

export function SearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const c = useThemeColors();
  const scheme = useThemeName();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { isLarge } = useResponsive();
  const reduce = useReduceMotion();
  const animMs = reduce ? 0 : ANIM_MS;

  const active = useActiveServer();
  const servers = useServerStore((s) => s.servers);
  const activeServerId = useServerStore((s) => s.activeServerId);
  const setActiveServer = useServerStore((s) => s.setActiveServer);

  const tags = useSearchStore((s) => s.tags);
  const addTag = useSearchStore((s) => s.addTag);
  const removeTag = useSearchStore((s) => s.removeTag);
  const clearTags = useSearchStore((s) => s.clear);

  const recents = useSearchHistoryStore((s) => s.recents);
  const removeRecent = useSearchHistoryStore((s) => s.removeRecent);

  const [value, setValue] = useState('');

  // Keep the sheet mounted through its slide-out so the close animates.
  const [mounted, setMounted] = useState(open);
  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      translateY.value = withTiming(0, { duration: animMs });
      backdrop.value = withTiming(1, { duration: animMs });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: animMs });
      translateY.value = withTiming(height, { duration: animMs }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lastSegment = lastTagSegment(value);
  const autocomplete = useQuery({
    queryKey: ['autocomplete', active?.id, lastSegment],
    enabled: !!active && lastSegment.length >= 1,
    queryFn: async ({ signal }) => getSource(active!).autocompleteTag(lastSegment, signal),
    staleTime: 60_000,
    retry: 0,
  });
  const suggestions: TagSuggestion[] = value.trim() ? autocomplete.data ?? [] : [];

  // Recent tags for this board, excluding ones already in the active search.
  const serverRecents = active
    ? recents.filter((r) => r.serverId === active.id && !tags.includes(r.tag)).slice(0, 12)
    : [];

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.5 }));

  const buzz = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  const submit = (tag?: string) => {
    const target = (tag ?? value).trim();
    if (!target) return;
    buzz();
    addTag(target);
    setValue('');
  };

  const pickServer = (id: string) => {
    if (id === activeServerId) return;
    buzz();
    clearTags();
    setActiveServer(id);
    setValue('');
  };

  // Tapping a recent tag adds it to the current search (and keeps the sheet
  // open to compose), matching how autocomplete and the field behave.
  const applyRecentTag = (tag: string) => {
    buzz();
    addTag(tag);
  };

  const go = (href: '/server/new' | '/servers') => {
    onClose();
    setTimeout(() => router.push(href), 80);
  };

  const pan = Gesture.Pan()
    .activeOffsetY([0, 16])
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: animMs });
      }
    });

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close search"
          onPress={onClose}
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        </Pressable>

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: c.background,
                borderColor: c.border,
                maxHeight: height * 0.82,
                paddingBottom: Math.max(insets.bottom, Spacing.md),
              },
              // On tablet screens float a centered, fully-rounded card instead of
              // an edge-to-edge sheet.
              isLarge
                ? {
                    maxWidth: SHEET_MAX_WIDTH,
                    borderBottomLeftRadius: Radius.xl,
                    borderBottomRightRadius: Radius.xl,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    marginBottom: Math.max(insets.bottom, Spacing.lg),
                    paddingBottom: Spacing.md,
                  }
                : null,
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={pan}>
              <View style={styles.handleArea}>
                <View style={[styles.grabber, { backgroundColor: c.border }]} />
              </View>
            </GestureDetector>

            {/* Fills upward: current tags + recents. */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {tags.length > 0 ? (
                <View style={styles.block}>
                  <View style={styles.blockHeader}>
                    <Text style={[styles.sectionTitle, { color: c.textMuted }]}>ACTIVE TAGS</Text>
                    <Pressable onPress={clearTags} hitSlop={8} accessibilityLabel="Clear all tags">
                      <Text style={[styles.clear, { color: c.textMuted }]}>CLEAR</Text>
                    </Pressable>
                  </View>
                  <View style={styles.wrap}>
                    {tags.map((t) => (
                      <Chip key={t} label={t} mode="removable" onRemove={() => removeTag(t)} />
                    ))}
                  </View>
                </View>
              ) : null}

              {serverRecents.length > 0 ? (
                <View style={styles.block}>
                  <Text style={[styles.sectionTitle, { color: c.textMuted }]}>RECENT</Text>
                  <View style={styles.wrap}>
                    {serverRecents.map((r) => (
                      <Chip
                        key={recentTagKey(r)}
                        label={r.tag}
                        mode="selectable"
                        onPress={() => applyRecentTag(r.tag)}
                        onLongPress={() => removeRecent(recentTagKey(r))}
                        accessibilityHint="Long-press to remove"
                      />
                    ))}
                  </View>
                </View>
              ) : tags.length === 0 ? (
                <Text style={[styles.empty, { color: c.textMuted }]}>
                  {active ? Strings.SEARCH_EMPTY_BODY : 'Pick a booru below to start.'}
                </Text>
              ) : null}
            </ScrollView>

            {/* Booru selector — right above the field for thumb reach. Wraps
                instead of side-scrolling so every booru is visible at once. */}
            <View style={styles.booruRow}>
              <Text style={[styles.sectionTitle, { color: c.textMuted }]}>BOORU</Text>
              <View style={styles.wrap}>
                {servers.map((s) => {
                  const isActive = s.id === activeServerId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => pickServer(s.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={s.name}
                    >
                      {isActive ? (
                        <LinearGradient
                          colors={BrandGradient[scheme]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.booruChip}
                        >
                          <Text style={styles.booruChipActiveText} numberOfLines={1}>
                            {s.name}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View style={[styles.booruChip, { backgroundColor: c.surfaceMuted }]}>
                          <Text style={[styles.booruChipText, { color: c.text }]} numberOfLines={1}>
                            {s.name}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => go(servers.length === 0 ? '/server/new' : '/servers')}
                  accessibilityRole="button"
                  accessibilityLabel={servers.length === 0 ? 'Add a booru' : 'Manage boorus'}
                  style={[styles.booruChip, styles.manageChip, { borderColor: c.border }]}
                >
                  <IconSymbol name="plus" color={c.accent} size={16} />
                  <Text style={[styles.booruChipText, { color: c.accent }]}>
                    {servers.length === 0 ? 'Add booru' : 'Manage'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Autocomplete suggestions, just above the field while typing. */}
            {suggestions.length > 0 ? (
              <View style={[styles.suggestions, { borderColor: c.border }]}>
                {suggestions.slice(0, 6).map((s, idx) => (
                  <Pressable
                    key={s.name}
                    onPress={() => submit(s.name)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      s.postCount !== undefined
                        ? `${s.name}, ${s.postCount.toLocaleString()} posts`
                        : s.name
                    }
                    style={({ pressed }) => [
                      styles.suggestionRow,
                      {
                        borderTopColor: c.border,
                        borderTopWidth: idx === 0 ? 0 : StyleSheet.hairlineWidth,
                        backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.suggestionText, { color: c.text }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                    {s.postCount !== undefined ? (
                      <Text style={[styles.suggestionCount, { color: c.textMuted }]}>
                        {s.postCount.toLocaleString()}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Search field — anchored low, above the keyboard. */}
            <View style={[styles.field, { backgroundColor: c.surface, borderColor: c.border }]}>
              <IconSymbol name="magnifyingglass" color={c.textMuted} size={18} />
              <TextInput
                value={value}
                onChangeText={setValue}
                onSubmitEditing={() => submit()}
                editable={!!active}
                placeholder={active ? `Search ${active.name}…` : 'Pick a booru first'}
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                style={[styles.input, { color: c.text }]}
                accessibilityLabel="Search tags"
              />
              {autocomplete.isFetching && lastSegment ? (
                <ActivityIndicator size="small" color={c.textMuted} />
              ) : value.length > 0 ? (
                <Pressable onPress={() => setValue('')} hitSlop={8} accessibilityLabel="Clear text">
                  <IconSymbol name="xmark" color={c.textMuted} size={16} />
                </Pressable>
              ) : null}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: '#000' },
  kav: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
  },
  handleArea: { alignItems: 'center', paddingVertical: Spacing.sm },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  scroll: { flexGrow: 0 },
  scrollContent: { justifyContent: 'flex-end', flexGrow: 1, paddingBottom: Spacing.md, gap: Spacing.xl },
  block: { gap: Spacing.sm },
  blockHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 11, letterSpacing: 0.5, fontWeight: '700' },
  clear: { fontSize: FontSize.xs, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  empty: { fontSize: FontSize.sm, paddingVertical: Spacing.md },
  booruRow: { marginTop: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.sm },
  booruChip: {
    height: 38,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 180,
  },
  manageChip: {
    flexDirection: 'row',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  booruChipText: { fontSize: FontSize.sm, fontWeight: '600' },
  booruChipActiveText: { fontSize: FontSize.sm, fontWeight: '700', color: '#FFFFFF' },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    minHeight: 40,
  },
  suggestionText: { flex: 1, fontSize: FontSize.md },
  suggestionCount: { fontSize: FontSize.xs, marginLeft: Spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    height: 50,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
  },
  input: { flex: 1, fontSize: FontSize.lg, paddingVertical: 0 },
});
