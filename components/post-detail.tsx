import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { type ReactNode, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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

import { isVideo, PostViewer } from '@/components/post-viewer';
import { TagPanel } from '@/components/tag-panel';
import { Button } from '@/components/ui/button';
import { GlassSurface } from '@/components/ui/glass-surface';
import { IconButton } from '@/components/ui/icon-button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useToast } from '@/components/ui/toast';
import { Colors, FontSize, Radius, Shadows, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import {
  saveLocalUriToPhotos,
  shareLink,
  shareLocalUri,
  startDownload,
  type DownloadController,
} from '@/downloads/save';
import { useFavoritesStore } from '@/favorites/store';
import { shouldHidePost } from '@/gate/ratingFilter';
import { useGateStore } from '@/gate/store';
import { BAR_MAX_WIDTH, useResponsive } from '@/hooks/use-responsive';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useSearchStore } from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useActiveServer, useServerStore } from '@/servers/store';
import { imageHeaders } from '@/sources/headers';
import { VerificationRequired } from '@/sources/http';
import { getSource } from '@/sources/registry';

type Props = {
  postId: string;
  serverId?: string;
  /** Shown as a back button when provided (full-screen route). Omitted in the
   *  iPad detail pane, where the grid is always alongside. */
  onBack?: () => void;
  /** True when rendered inside the split-view pane (vs the full-screen route). */
  embedded?: boolean;
  /** Embedded only: invoked when a zoom gesture asks to escalate to full screen.
   *  The parent presents the full-screen viewer; in-place zoom stays disabled in
   *  the cramped pane. */
  onRequestFullscreen?: () => void;
};

