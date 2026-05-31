import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostGrid } from '@/components/post-grid';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useGateStore } from '@/gate/store';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { flattenPages, usePostSearch } from '@/hooks/use-post-search';
import { useSearchHistoryStore } from '@/hooks/use-search-history';
import { useSearchStore } from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useActiveServer, useServerStore } from '@/servers/store';
import { imageHeaders } from '@/sources/headers';
import { VerificationRequired } from '@/sources/http';

export default function BrowseScreen() {
  const router = useRouter();
  const active = useActiveServer();
  const servers = useServerStore((s) => s.servers);
  const gateUnlocked = useGateStore((s) => s.unlocked);
  const network = useNetworkStatus();

  const tags = useSearchStore((s) => s.tags);
  const order = useSearchStore((s) => s.order);
  const ratingFilter = useSearchStore((s) => s.ratingFilter);
  const layout = useSearchStore((s) => s.layout);
  const toggleLayout = useSearchStore((s) => s.toggleLayout);
  const removeTag = useSearchStore((s) => s.removeTag);
  const clearTags = useSearchStore((s) => s.clear);

  const c = useThemeColors();
  const pushRecent = useSearchHistoryStore((s) => s.pushRecent);

  const query = usePostSearch(active);
  const posts = flattenPages(query.data);

  const filtersActive = order !== 'newest' || ratingFilter !== 'all';
  const activeHeaders = active ? imageHeaders(active.baseUrl) : undefined;

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

  if (servers.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <EmptyState
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
            <Button label="Open Servers" variant="secondary" onPress={() => router.push('/(tabs)/servers')} />
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.title, { color: c.text }]}
            numberOfLines={1}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            {active.name}
          </Text>
          <Text
            style={[styles.subtitle, { color: c.textMuted }]}
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
          >
            {tags.length ? tags.join(' ') : 'All posts'}
            {!gateUnlocked ? '  ·  SFW only' : ''}
          </Text>
        </View>
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
        <IconButton
          onPress={toggleLayout}
          accessibilityLabel={layout === 'grid' ? 'Switch to card layout' : 'Switch to grid layout'}
        >
          <IconSymbol
            name={layout === 'grid' ? 'rectangle.portrait' : 'square.grid.2x2'}
            color={c.accent}
            size={24}
          />
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

      <PostGrid
        posts={posts}
        layout={layout}
        loading={query.isLoading}
        loadingMore={query.isFetchingNextPage}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => query.refetch()}
        imageHeadersFor={activeHeaders ? () => activeHeaders : undefined}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
          }
        }}
        onPostPress={(post) =>
          router.push({ pathname: '/post/[id]', params: { id: post.id } })
        }
        emptyMessage={
          query.isError
            ? `${Strings.ERROR_GENERIC_TITLE}: ${(query.error as Error).message}`
            : Strings.BROWSE_EMPTY_NO_POSTS_TITLE
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  title: { fontSize: FontSize.xl, fontWeight: '700' },
  subtitle: { fontSize: FontSize.sm, marginTop: 2 },
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
