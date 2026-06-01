import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors, FontSize, Spacing } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import type { Post } from '@/sources/types';

type Props = {
  post: Post;
  onTap?: () => void;
  headers?: Record<string, string>;
  chromeVisible?: boolean;
  /**
   * When provided, a zoom gesture (pinch or double-tap) doesn't zoom the image
   * in place — it fires this callback on release so the caller can escalate to a
   * full-screen view. Used by the iPad split pane, where in-place zoom inside the
   * cramped detail column is more frustrating than useful.
   */
  onZoom?: () => void;
  /** Fired when the image zoom crosses in/out of 1× — lets the parent disable a
   *  swipe-to-dismiss gesture while the image is zoomed (so panning the zoomed
   *  image doesn't dismiss the page). */
  onZoomChange?: (zoomed: boolean) => void;
};

const MAX_SCALE = 5;
const MIN_SCALE = 1;
// Escalating (split-pane) mode: the release scale past which we treat the pinch
// as a deliberate "open full screen" intent rather than an accidental brush.
const ZOOM_INTENT_SCALE = 1.05;
const VIDEO_EXTS = new Set(['mp4', 'webm', 'm4v', 'mov']);

// The viewer is intentionally a dark-mode surface regardless of system theme —
// it's full-bleed media and any light chrome would compete with the content.
// Colors are sourced from the dark token palette so they still flow through
// the design system rather than being magic strings.
const VIEWER_BG = Colors.dark.background;
const ON_DARK = Colors.dark.text;
const ON_DARK_MUTED = 'rgba(255,255,255,0.75)';
const CONTROL_BG = 'rgba(0,0,0,0.55)';
const CONTROL_TRACK = 'rgba(255,255,255,0.3)';

function extOf(url: string): string {
  const m = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  return m ? m[1].toLowerCase() : '';
}

export function isVideo(post: Post): boolean {
  const ext = (post.fileExt ?? extOf(post.fullUrl || post.sampleUrl)).toLowerCase();
  return VIDEO_EXTS.has(ext);
}

function postA11yLabel(post: Post): string {
  const artist = post.tagsByCategory?.artist?.[0];
  const character = post.tagsByCategory?.character?.[0];
  const parts: string[] = [];
  if (artist) parts.push(`by ${artist}`);
  if (character) parts.push(character);
  parts.push(`rating ${post.rating}`);
  parts.push(`${post.tags.length} tags`);
  return parts.join(', ');
}

export function PostViewer(props: Props) {
  if (isVideo(props.post)) {
    return <VideoPostViewer {...props} />;
  }
  return <ImagePostViewer {...props} />;
}

