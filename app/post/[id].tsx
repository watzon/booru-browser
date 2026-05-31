import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { isVideo, PostViewer } from '@/components/post-viewer';
import { TagPanel } from '@/components/tag-panel';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ui/toast';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import {
  saveLocalUriToPhotos,
  shareLink,
  shareLocalUri,
  startDownload,
  type DownloadController,
} from '@/downloads/save';
import { useFavoritesStore } from '@/favorites/store';
import { useGateStore } from '@/gate/store';
import { useSearchStore } from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useActiveServer, useServerStore } from '@/servers/store';
import { imageHeaders } from '@/sources/headers';
import { VerificationRequired } from '@/sources/http';
import { getSource } from '@/sources/registry';

export default function PostScreen() {
  const params = useLocalSearchParams<{ id: string; serverId?: string }>();
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();

  const activeServer = useActiveServer();
  const servers = useServerStore((s) => s.servers);
  const gateUnlocked = useGateStore((s) => s.unlocked);
  const ratingFilter = useSearchStore((s) => s.ratingFilter);
  const server = params.serverId
    ? (servers.find((s) => s.id === params.serverId) ?? activeServer)
    : activeServer;

  const favorites = useFavoritesStore();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [showTags, setShowTags] = useState(false);
  const [downloadState, setDownloadState] = useState<
    | null
    | { kind: 'save' | 'share'; progress: number; label: string }
  >(null);
  const downloadRef = useRef<DownloadController | null>(null);
  const insets = useSafeAreaInsets();
  const setTags = useSearchStore((s) => s.setTags);

  // Include gate state and rating filter in the key so the cached post is
  // re-evaluated if the user unlocks the gate or changes filters mid-session.
  const query = useQuery({
    queryKey: ['post', server?.id, params.id, gateUnlocked, ratingFilter],
    enabled: !!server && !!params.id,
    queryFn: async ({ signal }) => {
      if (!server) throw new Error('No server selected');
      return getSource(server).getPost(params.id, signal);
    },
  });

  const post = query.data;

  if (!server) {
    return (
      <View style={styles.center}>
        <Text style={{ color: c.text }}>No server selected</Text>
      </View>
    );
  }

  if (query.isError) {
    if (query.error instanceof VerificationRequired) {
      const failingUrl = query.error.url;
      return (
        <View style={styles.center}>
          <Text style={styles.errorTitle} maxFontSizeMultiplier={1.4}>
            This page needs browser verification
          </Text>
          <Text style={styles.errorBody} maxFontSizeMultiplier={1.4}>
            {server.name} requires a one-time challenge. Tap below, complete it, then come back.
          </Text>
          <Button
            label="Verify in browser"
            onPress={() =>
              router.push({ pathname: '/server/validate', params: { url: failingUrl } })
            }
          />
        </View>
      );
    }
    return (
      <View style={styles.center}>
        <Text style={styles.errorBody} maxFontSizeMultiplier={1.4}>
          {Strings.ERROR_GENERIC_TITLE}: {(query.error as Error).message}
        </Text>
        <Button label={Strings.ACTION_RETRY} variant="secondary" onPress={() => query.refetch()} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Loading post">
        <ActivityIndicator color="#fff" />
        <Text style={styles.loadingText} maxFontSizeMultiplier={1.4}>
          {query.fetchStatus === 'idle' ? 'Waiting…' : 'Fetching…'}
        </Text>
      </View>
    );
  }

  const isFavorite = favorites.has(server.id, post.id);
  const isVideoPost = isVideo(post);
  const mediaWord = isVideoPost ? 'video' : 'image';

  const handleStar = () => {
    const nowFavorited = favorites.toggle(server.id, post);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    toast.success(nowFavorited ? Strings.TOAST_FAVORITED : Strings.TOAST_UNFAVORITED);
  };

  const runDownload = async (
    kind: 'save' | 'share',
    label: string,
    after: (localUri: string) => Promise<void>,
  ) => {
    setDownloadState({ kind, progress: 0, label });
    const ctrl = startDownload(post, {
      headers: imageHeaders(server.baseUrl),
      onProgress: (fraction) =>
        setDownloadState((s) => (s ? { ...s, progress: fraction } : s)),
    });
    downloadRef.current = ctrl;
    try {
      const uri = await ctrl.promise;
      await after(uri);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg !== 'canceled') toast.error(`${label} failed: ${msg}`);
    } finally {
      downloadRef.current = null;
      setDownloadState(null);
    }
  };

  const handleSave = () =>
    runDownload('save', `Save ${mediaWord}`, async (uri) => {
      const result = await saveLocalUriToPhotos(uri);
      if (result === 'denied') {
        toast.error('Allow Photos access in Settings to save.');
      } else {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        toast.success(Strings.TOAST_DOWNLOAD_DONE);
      }
    });

  const handleShareFile = () =>
    runDownload('share', `Share ${mediaWord}`, async (uri) => {
      await shareLocalUri(uri, post);
    });

  const handleShareLink = async () => {
    try {
      await shareLink(post);
    } catch (e) {
      toast.error(`Share failed: ${(e as Error).message}`);
    }
  };

  const handleShare = () => {
    const fileLabel = `Share ${mediaWord}`;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Share',
          options: ['Share link', fileLabel, Strings.ACTION_CANCEL],
          cancelButtonIndex: 2,
          userInterfaceStyle: 'dark',
        },
        (idx) => {
          if (idx === 0) handleShareLink();
          else if (idx === 1) handleShareFile();
        },
      );
    } else {
      handleShareLink();
    }
  };

  const cancelDownload = () => downloadRef.current?.cancel();

  return (
    <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <PostViewer
        post={post}
        headers={imageHeaders(server.baseUrl)}
        chromeVisible={chromeVisible}
        onTap={() => setChromeVisible((v) => !v)}
      />

      {chromeVisible ? (
        <View
          pointerEvents="box-none"
          style={[styles.topChrome, { paddingTop: insets.top + 4 }]}
        >
          <IconButton
            accessibilityLabel="Back"
            onPress={() => router.back()}
            size={44}
          >
            <IconSymbol name="chevron.left" color="#fff" size={28} />
          </IconButton>
          <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="none">
            <Text style={styles.topTitle} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              #{post.id}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      ) : null}

      {chromeVisible ? (
        <SafeAreaView edges={['bottom']} style={styles.chromeWrap} pointerEvents="box-none">
          {showTags ? (
            <View style={styles.tagPanel}>
              <TagPanel
                post={post}
                onTagPress={(tag) => {
                  setTags([tag]);
                  router.dismissTo('/(tabs)');
                }}
              />
            </View>
          ) : null}
          <View style={styles.toolbar}>
            <ToolbarButton
              icon={isFavorite ? 'star.fill' : 'star'}
              label={isFavorite ? 'Saved' : 'Save'}
              onPress={handleStar}
              color={isFavorite ? c.accent : '#fff'}
              accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            />
            <ToolbarButton
              icon="square.and.arrow.down"
              label="Download"
              onPress={handleSave}
              color="#fff"
              accessibilityLabel={`Download ${mediaWord}`}
            />
            <ToolbarButton
              icon="square.and.arrow.up"
              label="Share"
              onPress={handleShare}
              color="#fff"
              accessibilityLabel="Share"
            />
            <ToolbarButton
              icon="doc.text"
              label={showTags ? 'Hide' : 'Tags'}
              onPress={() => setShowTags((v) => !v)}
              color="#fff"
              accessibilityLabel={showTags ? 'Hide tag panel' : 'Show tag panel'}
            />
          </View>
        </SafeAreaView>
      ) : null}

      <DownloadProgressModal
        state={downloadState}
        accent={c.accent}
        onCancel={cancelDownload}
      />
    </View>
  );
}

function DownloadProgressModal({
  state,
  accent,
  onCancel,
}: {
  state: { kind: 'save' | 'share'; progress: number; label: string } | null;
  accent: string;
  onCancel: () => void;
}) {
  const visible = state !== null;
  const pct = Math.round((state?.progress ?? 0) * 100);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.progressBackdrop}>
        <View style={styles.progressCard} accessibilityViewIsModal>
          <Text style={styles.progressTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {state?.label ?? 'Downloading'}
          </Text>
          <View
            style={styles.progressTrack}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: pct }}
          >
            <View
              style={[
                styles.progressFill,
                { width: `${pct}%`, backgroundColor: accent },
              ]}
            />
          </View>
          <View style={styles.progressMetaRow}>
            <ActivityIndicator color={accent} />
            <Text style={styles.progressPct} maxFontSizeMultiplier={1.4}>{pct}%</Text>
          </View>
          <Button label={Strings.ACTION_CANCEL} variant="secondary" onPress={onCancel} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

