import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { PULL_REFRESH_GAP, PULL_THRESHOLD, PullRefresh } from '@/components/ui/pull-refresh';
import { isVideo } from '@/components/post-viewer';
import { CARD_MAX_WIDTH, gridColumns } from '@/hooks/use-responsive';
import type { Post } from '@/sources/types';
import type { GalleryLayout } from '@/hooks/use-search-store';
import { useThemeColor, useThemeColors } from '@/hooks/use-theme-color';

// Cap on concurrent inline players. Card layout shows one post per row so this
// realistically only matters on tall screens / fast scrolls.
const MAX_INLINE_AUTOPLAY = 2;

// Skip autoplay (still shows the still + badge) when the source's known size
// is over this threshold. Sites that don't expose size autoplay regardless.
const AUTOPLAY_MAX_BYTES = 25 * 1024 * 1024;

type Props = {
  posts: Post[];
  loading?: boolean;
  loadingMore?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onPostPress: (post: Post) => void;
  emptyMessage?: string;
  numColumns?: number;
  layout?: GalleryLayout;
  imageHeadersFor?: (post: Post) => Record<string, string>;
  /** Fired (debounced) once scrolling settles, with the visible posts ordered
   *  center-outward — use it to warm caches for likely-tapped posts. */
  onSettled?: (posts: Post[]) => void;
  /** Top padding so content scrolls *under* a floating/overlaid header but its
   *  first row (and the pull-to-refresh spinner) start below it. */
  contentInsetTop?: number;
};

