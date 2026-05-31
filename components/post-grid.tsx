import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ViewToken,
  useWindowDimensions,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { isVideo } from '@/components/post-viewer';
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
}: Props) {
  const { width } = useWindowDimensions();
  const columns =
    layout === 'card' ? 1 : (numColumns ?? (width > 700 ? 4 : width > 480 ? 3 : 2));
  const cellSize = Math.floor(width / columns);
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

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      if (!enabledRef.current) {
        setAutoplayIds((prev) => (prev.size === 0 ? prev : EMPTY_SET));
        return;
      }
      const next = new Set<string>();
      for (const v of viewableItems) {
        if (!v.isViewable) continue;
        const post = v.item as Post | undefined;
        if (!post) continue;
        if (!isVideo(post)) continue;
        if (!withinAutoplaySize(post)) continue;
        next.add(post.id);
        if (next.size >= MAX_INLINE_AUTOPLAY) break;
      }
      setAutoplayIds((prev) => (setsEqual(prev, next) ? prev : next));
    },
  ).current;

  const headersFor = useCallback(
    (post: Post) => imageHeadersFor?.(post),
    [imageHeadersFor],
  );

  if (loading && posts.length === 0) {
    return (
      <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Loading posts">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: muted, textAlign: 'center' }} accessibilityRole="text">
          {emptyMessage}
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      // Remount when switching layouts so FlashList recomputes spans/heights
      // and viewability state is fresh.
      key={layout}
      data={data}
      numColumns={columns}
      keyExtractor={(item) => item.id}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      renderItem={({ item }) => {
        const video = isVideo(item);
        if (layout === 'card') {
          const aspect = item.height > 0 && item.width > 0 ? item.width / item.height : 1;
          const cardHeight = Math.min(width / aspect, width * 1.6);
          return (
            <CardCell
              post={item}
              width={width}
              height={cardHeight}
              placeholderBg={placeholderBg}
              isVideo={video}
              autoplay={video && autoplayIds.has(item.id)}
              headers={headersFor(item)}
              onPress={() => handleCellPress(item)}
              label={postLabel(item)}
            />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  cell: { flex: 1, margin: 1, overflow: 'hidden' },
  cardCell: { flex: 1, marginBottom: 8, overflow: 'hidden', backgroundColor: '#000' },
  // Bottom space so the floating nav button doesn't cover the last row.
  footer: { padding: 16, paddingBottom: 100, alignItems: 'center' },
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
