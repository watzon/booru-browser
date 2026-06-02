import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ui/toast';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useThemeColors } from '@/hooks/use-theme-color';
import { importFromUrlScheme, parsePayload } from '@/servers/importer';
import { useServerStore } from '@/servers/store';

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const c = useThemeColors();
  const toast = useToast();

  const importMany = useServerStore((s) => s.importMany);

  if (!permission) {
    return <View style={[styles.screen, { backgroundColor: c.background }]} />;
  }

  if (!permission.granted) {
    // Once the user has denied at the OS level, requestPermission() can't
    // re-prompt — send them to Settings instead.
    const canAsk = permission.canAskAgain;
    return (
      <View style={[styles.screen, { backgroundColor: c.background }]}>
        <SafeAreaView style={styles.screen}>
          <EmptyState
            icon={<IconSymbol name="qrcode.viewfinder" color={c.accent} size={56} />}
            title="Camera access needed"
            body={
              canAsk
                ? 'Booru Browser uses the camera to scan QR codes for importing server lists.'
                : 'Camera access is turned off. Enable it in Settings to scan QR codes.'
            }
            action={
              <View style={styles.actions}>
                <Button
                  label={canAsk ? 'Allow camera' : 'Open Settings'}
                  onPress={canAsk ? requestPermission : () => Linking.openSettings()}
                />
                <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
              </View>
            }
          />
        </SafeAreaView>
      </View>
    );
  }

  const handleScan = async (data: string) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setBusy(true);
    try {
      let result;
      if (data.startsWith('boorubrowser://')) {
        result = await importFromUrlScheme(data);
      } else {
        result = parsePayload(data);
      }
      if (!result) throw new Error('Empty payload');
      const out = importMany(result.servers, result.file.defaultServerId);
      const total = out.added + out.updated;
      toast.success(Strings.IMPORT_SUCCESS(total));
      router.dismissTo('/servers');
    } catch (e) {
      toast.error(`Scan failed: ${(e as Error).message}`);
      scanLock.current = false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : ({ data }) => handleScan(data)}
      />
      <SafeAreaView pointerEvents="box-none" style={styles.overlay}>
        <View
          style={styles.overlayPill}
          accessibilityLiveRegion="polite"
          accessibilityRole="text"
        >
          <Text style={styles.overlayText} maxFontSizeMultiplier={1.4}>
            Point camera at a Booru Browser QR code
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', padding: Spacing.xxl },
  overlayPill: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    maxWidth: 360,
  },
  overlayText: {
    color: '#fff',
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