function ToolbarButton({
  icon,
  label,
  onPress,
  color,
  accessibilityLabel,
}: {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  label: string;
  onPress: () => void;
  color: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [styles.tbBtn, { opacity: pressed ? 0.7 : 1 }]}
    >
      <IconSymbol name={icon} color={color} size={26} />
      <Text style={[styles.tbLabel, { color }]} maxFontSizeMultiplier={1.4}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  errorTitle: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center' },
  errorBody: { color: 'rgba(255,255,255,0.85)', textAlign: 'center' },
  loadingText: { color: 'rgba(255,255,255,0.75)', fontSize: FontSize.xs, marginTop: Spacing.md },
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topTitle: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },
  chromeWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  tbBtn: { alignItems: 'center', padding: Spacing.sm, minWidth: 72, minHeight: 56 },
  tbLabel: { fontSize: 11, marginTop: 4 },
  tagPanel: {
    maxHeight: 360,
    backgroundColor: 'rgba(0,0,0,0.9)',
  },
  progressBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  progressCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1c1c1e',
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    gap: Spacing.md,
  },
  progressTitle: { color: '#fff', fontWeight: '600', fontSize: FontSize.md },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  progressPct: { color: 'rgba(255,255,255,0.8)', fontSize: FontSize.sm },
});
