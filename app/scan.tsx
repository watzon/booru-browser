import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
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
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text
          style={[styles.title, { color: c.text }]}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
        >
          Camera access needed
        </Text>
        <Text style={[styles.body, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>
          Booru Browser uses the camera to scan QR codes for server list imports.
        </Text>
        <Button label="Allow camera" onPress={requestPermission} />
      </SafeAreaView>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  title: { fontSize: FontSize.lg, fontWeight: '700' },
  body: { fontSize: FontSize.sm, textAlign: 'center', maxWidth: 320 },
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