export function PostGrid({
  posts,
  loading,
  loadingMore,
  refreshing,
  onRefresh,
  onEndReached,
  onPostPress,
  emptyMessage = 'No posts',
  numColumns,
  layout = 'grid',
  imageHeadersFor,
  onSettled,
  contentInsetTop = 0,
}: Props) {
  // Measure the actual available width (not the window) so the grid sizes
  // correctly inside an iPad split-view pane, not just full-screen.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const width = measuredWidth || windowWidth;
  const onContainerLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setMeasuredWidth((prev) => (prev === w ? prev : w));
  }, []);

  const columns = layout === 'card' ? 1 : (numColumns ?? gridColumns(width));
  const cellSize = Math.floor(width / columns);
  const masonry = layout === 'masonry';
  // Masonry tiles fill their column width; height follows the post's real aspect
  // ratio (clamped so extreme panoramas/strips stay tappable).
  const masonryColWidth = Math.floor(width / columns);
  // Card layout caps width on large screens so a single post isn't enormous.
  const cardWidth = Math.min(width, CARD_MAX_WIDTH);
  const placeholderBg = useThemeColor({}, 'icon');
  const muted = useThemeColor({}, 'icon');
  const colors = useThemeColors();

  const handleCellPress = useCallback(
    (post: Post) => {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      onPostPress(post);
    },
    [onPostPress],
  );

  // Custom pull-to-refresh (iOS only — it rides the rubber-band overscroll that
  // Android lists don't have). The live overscroll feeds the themed indicator;
  // releasing past the threshold arms a refresh. Android keeps a themed native
  // RefreshControl. `refreshing` is read through a ref so the scroll handlers
  // stay stable.
  const customPull = Platform.OS === 'ios' && !!onRefresh;
  const pull = useSharedValue(0);
  const refreshingRef = useRef(!!refreshing);
  refreshingRef.current = !!refreshing;
  const armedRef = useRef(false);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      pull.value = y < 0 ? -y : 0;
    },
    [pull],
  );

  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const over = -e.nativeEvent.contentOffset.y;
      if (over >= PULL_THRESHOLD && !refreshingRef.current && !armedRef.current) {
        armedRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        onRefresh?.();
      }
    },
    [onRefresh],
  );

  // Re-arm only once the previous refresh has finished.
  useEffect(() => {
    if (!refreshing) armedRef.current = false;
  }, [refreshing]);

  // While refreshing, hold an extra gap open below the header so the spinning
  // indicator has somewhere to live.
  const padTop = contentInsetTop + (customPull && refreshing ? PULL_REFRESH_GAP : 0);

  const postLabel = useCallback((p: Post) => {
    const artist = p.tagsByCategory?.artist?.[0];
    const prefix = artist ? `Post by ${artist}` : `Post ${p.id}`;
    return `${prefix}, rating ${p.rating}, ${p.tags.length} tags`;
  }, []);

  const data = useMemo(() => posts, [posts]);

  // Track which post IDs should currently be autoplaying. Updated from
  // FlashList's viewability callback. Capped at MAX_INLINE_AUTOPLAY; non-video
  // and oversized-video posts are never added.
  const [autoplayIds, setAutoplayIds] = useState<ReadonlySet<string>>(EMPTY_SET);

  // Stable refs — FlashList does not support changing viewability config on
  // the fly, and re-binding the callback would reset internal state.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 80,
  }).current;

  const enabled = layout === 'card';
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Latest onSettled + the posts currently on screen, read by the stable
  // viewability callback. A debounce timer fires onSettled only once scrolling
  // has actually stopped (viewability stops changing) — never mid-scroll.
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;
  const visiblePostsRef = useRef<Post[]>([]);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      const visible: Post[] = [];
      for (const v of viewableItems) {
        if (!v.isViewable) continue;
        const post = v.item as Post | undefined;
        if (post) visible.push(post);
      }
      visiblePostsRef.current = visible;

      // Debounced "scrolling settled" → warm caches center-outward.
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        const cb = onSettledRef.current;
        if (cb && visiblePostsRef.current.length > 0) cb(centerOut(visiblePostsRef.current));
      }, 350);

      // Inline autoplay (card layout only).
      if (!enabledRef.current) {
        setAutoplayIds((prev) => (prev.size === 0 ? prev : EMPTY_SET));
        return;
      }
      const next = new Set<string>();
      for (const post of visible) {
        if (!isVideo(post)) continue;
        if (!withinAutoplaySize(post)) continue;
        next.add(post.id);
        if (next.size >= MAX_INLINE_AUTOPLAY) break;
      }
      setAutoplayIds((prev) => (setsEqual(prev, next) ? prev : next));
    },
  ).current;

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const headersFor = useCallback(
    (post: Post) => imageHeadersFor?.(post),
    [imageHeadersFor],
  );

  if (loading && posts.length === 0) {
    return (
      <View
        style={[styles.center, { paddingTop: 32 + contentInsetTop }]}
        onLayout={onContainerLayout}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading posts"
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <View
        style={[styles.center, { paddingTop: 32 + contentInsetTop }]}
        onLayout={onContainerLayout}
      >
        <Text style={{ color: muted, textAlign: 'center' }} accessibilityRole="text">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.fill} onLayout={onContainerLayout}>
    <FlashList
      // Remount when layout OR column count changes so FlashList recomputes
      // spans/heights (e.g. when an iPad split pane resizes) and viewability
      // state is fresh.
      key={`${layout}-${columns}`}
      data={data}
      numColumns={columns}
      masonry={masonry}
      optimizeItemArrangement={masonry}
      keyExtractor={(item) => item.id}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      contentContainerStyle={padTop ? { paddingTop: padTop } : undefined}
      onScroll={customPull ? onScroll : undefined}
      onScrollEndDrag={customPull ? onScrollEndDrag : undefined}
      scrollEventThrottle={customPull ? 16 : undefined}
      refreshControl={
        onRefresh && !customPull ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            progressViewOffset={contentInsetTop}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
      renderItem={({ item }) => {
        const video = isVideo(item);
        if (masonry) {
          const aspect = item.width > 0 && item.height > 0 ? item.width / item.height : 1;
          const raw = Math.round(masonryColWidth / aspect);
          const tileHeight = Math.max(
            Math.round(masonryColWidth * 0.66),
            Math.min(raw, Math.round(masonryColWidth * 2.2)),
          );
          return (
            <MasonryCell
              post={item}
              height={tileHeight}
              placeholderBg={placeholderBg}
              isVideo={video}
              headers={headersFor(item)}
              onPress={() => handleCellPress(item)}
              label={postLabel(item)}
            />
          );
        }
        if (layout === 'card') {
          const aspect = item.height > 0 && item.width > 0 ? item.width / item.height : 1;
          const cardHeight = Math.min(cardWidth / aspect, cardWidth * 1.6);
          // Center the (capped-width) card within the full available width.
          return (
            <View style={{ width, alignItems: 'center' }}>
              <CardCell
                post={item}
                width={cardWidth}
                height={cardHeight}
                placeholderBg={placeholderBg}
                isVideo={video}
                autoplay={video && autoplayIds.has(item.id)}
                headers={headersFor(item)}
                onPress={() => handleCellPress(item)}
                label={postLabel(item)}
              />
            </View>
          );
        }
        return (
          <Pressable
            onPress={() => handleCellPress(item)}
            accessibilityRole="imagebutton"
            accessibilityLabel={postLabel(item)}
            accessibilityHint="Opens the post"
            style={{ width: cellSize, height: cellSize }}
          >
            <View style={[styles.cell, { backgroundColor: placeholderBg + '22' }]}>
              <Image
                source={{
                  uri: item.previewUrl,
                  headers: headersFor(item),
                }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={150}
                recyclingKey={item.id}
              />
              {video ? <VideoBadge /> : null}
            </View>
          </Pressable>
        );
      }}
      ListFooterComponent={
        <View style={styles.footer}>
          {loadingMore ? (
            <ActivityIndicator
              color={colors.accent}
              accessibilityLabel="Loading more posts"
            />
          ) : null}
        </View>
      }
    />
      {customPull ? (
        <PullRefresh pull={pull} refreshing={!!refreshing} top={contentInsetTop} />
      ) : null}
    </View>
  );
}

type CardCellProps = {
  post: Post;
  width: number;
  height: number;
  placeholderBg: string;
  isVideo: boolean;
  autoplay: boolean;
  headers?: Record<string, string>;
  onPress: () => void;
  label: string;
};

function CardCell({
  post,
  width,
  height,
  placeholderBg,
  isVideo,
  autoplay,
  headers,
  onPress,
  label,
}: CardCellProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityHint="Opens the post"
      style={{ width, height }}
    >
      <View style={[styles.cardCell, { backgroundColor: placeholderBg + '22' }]}>
        {isVideo ? (
          autoplay ? (
            <InlineVideoPlayer post={post} headers={headers} />
          ) : (
            <VideoStill post={post} headers={headers} />
          )
        ) : (
          <Image
            source={{ uri: post.sampleUrl || post.previewUrl, headers }}
            placeholder={post.previewUrl ? { uri: post.previewUrl } : undefined}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={150}
            recyclingKey={post.id}
          />
        )}
        {isVideo ? <VideoBadge /> : null}
      </View>
    </Pressable>
  );
}

