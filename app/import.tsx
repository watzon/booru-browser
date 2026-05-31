import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ui/toast';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useThemeColors } from '@/hooks/use-theme-color';
import {
  importFromClipboard,
  importFromFile,
  importFromUrlScheme,
  type ImportResult,
} from '@/servers/importer';
import { useServerStore } from '@/servers/store';
import { SOURCE_KINDS } from '@/sources/registry';

export default function ImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ src?: string; data?: string }>();
  const c = useThemeColors();
  const toast = useToast();

  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const importMany = useServerStore((s) => s.importMany);

  useEffect(() => {
    if ((params.src || params.data) && !preview) {
      const url = new URL('boorubrowser://import');
      if (params.src) url.searchParams.set('src', params.src);
      if (params.data) url.searchParams.set('data', params.data);
      handle(() => importFromUrlScheme(url.toString()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.src, params.data]);

  const handle = async (fn: () => Promise<ImportResult | null>) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res) return;
      setPreview(res);
    } catch (e) {
      toast.error(`${Strings.IMPORT_FAILED}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = () => {
    if (!preview) return;
    const result = importMany(preview.servers, preview.file.defaultServerId);
    const total = result.added + result.updated;
    toast.success(Strings.IMPORT_SUCCESS(total));
    // Navigate to Servers tab so user sees what they just imported.
    router.dismissTo('/(tabs)/servers');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: Spacing.lg, gap: Spacing.md }}>
        <Text
          style={[styles.h1, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.4}
        >
          Import server list
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>
          Import a .booruconfig.json file from your device, paste from clipboard, or scan a QR code.
        </Text>

        {!preview ? (
          <View style={{ gap: Spacing.md }}>
            <ImportAction
              icon="doc.text"
              label="Choose file…"
              onPress={() => handle(importFromFile)}
              disabled={busy}
            />
            <ImportAction
              icon="link"
              label="Paste from clipboard"
              onPress={() => handle(importFromClipboard)}
              disabled={busy}
            />
            <ImportAction
              icon="qrcode.viewfinder"
              label="Scan QR code"
              onPress={() => router.push('/scan')}
              disabled={busy}
            />
          </View>
        ) : (
          <View style={{ gap: Spacing.md, flex: 1 }}>
            <Text style={[styles.label, { color: c.textMuted }]} maxFontSizeMultiplier={1.4}>
              {preview.servers.length} {preview.servers.length === 1 ? 'server' : 'servers'} found
            </Text>
            <FlatList
              data={preview.servers}
              keyExtractor={(s) => s.id}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const kindLabel =
                  SOURCE_KINDS.find((k) => k.kind === item.kind)?.label ?? item.kind;
                return (
                  <Card padding="md" style={{ marginBottom: Spacing.sm }}>
                    <Text
                      style={[styles.rowTitle, { color: c.text }]}
                      accessibilityLabel={`${item.name}, ${kindLabel}`}
                      maxFontSizeMultiplier={1.6}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.rowSub, { color: c.textMuted }]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.6}
                    >
                      {kindLabel} · {item.baseUrl}
                    </Text>
                  </Card>
                );
              }}
            />
            <View style={{ flexDirection: 'row', gap: Spacing.md }}>
              <Button
                label="Discard"
                variant="secondary"
                onPress={() => setPreview(null)}
                style={{ flex: 1 }}
                fullWidth
              />
              <Button
                label="Import"
                onPress={confirmImport}
                style={{ flex: 1 }}
                fullWidth
              />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function ImportAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.actionRow,
        {
          borderColor: c.border,
          backgroundColor: pressed ? c.surfaceMuted : c.surface,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <IconSymbol name={icon} color={c.accent} size={22} />
      <Text style={{ color: c.text, fontWeight: '600', fontSize: FontSize.md }} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: FontSize.xxl, fontWeight: '700' },
  body: { fontSize: FontSize.sm, lineHeight: 20 },
  label: { fontSize: FontSize.xs, letterSpacing: 0.5, fontWeight: '600' },
  rowTitle: { fontSize: FontSize.md, fontWeight: '600' },
  rowSub: { fontSize: FontSize.sm, marginTop: 2 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
});
