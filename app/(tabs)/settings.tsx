import Constants from 'expo-constants';
import { Image as ExpoImage } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ListRow } from '@/components/ui/list-row';
import { useToast } from '@/components/ui/toast';
import { WideContainer } from '@/components/ui/wide-container';
import { FontSize, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useGateStore } from '@/gate/store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useServerStore } from '@/servers/store';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const PRIVACY_URL = 'https://watzon.tech/booru-browser';

export default function SettingsScreen() {
  const c = useThemeColors();
  const toast = useToast();
  const router = useRouter();
  const serverCount = useServerStore((s) => s.servers.length);

  const { unlocked, unlock, lock } = useGateStore();
  const [cacheSizes, setCacheSizes] = useState<{ images: number; downloads: number }>({
    images: 0,
    downloads: 0,
  });
  const [refreshingSizes, setRefreshingSizes] = useState(false);

  const refreshSizes = useCallback(async () => {
    setRefreshingSizes(true);
    const [images, downloads] = await Promise.all([
      measureImageCache(),
      measureDownloads(),
    ]);
    setCacheSizes({ images, downloads });
    setRefreshingSizes(false);
  }, []);

  useEffect(() => {
    refreshSizes();
  }, [refreshSizes]);

  const onToggleGate = (value: boolean) => {
    if (value && !unlocked) {
      Alert.alert(
        'Enable mature content?',
        'By continuing you confirm you are 18 or older and acknowledge that some sources may contain explicit material. Posts will still be filtered by your search tags.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'I am 18+', style: 'destructive', onPress: () => unlock() },
        ],
      );
      return;
    }
    if (!value && unlocked) lock();
  };

  const handleClearImageCache = async () => {
    await ExpoImage.clearDiskCache();
    await ExpoImage.clearMemoryCache();
    toast.success('Image cache cleared');
    refreshSizes();
  };

  const handleClearDownloads = async () => {
    const dir = downloadsDir();
    if (!dir) return;
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists) {
        await FileSystem.deleteAsync(dir, { idempotent: true });
      }
      toast.success('Downloads cleared');
      refreshSizes();
    } catch (e) {
      toast.error(`Couldn't clear downloads: ${(e as Error).message}`);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: 130 }}>
        <WideContainer style={{ gap: Spacing.xxl }}>
        <View>
          <Text
            style={[styles.h1, { color: c.text }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            {Strings.SETTINGS_TITLE}
          </Text>
        </View>

        <Section title="BOORUS" color={c.textMuted}>
          <Card padding="none">
            <ListRow
              title="Manage servers"
              subtitle={`${serverCount} ${serverCount === 1 ? 'booru' : 'boorus'} configured`}
              onPress={() => router.push('/servers')}
              trailing={<IconSymbol name="chevron.right" color={c.textMuted} size={18} />}
              accessibilityHint="Add, edit, import, or remove boorus"
            />
          </Card>
        </Section>

        <Section title="CONTENT" color={c.textMuted}>
          <Card padding="lg">
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: c.text }]} maxFontSizeMultiplier={1.6}>
                  Mature content
                </Text>
                <Text style={[styles.rowSub, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>
                  {unlocked ? Strings.SETTINGS_GATE_UNLOCKED : Strings.SETTINGS_GATE_LOCKED}
                </Text>
              </View>
              <Switch
                value={unlocked}
                onValueChange={onToggleGate}
                accessibilityLabel="Mature content"
              />
            </View>
          </Card>
        </Section>

        <Section title="ABOUT" color={c.textMuted}>
          <Card padding="none">
            <ListRow
              title="Booru Browser"
              subtitle={Strings.SETTINGS_VERSION_LABEL(APP_VERSION)}
            />
          </Card>
        </Section>

        <Section title={Strings.SETTINGS_STORAGE_TITLE.toUpperCase()} color={c.textMuted}>
          <Card padding="lg" style={{ gap: Spacing.md }}>
            <Text style={{ color: c.text }} maxFontSizeMultiplier={1.6}>
              {Strings.SETTINGS_IMAGE_CACHE_SIZE(formatBytes(cacheSizes.images))}
            </Text>
            <Text style={{ color: c.text }} maxFontSizeMultiplier={1.6}>
              {Strings.SETTINGS_DOWNLOADS_SIZE(formatBytes(cacheSizes.downloads))}
            </Text>
            <View style={{ flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' }}>
              <Button
                label={Strings.SETTINGS_CLEAR_IMAGE_CACHE}
                variant="secondary"
                size="sm"
                onPress={handleClearImageCache}
              />
              <Button
                label={Strings.SETTINGS_CLEAR_DOWNLOADS}
                variant="secondary"
                size="sm"
                onPress={handleClearDownloads}
              />
              <Button
                label="Refresh"
                variant="ghost"
                size="sm"
                onPress={refreshSizes}
                loading={refreshingSizes}
              />
            </View>
          </Card>
        </Section>

        <Section title="PRIVACY" color={c.textMuted}>
          <Text
            style={[styles.bodyText, { color: c.textMuted }]}
            maxFontSizeMultiplier={1.6}
          >
            Booru Browser does not ship a default server list. Servers are stored only on this
            device. API keys are stored in iOS Keychain. No analytics, no tracking.
          </Text>
          <Button
            label="Privacy Policy"
            variant="ghost"
            size="sm"
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL).catch(() => {})}
          />
        </Section>
        </WideContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
  color,
}: {
  title: string;
  children: React.ReactNode;
  color: string;
}) {
  return (
    <View>
      <Text
        style={[styles.sectionTitle, { color }]}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
      >
        {title}
      </Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function downloadsDir(): string | null {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}downloads/` : null;
}

async function measureImageCache(): Promise<number> {
  try {
    const path = await ExpoImage.getCachePathAsync('').catch(() => null);
    if (!path) return 0;
    const dir = path.replace(/[^/]*$/, '');
    return await measureDir(dir);
  } catch {
    return 0;
  }
}

async function measureDownloads(): Promise<number> {
  const dir = downloadsDir();
  if (!dir) return 0;
  return measureDir(dir);
}

async function measureDir(dir: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists || !info.isDirectory) return 0;
    const entries = await FileSystem.readDirectoryAsync(dir);
    let total = 0;
    for (const name of entries) {
      const entry = `${dir}${name}`;
      const childInfo = await FileSystem.getInfoAsync(entry);
      if (!childInfo.exists) continue;
      if (childInfo.isDirectory) total += await measureDir(entry + '/');
      else if (typeof (childInfo as { size?: number }).size === 'number')
        total += (childInfo as { size: number }).size;
    }
    return total;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`;
}

const styles = StyleSheet.create({
  h1: { fontSize: 28, fontWeight: '700' },
  sectionTitle: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  sectionBody: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  rowTitle: { fontSize: FontSize.md, fontWeight: '500' },
  rowSub: { fontSize: FontSize.sm, marginTop: 4 },
  bodyText: { fontSize: FontSize.sm, lineHeight: 20 },
});