function ImagePostViewer({ post, onTap, headers, onZoom, onZoomChange }: Props) {
  // Size to the actual container, not the window, so the image stays inside its
  // pane in the iPad split layout (window-sized would overflow onto the grid and
  // swallow its taps).
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Mirror of "is the image zoomed in" — gates the in-place pan (so it only
  // claims touches when zoomed) and is reported up to disable swipe-to-dismiss.
  const [zoomed, setZoomed] = useState(false);
  const notifyZoom = useCallback(
    (z: boolean) => {
      setZoomed(z);
      onZoomChange?.(z);
    },
    [onZoomChange],
  );
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((p) => (p.width === width && p.height === height ? p : { width, height }));
  }, []);
  const reduce = useReduceMotion();
  const animDuration = reduce ? 0 : 200;

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Report zoom in/out so the parent can toggle swipe-to-dismiss + the pan gate.
  useAnimatedReaction(
    () => scale.value > 1.01,
    (z, prev) => {
      if (z !== prev) runOnJS(notifyZoom)(z);
    },
  );

  const reset = useCallback(() => {
    scale.value = withTiming(1, { duration: animDuration });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: animDuration });
    translateY.value = withTiming(0, { duration: animDuration });
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [animDuration, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  // Escalation can be signalled more than once for a single interaction (a pinch
  // and its trailing tap, repeated worklet end callbacks). Collapse those into a
  // single navigation so we don't push the full-screen route twice.
  const lastZoomRef = useRef(0);
  const triggerZoom = useCallback(() => {
    if (!onZoom) return;
    const now = Date.now();
    if (now - lastZoomRef.current < 800) return;
    lastZoomRef.current = now;
    onZoom();
  }, [onZoom]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = savedScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE * 0.9, next));
    })
    .onEnd(() => {
      // In escalating mode the pinch zooms normally right up until release; if the
      // user ended zoomed in, hand off to the full-screen view and reset the pane.
      if (onZoom) {
        const zoomedIn = scale.value > ZOOM_INTENT_SCALE;
        scale.value = withTiming(1, { duration: animDuration });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: animDuration });
        translateY.value = withTiming(0, { duration: animDuration });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        if (zoomedIn) runOnJS(triggerZoom)();
        return;
      }
      if (scale.value < 1) {
        scale.value = withTiming(1, { duration: animDuration });
        savedScale.value = 1;
        translateX.value = withTiming(0, { duration: animDuration });
        translateY.value = withTiming(0, { duration: animDuration });
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    // Only claim touches while zoomed in — otherwise it would swallow a parent
    // swipe-to-dismiss. (The scale guard below is a belt-and-suspenders check.)
    .enabled(zoomed)
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (onZoom) {
        runOnJS(triggerZoom)();
        return;
      }
      if (scale.value > 1) {
        runOnJS(reset)();
      } else {
        scale.value = withTiming(2.5, { duration: animDuration });
        savedScale.value = 2.5;
      }
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (onTap) runOnJS(onTap)();
    })
    .requireExternalGestureToFail(doubleTap);

  // Same composition in both modes: the pinch zooms normally during the gesture
  // (pan included, just like the full-screen viewer); escalating mode only differs
  // in what happens on release.
  const composed = Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.container]}
        onLayout={onLayout}
        accessible
        accessibilityRole="image"
        accessibilityLabel={postA11yLabel(post)}
        accessibilityHint={
          onZoom
            ? 'Pinch or double-tap to open full screen, single-tap to toggle controls'
            : 'Pinch to zoom, double-tap to reset, single-tap to toggle controls'
        }
      >
        <Animated.View style={[styles.imageWrap, animatedStyle]}>
          {size.width > 0 ? (
            <Image
              source={{ uri: post.sampleUrl, headers }}
              style={{ width: size.width, height: size.height }}
              contentFit="contain"
              transition={150}
              placeholder={post.previewUrl ? { uri: post.previewUrl, headers } : undefined}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

function VideoPostViewer({ post, headers, onTap, chromeVisible }: Props) {
  // Measure the container (pane) width rather than the window — see ImagePostViewer.
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidth((prev) => (prev === w ? prev : w));
  }, []);

  const player = useVideoPlayer(
    headers
      ? { uri: post.fullUrl || post.sampleUrl, headers }
      : { uri: post.fullUrl || post.sampleUrl },
    (p) => {
      p.loop = true;
      p.muted = true;
      p.timeUpdateEventInterval = 0.25;
      p.bufferOptions = {
        waitsToMinimizeStalling: false,
        preferredForwardBufferDuration: 5,
        minBufferForPlayback: 1,
      };
      p.play();
    },
  );

  const statusPayload = useEvent(player, 'statusChange');
  const status = statusPayload?.status ?? player.status;
  const error = statusPayload?.error;
  const isLoading = status === 'loading' || status === 'idle';
  const isError = status === 'error';

  const playingPayload = useEvent(player, 'playingChange');
  const isPlaying = playingPayload?.isPlaying ?? player.playing;

  const mutedPayload = useEvent(player, 'mutedChange');
  const isMuted = mutedPayload?.muted ?? player.muted;

  const timePayload = useEvent(player, 'timeUpdate');
  const liveTime = timePayload?.currentTime ?? player.currentTime;
  const duration = player.duration;

  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const resumeOnReleaseRef = useRef(false);
  const displayTime = scrubTime ?? liveTime;
  const progress = duration > 0 ? Math.max(0, Math.min(1, displayTime / duration)) : 0;

  const aspect = post.width && post.height ? post.width / post.height : 16 / 9;
  const previewHeight = width / aspect;

  const togglePlay = () => {
    if (isPlaying) player.pause();
    else player.play();
  };
  const toggleMute = () => {
    player.muted = !player.muted;
  };

  const onSeekBegin = () => {
    if (player.playing) {
      resumeOnReleaseRef.current = true;
      player.pause();
    } else {
      resumeOnReleaseRef.current = false;
    }
  };
  const onSeekChange = (p: number) => {
    if (duration > 0) setScrubTime(p * duration);
  };
  const onSeekEnd = (p: number) => {
    if (duration > 0) player.currentTime = p * duration;
    setScrubTime(null);
    if (resumeOnReleaseRef.current) {
      resumeOnReleaseRef.current = false;
      player.play();
    }
  };

  const seekTrackWidth = Math.max(40, width - 32 - 96);

  return (
    <Pressable
      onPress={onTap}
      onLayout={onLayout}
      style={[StyleSheet.absoluteFill, styles.container]}
      accessibilityRole="button"
      accessibilityLabel={`Video, ${postA11yLabel(post)}`}
      accessibilityHint="Single-tap to toggle controls"
    >
      {isLoading && post.previewUrl && width > 0 ? (
        <Image
          source={{ uri: post.previewUrl, headers }}
          style={{
            position: 'absolute',
            top: '50%',
            marginTop: -previewHeight / 2,
            width,
            height: previewHeight,
            opacity: 0.6,
          }}
          contentFit="contain"
          transition={0}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
        allowsFullscreen={false}
      />

      {isError ? (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <Text style={[styles.errorText, { color: ON_DARK_MUTED }]}>
            Couldn&apos;t load video{error ? `: ${String(error)}` : ''}
          </Text>
        </View>
      ) : null}

      {isLoading && chromeVisible && !isError ? (
        <View style={styles.loaderOverlay} pointerEvents="none">
          <ActivityIndicator color={ON_DARK} size="large" />
        </View>
      ) : null}

      {!chromeVisible && !isError ? (
        <View style={styles.videoControlsLayer} pointerEvents="box-none">
          <Pressable
            onPress={toggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
            accessibilityState={{ selected: !isMuted }}
            style={({ pressed }) => [
              styles.videoMuteBtn,
              { backgroundColor: CONTROL_BG, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={10}
          >
            <IconSymbol
              name={isMuted ? 'speaker.slash.fill' : 'speaker.fill'}
              color={ON_DARK}
              size={20}
            />
          </Pressable>

          <Pressable
            onPress={togglePlay}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            accessibilityState={{ disabled: isLoading, busy: isLoading }}
            style={({ pressed }) => [
              styles.videoCenterBtn,
              { backgroundColor: CONTROL_BG, opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={12}
          >
            {isLoading ? (
              <ActivityIndicator color={ON_DARK} size="large" />
            ) : (
              <IconSymbol
                name={isPlaying ? 'pause.fill' : 'play.fill'}
                color={ON_DARK}
                size={42}
              />
            )}
          </Pressable>

          <View style={styles.videoSeekRow} pointerEvents="box-none">
            <Text
              style={[styles.videoTime, { color: ON_DARK }]}
              accessibilityLabel={`Elapsed ${formatTime(displayTime)}`}
              maxFontSizeMultiplier={1.4}
            >
              {formatTime(displayTime)}
            </Text>
            <View style={styles.videoSeekSlider}>
              <ResponderSlider
                progress={progress}
                onBegin={onSeekBegin}
                onChange={onSeekChange}
                onEnd={onSeekEnd}
                width={seekTrackWidth}
                disabled={duration <= 0}
              />
            </View>
            <Text
              style={[styles.videoTime, { color: ON_DARK }]}
              accessibilityLabel={duration > 0 ? `Total ${formatTime(duration)}` : 'Unknown duration'}
              maxFontSizeMultiplier={1.4}
            >
              {duration > 0 ? formatTime(duration) : '--:--'}
            </Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

type ResponderSliderProps = {
  progress: number;
  width: number;
  onChange?: (progress: number) => void;
  onBegin?: () => void;
  onEnd?: (progress: number) => void;
  disabled?: boolean;
};

function ResponderSlider({
  progress,
  width,
  onChange,
  onBegin,
  onEnd,
  disabled,
}: ResponderSliderProps) {
  const [dragX, setDragX] = useState<number | null>(null);
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const fromEvent = (e: GestureResponderEvent) =>
    clamp(e.nativeEvent.locationX / width);

  const display = dragX != null ? clamp(dragX / width) : progress;

  const shouldRespond = () => !disabled;

  return (
    <View
      style={[styles.sliderHit, { width }]}
      accessibilityRole="adjustable"
      accessibilityLabel="Seek"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(display * 100) }}
      onStartShouldSetResponder={shouldRespond}
      onMoveShouldSetResponder={shouldRespond}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const p = fromEvent(e);
        setDragX(e.nativeEvent.locationX);
        onBegin?.();
        onChange?.(p);
      }}
      onResponderMove={(e) => {
        const p = fromEvent(e);
        setDragX(e.nativeEvent.locationX);
        onChange?.(p);
      }}
      onResponderRelease={(e) => {
        const p = fromEvent(e);
        onEnd?.(p);
        setDragX(null);
      }}
      onResponderTerminate={() => setDragX(null)}
    >
      <View style={[styles.sliderTrack, { backgroundColor: CONTROL_TRACK }]} />
      <View style={[styles.sliderFill, { backgroundColor: ON_DARK, width: display * width }]} />
      <View style={[styles.sliderKnob, { backgroundColor: ON_DARK, left: display * width - 7 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: VIEWER_BG, alignItems: 'center', justifyContent: 'center' },
  imageWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loaderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.xxl,
    textAlign: 'center',
  },
  videoControlsLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCenterBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoMuteBtn: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoSeekRow: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  videoSeekSlider: { flex: 1 },
  videoTime: {
    fontSize: FontSize.xs,
    fontVariant: ['tabular-nums'],
    minWidth: 38,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 3,
  },
  sliderHit: {
    height: 36,
    justifyContent: 'center',
  },
  sliderTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 16.5,
    height: 3,
    borderRadius: 1.5,
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 16.5,
    height: 3,
    borderRadius: 1.5,
  },
  sliderKnob: {
    position: 'absolute',
    top: 11,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