type MasonryCellProps = {
  post: Post;
  height: number;
  placeholderBg: string;
  isVideo: boolean;
  headers?: Record<string, string>;
  onPress: () => void;
  label: string;
};

function MasonryCell({
  post,
  height,
  placeholderBg,
  isVideo,
  headers,
  onPress,
  label,
}: MasonryCellProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={label}
      accessibilityHint="Opens the post"
      style={{ height }}
    >
      <View style={[styles.masonryCell, { backgroundColor: placeholderBg + '22' }]}>
        <Image
          source={{ uri: post.previewUrl, headers }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={post.id}
        />
        {isVideo ? <VideoBadge /> : null}
      </View>
    </Pressable>
  );
}

function VideoStill({ post, headers }: { post: Post; headers?: Record<string, string> }) {
  // No large still exists for booru videos — preview is the only image. Use
  // cover so the small image fills the cell rather than sitting at native
  // size with letterbox bars.
  return (
    <Image
      source={{ uri: post.previewUrl, headers }}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      transition={150}
      recyclingKey={post.id}
    />
  );
}

function InlineVideoPlayer({
  post,
  headers,
}: {
  post: Post;
  headers?: Record<string, string>;
}) {
  // Prefer the booru's sample variant (smaller, transcoded) over the full
  // file for inline playback. Fall back to full if no sample exists.
  const uri = post.sampleUrl || post.fullUrl;
  const player = useVideoPlayer(
    headers ? { uri, headers } : { uri },
    (p) => {
      p.loop = true;
      p.muted = true;
      p.bufferOptions = {
        waitsToMinimizeStalling: false,
        preferredForwardBufferDuration: 3,
        minBufferForPlayback: 0.5,
      };
      p.play();
    },
  );

  return (
    <>
      {/* Poster underneath so there's something to look at during the brief
          first-frame delay. */}
      <Image
        source={{ uri: post.previewUrl, headers }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={0}
      />
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        allowsFullscreen={false}
      />
    </>
  );
}

function VideoBadge() {
  return (
    <View style={styles.videoBadge} pointerEvents="none">
      <IconSymbol name="video.fill" color="white" size={14} />
    </View>
  );
}

// Reorders [a,b,c,d,e] → [c,b,d,a,e] so the post under the viewport center is
// warmed first, then its neighbours outward.
function centerOut<T>(arr: T[]): T[] {
  const n = arr.length;
  if (n <= 1) return arr.slice();
  const mid = Math.floor((n - 1) / 2);
  const out: T[] = [arr[mid]];
  for (let d = 1; d <= n && out.length < n; d++) {
    if (mid - d >= 0) out.push(arr[mid - d]);
    if (mid + d < n) out.push(arr[mid + d]);
  }
  return out;
}

function withinAutoplaySize(post: Post): boolean {
  const size = post.sampleFileSize ?? post.fileSize;
  if (size == null) return true; // Unknown — assume OK.
  return size <= AUTOPLAY_MAX_BYTES;
}

function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  cell: { flex: 1, margin: 1, overflow: 'hidden' },
  cardCell: { flex: 1, marginBottom: 8, overflow: 'hidden', backgroundColor: '#000' },
  masonryCell: {
    flex: 1,
    margin: 1,
    overflow: 'hidden',
  },
  // Bottom space so the floating nav bar doesn't cover the last row.
  footer: { padding: 16, paddingBottom: 130, alignItems: 'center' },
  videoBadge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