export function PostDetail({
  postId,
  serverId,
  onBack,
  embedded = false,
  onRequestFullscreen,
}: Props) {
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();
  const { isLarge } = useResponsive();

  const activeServer = useActiveServer();
  const servers = useServerStore((s) => s.servers);
  const gateUnlocked = useGateStore((s) => s.unlocked);
  const ratingFilter = useSearchStore((s) => s.ratingFilter);
  const server = serverId ? (servers.find((s) => s.id === serverId) ?? activeServer) : activeServer;

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
  const reduce = useReduceMotion();
  // Disable swipe-to-dismiss while the image is zoomed so panning the zoomed
  // image doesn't dismiss the page.
  const [imageZoomed, setImageZoomed] = useState(false);

  // Wraps a screen state in the left→right swipe-to-dismiss gesture (when a
  // back action exists and the image isn't zoomed). Applied to every state so
  // the user is never stranded without the back button.
  const renderSwipe = (node: ReactNode) => (
    <SwipeToDismiss enabled={!!onBack && !imageZoomed} onDismiss={onBack} reduce={reduce}>
      {node}
    </SwipeToDismiss>
  );

  // Include gate state and rating filter in the key so the cached post is
  // re-evaluated if the user unlocks the gate or changes filters mid-session.
  const query = useQuery({
    queryKey: ['post', server?.id, postId, gateUnlocked, ratingFilter],
    enabled: !!server && !!postId,
    queryFn: async ({ signal }) => {
      if (!server) throw new Error('No server selected');
      return getSource(server).getPost(postId, signal);
    },
  });

  const post = query.data;

  if (!server) {
    return renderSwipe(
      <View style={styles.center}>
        <Text style={{ color: c.text }}>No server selected</Text>
      </View>,
    );
  }

  if (query.isError) {
    if (query.error instanceof VerificationRequired) {
      const failingUrl = query.error.url;
      return renderSwipe(
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
        </View>,
      );
    }
    return renderSwipe(
      <View style={styles.center}>
        <Text style={styles.errorBody} maxFontSizeMultiplier={1.4}>
          {Strings.ERROR_GENERIC_TITLE}: {(query.error as Error).message}
        </Text>
        <Button label={Strings.ACTION_RETRY} variant="secondary" onPress={() => query.refetch()} />
      </View>,
    );
  }

  if (!post) {
    return renderSwipe(
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Loading post">
        <ActivityIndicator color="#fff" />
        <Text style={styles.loadingText} maxFontSizeMultiplier={1.4}>
          {query.fetchStatus === 'idle' ? 'Waiting…' : 'Fetching…'}
        </Text>
      </View>,
    );
  }

  // Enforce the SFW gate on the detail screen too. Search results are already
  // filtered (hooks/use-post-search.ts), but a post can be reached directly via
  // deep link, a favorite saved while unlocked, or getPost — none of which pass
  // through applyRatingFilter. Refuse to render the media when the gate is
  // locked and the post isn't safe, instead of leaking explicit content.
  if (shouldHidePost(post.rating, gateUnlocked)) {
    return renderSwipe(
      <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
        {!embedded ? (
          <View
            pointerEvents="box-none"
            style={[styles.topChrome, { paddingTop: insets.top + 4 }]}
          >
            {onBack ? (
              <IconButton accessibilityLabel="Back" onPress={onBack} size={44}>
                <IconSymbol name="chevron.left" color="#fff" size={28} />
              </IconButton>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>
        ) : null}
        <View style={styles.center}>
          <IconSymbol name="lock.fill" color="rgba(255,255,255,0.6)" size={44} />
          <Text style={styles.errorTitle} maxFontSizeMultiplier={1.4}>
            Mature content hidden
          </Text>
          <Text style={styles.errorBody} maxFontSizeMultiplier={1.4}>
            This post is outside your current content settings. Enable mature content in Settings to
            view it.
          </Text>
        </View>
      </View>,
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

  return renderSwipe(
    <View style={{ flex: 1, backgroundColor: Colors.dark.background }}>
      <PostViewer
        post={post}
        headers={imageHeaders(server.baseUrl)}
        chromeVisible={chromeVisible}
        onTap={() => setChromeVisible((v) => !v)}
        // In the split pane, a zoom gesture escalates to the full-screen viewer
        // (where pinch/pan zoom properly) instead of zooming inside the column.
        onZoom={embedded ? onRequestFullscreen : undefined}
        onZoomChange={setImageZoomed}
      />

      {/* The top bar carries the back button + id. In the split pane there's no
          back (the grid is alongside), so skip it rather than show an empty bar. */}
      {chromeVisible && !embedded ? (
        <View
          pointerEvents="box-none"
          style={[styles.topChrome, { paddingTop: insets.top + 4 }]}
        >
          {onBack ? (
            <IconButton accessibilityLabel="Back" onPress={onBack} size={44}>
              <IconSymbol name="chevron.left" color="#fff" size={28} />
            </IconButton>
          ) : (
            <View style={{ width: 44 }} />
          )}
          <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="none">
            <Text style={styles.topTitle} numberOfLines={1} maxFontSizeMultiplier={1.4}>
              #{post.id}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      ) : null}

      {chromeVisible ? (
        <View
          style={[styles.bottomChrome, embedded ? styles.bottomChromeEmbedded : null]}
          pointerEvents="box-none"
        >
          {showTags ? (
            <View style={styles.tagPanel}>
              <TagPanel
                post={post}
                onTagPress={(tag) => {
                  setTags([tag]);
                  if (!embedded) router.dismissTo('/(tabs)');
                  else setShowTags(false);
                }}
              />
            </View>
          ) : null}
          {/* Centered, themed liquid-glass pill — mirrors the bottom nav bar. */}
          <View
            style={[
              styles.barContainer,
              { paddingBottom: embedded ? Spacing.sm : Math.max(insets.bottom, Spacing.sm) + Spacing.sm },
            ]}
            pointerEvents="box-none"
          >
            <GlassSurface
              radius={32}
              fallbackColor={c.surface}
              style={[
                styles.pill,
                Shadows.lg,
                { borderColor: c.border },
                isLarge ? { maxWidth: BAR_MAX_WIDTH } : null,
              ]}
            >
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
            </GlassSurface>
          </View>
        </View>
      ) : null}

      <DownloadProgressModal
        state={downloadState}
        accent={c.accent}
        onCancel={cancelDownload}
      />
    </View>,
  );
}

// Left→right swipe-to-dismiss. The whole page tracks the finger and fades; past
// ~a third of the screen (or a quick flick) it commits and calls onDismiss,
// otherwise it springs back. Rightward-only and bails on vertical drags so it
// stays out of the way of taps and the video scrubber.
function SwipeToDismiss({
  enabled,
  onDismiss,
  reduce,
  children,
}: {
  enabled: boolean;
  onDismiss?: () => void;
  reduce: boolean;
  children: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const dragX = useSharedValue(0);
  const committed = useSharedValue(false);
  const dur = reduce ? 0 : 220;

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled && !!onDismiss)
        .activeOffsetX([24, Number.MAX_SAFE_INTEGER]) // rightward only
        .failOffsetY([-24, 24]) // bail on vertical drags
        .onUpdate((e) => {
          dragX.value = Math.max(0, e.translationX);
        })
        .onEnd((e) => {
          const dismiss = e.translationX > width * 0.32 || e.velocityX > 850;
          if (dismiss && onDismiss && !committed.value) {
            committed.value = true;
            dragX.value = withTiming(width, { duration: dur });
            runOnJS(onDismiss)();
          } else {
            dragX.value = withTiming(0, { duration: dur });
          }
        }),
    [enabled, onDismiss, width, dur, dragX, committed],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }],
    opacity: 1 - Math.min(dragX.value / width, 1) * 0.35,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.swipeFill, style]}>{children}</Animated.View>
    </GestureDetector>
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
  swipeFill: { flex: 1 },
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
  bottomChrome: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  // In the iPad split pane, sit above the centered floating nav bar.
  bottomChromeEmbedded: {
    bottom: 88,
  },
  barContainer: {
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  pill: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tbBtn: { alignItems: 'center', padding: Spacing.sm, minWidth: 64, minHeight: 56 },
  tbLabel: { fontSize: 11, marginTop: 4 },
  tagPanel: {
    maxHeight: 360,
    backgroundColor: 'rgba(0,0,0,0.9)',
    marginBottom: Spacing.sm,
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
