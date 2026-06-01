import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import {
  type LayoutChangeEvent,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostDetail } from '@/components/post-detail';
import { PostGrid } from '@/components/post-grid';
import { TabSwipe } from '@/components/tab-swipe';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { GlassSurface } from '@/components/ui/glass-surface';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandMark } from '@/components/ui/sparkle';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useGateStore } from '@/gate/store';
import { useOnboardingStore } from '@/onboarding/store';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { flattenPages, usePostSearch } from '@/hooks/use-post-search';
import { useResponsive } from '@/hooks/use-responsive';
import type { GalleryLayout } from '@/hooks/use-search-store';
import { useSearchHistoryStore } from '@/hooks/use-search-history';
import { useSearchStore } from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useActiveServer, useServerStore } from '@/servers/store';
import { imageHeaders } from '@/sources/headers';
import { VerificationRequired } from '@/sources/http';
import { getSource } from '@/sources/registry';
import type { Post } from '@/sources/types';

// Warm the detail cache for up to this many posts around the viewport center
// when scrolling settles, with this many getPost requests in flight at once.
const MAX_PREFETCH = 8;
const PREFETCH_CONCURRENCY = 3;

// The layout toggle button shows the icon for the *current* layout and
// announces the layout it will switch to next. Keyed by the current layout.
const LAYOUT_META: Record<
  GalleryLayout,
  { icon: ComponentProps<typeof IconSymbol>['name']; nextLabel: string }
> = {
  grid: { icon: 'square.grid.2x2', nextLabel: 'Switch to bento layout' },
  masonry: { icon: 'rectangle.3.group', nextLabel: 'Switch to card layout' },
  card: { icon: 'rectangle.portrait', nextLabel: 'Switch to grid layout' },
};

