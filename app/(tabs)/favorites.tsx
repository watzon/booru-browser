import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PostGrid } from '@/components/post-grid';
import { TabSwipe } from '@/components/tab-swipe';
import { Chip } from '@/components/ui/chip';
import { FontSize, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useFavoritesStore } from '@/favorites/store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useServerStore } from '@/servers/store';
import { imageHeaders } from '@/sources/headers';
import type { Post } from '@/sources/types';

export default function FavoritesScreen() {
  const router = useRouter();
  const entries = useFavoritesStore((s) => s.entries);
  const servers = useServerStore((s) => s.servers);
  const [serverFilter, setServerFilter] = useState<string | 'all'>('all');

  const c = useThemeColors();

  const filtered = useMemo(
    () =>
      serverFilter === 'all'
        ? entries
        : entries.filter((e) => e.serverId === serverFilter),
    [entries, serverFilter],
  );

  const posts = filtered.map((e) => e.post);

  const headersByPostId = useMemo(() => {
    const map = new Map<string, Record<string, string>>();
    const baseByServer = new Map<string, string | undefined>(
      servers.map((s) => [s.id, s.baseUrl]),
    );
    for (const e of filtered) {
      map.set(e.post.id, imageHeaders(baseByServer.get(e.serverId)));
    }
    return map;
  }, [filtered, servers]);

  const headersFor = useCallback(
    (post: Post) => headersByPostId.get(post.id) ?? imageHeaders(),
    [headersByPostId],
  );

  return (
    <TabSwipe>
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
        >
          Favorites
        </Text>
        <Text
          style={[styles.subtitle, { color: c.textMuted }]}
          maxFontSizeMultiplier={1.4}
        >
          {filtered.length} {filtered.length === 1 ? 'post' : 'posts'}
        </Text>
      </View>
      {servers.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingHorizontal: Spacing.md }}
          style={styles.chips}
        >
          {(
            [{ id: 'all' as const, name: 'All' }, ...servers] as { id: string; name: string }[]
          ).map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              mode="selectable"
              selected={serverFilter === s.id}
              onPress={() => setServerFilter(s.id as 'all' | string)}
            />
          ))}
        </ScrollView>
      ) : null}
      <PostGrid
        posts={posts}
        imageHeadersFor={headersFor}
        onPostPress={(post) => {
          const entry = filtered.find((e) => e.post.id === post.id);
          if (!entry) return;
          router.push({
            pathname: '/post/[id]',
            params: { id: post.id, serverId: entry.serverId, source: 'favorites' },
          });
        }}
        emptyMessage={`${Strings.FAVORITES_EMPTY_TITLE} — ${Strings.FAVORITES_EMPTY_BODY}`}
      />
    </SafeAreaView>
    </TabSwipe>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  title: { fontSize: FontSize.xxl, fontWeight: '700' },
  subtitle: { fontSize: FontSize.sm, marginTop: 2 },
  chips: { flexGrow: 0, marginBottom: Spacing.xs },
});
