import { Link, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { confirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ui/toast';
import { FontSize, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useFavoritesStore } from '@/favorites/store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { buildExportPayload, shareAsFile } from '@/servers/exporter';
import { useServerStore } from '@/servers/store';
import { SOURCE_KINDS } from '@/sources/registry';

export default function ServersScreen() {
  const router = useRouter();
  const { servers, activeServerId, setActiveServer, removeServer } = useServerStore();
  const pruneOrphans = useFavoritesStore((s) => s.pruneOrphans);
  const c = useThemeColors();
  const toast = useToast();

  const handleExport = useCallback(async () => {
    if (servers.length === 0) return;
    const payload = buildExportPayload(servers, activeServerId);
    try {
      await shareAsFile(payload);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    }
  }, [servers, activeServerId, toast]);

  const confirmDelete = useCallback(
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
        // The store update is synchronous so we can compute the survivors set
        // from the current state for orphan-pruning.
        const remaining = new Set(useServerStore.getState().servers.map((s) => s.id));
        const pruned = pruneOrphans(remaining);
        if (pruned > 0) toast.info(Strings.FAVORITES_PRUNED(pruned));
      }
    },
    [removeServer, toast, pruneOrphans],
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={styles.header}>
        <Text
          style={[styles.title, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
        >
          Servers
        </Text>
        <View style={styles.actions}>
          <Link href="/server/new" asChild>
            <IconButton accessibilityLabel="Add server">
              <IconSymbol name="plus" color={c.accent} size={24} />
            </IconButton>
          </Link>
          <Link href="/import" asChild>
            <IconButton accessibilityLabel="Import server list">
              <IconSymbol name="square.and.arrow.down" color={c.accent} size={22} />
            </IconButton>
          </Link>
          {servers.length > 0 ? (
            <IconButton accessibilityLabel="Export server list" onPress={handleExport}>
              <IconSymbol name="square.and.arrow.up" color={c.accent} size={22} />
            </IconButton>
          ) : null}
        </View>
      </View>

      <FlatList
        data={servers}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.md }}
        ListEmptyComponent={
          <EmptyState
            title={Strings.SERVERS_EMPTY_TITLE}
            body={Strings.SERVERS_EMPTY_BODY}
          />
        }
        renderItem={({ item }) => {
          const kindLabel = SOURCE_KINDS.find((k) => k.kind === item.kind)?.label ?? item.kind;
          const isActive = item.id === activeServerId;
          return (
            <Card
              selected={isActive}
              onPress={() => setActiveServer(item.id)}
              onLongPress={() => {
                router.push({ pathname: '/server/[id]', params: { id: item.id } });
              }}
              accessibilityLabel={`${item.name}, ${kindLabel}${isActive ? ', active' : ''}`}
              accessibilityHint="Tap to activate. Long-press to edit. Use the delete action below the long-press menu to remove."
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.cardTitle, { color: c.text }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.6}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[styles.cardSubtitle, { color: c.textMuted }]}
                    numberOfLines={1}
                    maxFontSizeMultiplier={1.6}
                  >
                    {kindLabel} · {item.baseUrl.replace(/^https?:\/\//, '')}
                  </Text>
                </View>
                {isActive ? (
                  <Text style={[styles.activeTag, { color: c.accent }]}>Active</Text>
                ) : null}
                <IconButton
                  accessibilityLabel={`Delete ${item.name}`}
                  onPress={() => confirmDelete(item.id, item.name)}
                  size={36}
                >
                  <IconSymbol name="trash" color={c.danger} size={18} />
                </IconButton>
              </View>
            </Card>
          );
        }}
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
  },
  title: { flex: 1, fontSize: FontSize.xxl, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 4 },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600' },
  cardSubtitle: { fontSize: FontSize.sm, marginTop: 4 },
  activeTag: { fontSize: FontSize.sm, fontWeight: '600', marginRight: Spacing.sm },
});