export default function BrowseScreen() {
  const router = useRouter();
  const active = useActiveServer();
  const servers = useServerStore((s) => s.servers);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const onboardingDone = useOnboardingStore((s) => s.completed);
  const network = useNetworkStatus();

  const tags = useSearchStore((s) => s.tags);
  const order = useSearchStore((s) => s.order);
  const ratingFilter = useSearchStore((s) => s.ratingFilter);
  const layout = useSearchStore((s) => s.layout);
  const toggleLayout = useSearchStore((s) => s.toggleLayout);
  const removeTag = useSearchStore((s) => s.removeTag);
  const clearTags = useSearchStore((s) => s.clear);

  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const pushRecent = useSearchHistoryStore((s) => s.pushRecent);
  const { isSplit } = useResponsive();
  const queryClient = useQueryClient();
  const gateUnlocked = useGateStore((s) => s.unlocked);

  // The header is a liquid-glass bar overlaid on the grid so posts scroll
  // beneath it. We measure its real height (it grows with chip/banner rows) and
  // pad the grid's top by that much so the first row never starts hidden.
  // Seed with an estimate (status bar + ~one bar) to avoid a first-frame jump.
  const [headerHeight, setHeaderHeight] = useState(insets.top + 52);
  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height);
    setHeaderHeight((prev) => (prev === h ? prev : h));
  }, []);

  const query = usePostSearch(active);
  const posts = flattenPages(query.data);

  // Warm the detail query + sample image for posts near the viewport center once
  // scrolling stops, so opening one (full-screen or in the split pane) is instant
  // instead of showing "Fetching…". Center-outward, concurrency-capped.
  const prefetchPosts = useCallback(
    (toWarm: Post[]) => {
      if (!active || !network.isConnected) return;
      const server = active;
      const headers = imageHeaders(server.baseUrl);
      const top = toWarm.slice(0, MAX_PREFETCH);
      let i = 0;
      const runNext = () => {
        if (i >= top.length) return;
        const p = top[i++];
        if (p.sampleUrl) Image.prefetch(p.sampleUrl, { headers }).catch(() => {});
        queryClient
          .prefetchQuery({
            queryKey: ['post', server.id, p.id, gateUnlocked, ratingFilter],
            queryFn: ({ signal }) => getSource(server).getPost(p.id, signal),
            retry: 0,
          })
          .catch(() => {})
          .finally(runNext);
      };
      for (let w = 0; w < PREFETCH_CONCURRENCY; w++) runNext();
    },
    [active, network.isConnected, queryClient, gateUnlocked, ratingFilter],
  );

  // Split view (iPad landscape): the tapped post fills a detail pane instead of
  // pushing a full-screen route.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // A pinch/double-tap in the detail pane escalates the selected post to a
  // full-screen modal (proper in-place zoom) without navigating, so the grid
  // keeps its scroll position underneath.
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const firstId = posts[0]?.id;

  const filtersActive = order !== 'newest' || ratingFilter !== 'all';
  const activeHeaders = active ? imageHeaders(active.baseUrl) : undefined;
  // The layout toggle cycles grid → bento → card; the button shows the current
  // layout's icon and announces what tapping will switch to.
  const layoutMeta = LAYOUT_META[layout];

  // Push current tag set into history when a search completes successfully.
  const lastRecorded = useRef<string>('');
  useEffect(() => {
    if (!active || tags.length === 0 || !query.isSuccess) return;
    const key = `${active.id}|${tags.slice().sort().join(' ')}`;
    if (key === lastRecorded.current) return;
    lastRecorded.current = key;
    pushRecent(tags, active.id);
  }, [active, tags, query.isSuccess, pushRecent]);

  // Buzz once per session when a verification challenge appears.
  const buzzedForVerify = useRef(false);
  useEffect(() => {
    if (query.error instanceof VerificationRequired && !buzzedForVerify.current) {
      buzzedForVerify.current = true;
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    }
    if (!(query.error instanceof VerificationRequired)) {
      buzzedForVerify.current = false;
    }
  }, [query.error]);

  // Drop the detail selection (and any open full-screen view) when the active
  // board changes.
  useEffect(() => {
    setSelectedId(null);
    setFullscreenId(null);
  }, [active?.id]);

  // Keep the detail pane populated with the first result in split view.
  useEffect(() => {
    if (isSplit && !selectedId && firstId) setSelectedId(firstId);
  }, [isSplit, selectedId, firstId]);

  // First run: send people through the intro before anything else. Skip it once
  // a board exists (added/imported, or an upgrading user). Wait for the
  // persisted flag to hydrate so we don't flash the empty state first.
  if (!onboardingHydrated) return null;
  if (!onboardingDone && servers.length === 0) return <Redirect href="/onboarding" />;

  if (servers.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <EmptyState
          icon={<BrandMark />}
          title={Strings.SERVERS_EMPTY_TITLE}
          body={Strings.SERVERS_EMPTY_BODY}
          action={
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button label="Add server" onPress={() => router.push('/server/new')} />
              <Button label="Import list" variant="secondary" onPress={() => router.push('/import')} />
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <EmptyState
          title={Strings.BROWSE_EMPTY_NO_ACTIVE_SERVER_TITLE}
          body={Strings.BROWSE_EMPTY_NO_ACTIVE_SERVER_BODY}
          action={
            <Button label="Open Servers" variant="secondary" onPress={() => router.push('/servers')} />
          }
        />
      </SafeAreaView>
    );
  }

  const browse = (
    <View style={styles.fill}>
      <PostGrid
        posts={posts}
        layout={layout}
        contentInsetTop={headerHeight}
        loading={query.isLoading}
        loadingMore={query.isFetchingNextPage}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => query.refetch()}
        onSettled={prefetchPosts}
        imageHeadersFor={activeHeaders ? () => activeHeaders : undefined}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onPostPress={(post) => {
          if (isSplit) setSelectedId(post.id);
          else router.push({ pathname: '/post/[id]', params: { id: post.id } });
        }}
        emptyMessage={
          query.isError
            ? `${Strings.ERROR_GENERIC_TITLE}: ${(query.error as Error).message}`
            : Strings.BROWSE_EMPTY_NO_POSTS_TITLE
        }
      />

      {/* Liquid-glass header floated over the grid. It extends under the status
          bar (paddingTop = safe inset); the grid is inset by its measured
          height so posts scroll beneath it without ever starting hidden. Where
          liquid glass isn't available (Android, iOS < 26) GlassView renders a
          plain View, so we back it with a near-opaque surface for legibility. */}
      <GlassSurface
        onLayout={onHeaderLayout}
        fallbackColor={c.background + 'F2'}
        style={[styles.headerOverlay, { paddingTop: insets.top, borderBottomColor: c.border }]}
      >
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: c.text }]}
            numberOfLines={1}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            {active.name}
          </Text>
          <IconButton
            onPress={() => router.push('/filter')}
            accessibilityLabel={filtersActive ? 'Filters (active)' : 'Filters'}
            accessibilityHint="Open filter and sort options"
          >
            <View>
              <IconSymbol name="line.3.horizontal.decrease" color={c.accent} size={24} />
              {filtersActive ? (
                <View
                  style={[styles.filterDot, { backgroundColor: c.accent, borderColor: c.background }]}
                />
              ) : null}
            </View>
          </IconButton>
          <IconButton onPress={toggleLayout} accessibilityLabel={layoutMeta.nextLabel}>
            <IconSymbol name={layoutMeta.icon} color={c.accent} size={24} />
          </IconButton>
        </View>

        {!network.isConnected ? (
          <View
            style={[styles.offlineBanner, { backgroundColor: c.warning }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <IconSymbol name="lock.fill" color="#1a1206" size={14} />
            <Text style={styles.offlineText} maxFontSizeMultiplier={1.4}>
              {Strings.ERROR_OFFLINE}
            </Text>
          </View>
        ) : null}

        {tags.length > 0 ? (
          <View style={styles.chipsRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingRight: Spacing.md }}
            >
              {tags.map((tag) => (
                <Chip key={tag} label={tag} mode="removable" onRemove={() => removeTag(tag)} />
              ))}
            </ScrollView>
            <Button label="Clear" variant="ghost" size="sm" onPress={clearTags} />
          </View>
        ) : null}

        {query.error instanceof VerificationRequired ? (
          <View
            style={[styles.verifyBanner, { backgroundColor: c.danger }]}
            accessibilityRole="alert"
          >
            <Text style={[styles.verifyText, { color: c.dangerText }]} maxFontSizeMultiplier={1.4}>
              {Strings.BROWSE_VERIFICATION_REQUIRED}
            </Text>
            <Button
              label="Verify"
              size="sm"
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: '/server/validate',
                  params: { url: (query.error as VerificationRequired).url },
                })
              }
            />
          </View>
        ) : null}
      </GlassSurface>
    </View>
  );

  if (isSplit) {
    return (
      <View style={styles.splitRow}>
        <View style={styles.splitLeft}>{browse}</View>
        <View style={[styles.detailPane, { borderLeftColor: c.border }]}>
          {selectedId ? (
            <PostDetail
              postId={selectedId}
              serverId={active.id}
              embedded
              onRequestFullscreen={() => setFullscreenId(selectedId)}
            />
          ) : (
            <View style={styles.detailEmpty}>
              <Text style={styles.detailEmptyText}>Select a post to view it here</Text>
            </View>
          )}
        </View>

        {/* Full-screen viewer presented over the split layout. Rendered in its own
            GestureHandlerRootView because a RN Modal is a separate native view
            tree that the root provider doesn't reach. */}
        <Modal
          visible={fullscreenId !== null}
          animationType="fade"
          onRequestClose={() => setFullscreenId(null)}
          supportedOrientations={['portrait', 'landscape']}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            {fullscreenId ? (
              <PostDetail
                postId={fullscreenId}
                serverId={active.id}
                onBack={() => setFullscreenId(null)}
              />
            ) : null}
          </GestureHandlerRootView>
        </Modal>
      </View>
    );
  }

  return <TabSwipe>{browse}</TabSwipe>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  splitRow: { flex: 1, flexDirection: 'row' },
  splitLeft: { flex: 1 },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailPane: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    backgroundColor: Colors.dark.background,
  },
  detailEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  detailEmptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  title: {
    flex: 1,
    fontFamily: Fonts.display,
    fontSize: FontSize.xxl,
    // Baloo 2 sits high in its em box; a near-1.0 line height clips the
    // ascenders. Give it headroom and let the row center it vertically.
    lineHeight: FontSize.xxl * 1.35,
    includeFontPadding: false,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  offlineText: { color: '#1a1206', fontSize: FontSize.sm, fontWeight: '600' },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  verifyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginHorizontal: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
  },
  verifyText: { flex: 1, fontSize: FontSize.sm },
});
