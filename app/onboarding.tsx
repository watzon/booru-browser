import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/ui/brand-wordmark';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrandMark, Sparkle } from '@/components/ui/sparkle';
import { BrandGradient, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useOnboardingStore } from '@/onboarding/store';
import { useServerStore } from '@/servers/store';
import { useThemeColors, useThemeName } from '@/hooks/use-theme-color';

type Slide = {
  key: string;
  title: string;
  body: string;
  art: 'mark' | 'grid' | 'lock';
};

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    title: Strings.ONBOARDING_WELCOME_TITLE,
    body: Strings.ONBOARDING_WELCOME_BODY,
    art: 'mark',
  },
  {
    key: 'sources',
    title: Strings.ONBOARDING_SOURCES_TITLE,
    body: Strings.ONBOARDING_SOURCES_BODY,
    art: 'grid',
  },
  {
    key: 'private',
    title: Strings.ONBOARDING_PRIVATE_TITLE,
    body: Strings.ONBOARDING_PRIVATE_BODY,
    art: 'lock',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const c = useThemeColors();
  const scheme = useThemeName();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const complete = useOnboardingStore((s) => s.complete);

  const isLast = page === SLIDES.length - 1;

  // Skip / explicit exit into the app.
  const finish = useCallback(() => {
    complete();
    router.replace('/(tabs)');
  }, [complete, router]);

  // The add/import modals are pushed over this screen, so swiping them down
  // returns here. The moment a board actually exists, leave onboarding for good.
  useFocusEffect(
    useCallback(() => {
      if (useServerStore.getState().servers.length > 0) {
        complete();
        router.replace('/(tabs)');
      }
    }, [complete, router]),
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(e.nativeEvent.contentOffset.x / width);
      if (next !== page) setPage(next);
    },
    [page, width],
  );

  const goNext = useCallback(() => {
    const next = Math.min(page + 1, SLIDES.length - 1);
    scrollRef.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }, [page, width]);

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <BrandWordmark size={24} />
          <Pressable
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel={Strings.ONBOARDING_SKIP}
            hitSlop={12}
            style={styles.skip}
          >
            <Text style={[styles.skipText, { color: c.textMuted }]}>{Strings.ONBOARDING_SKIP}</Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {SLIDES.map((slide) => (
            <View key={slide.key} style={[styles.slide, { width }]}>
              <SlideArt art={slide.art} scheme={scheme} />
              <Text style={[styles.title, { color: c.text }]} maxFontSizeMultiplier={1.4}>
                {slide.title}
              </Text>
              <Text style={[styles.body, { color: c.textMuted }]} maxFontSizeMultiplier={1.5}>
                {slide.body}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.dot,
                i === page
                  ? { backgroundColor: c.accent, width: 22 }
                  : { backgroundColor: c.border },
              ]}
            />
          ))}
        </View>

        <View style={styles.footer}>
          {isLast ? (
            <>
              <GradientButton
                label={Strings.ONBOARDING_GET_STARTED}
                scheme={scheme}
                onPress={() => router.push('/server/new')}
              />
              <Pressable
                onPress={() => router.push('/import')}
                accessibilityRole="button"
                accessibilityLabel={Strings.ONBOARDING_IMPORT}
                style={styles.secondary}
              >
                <Text style={[styles.secondaryText, { color: c.accent }]}>
                  {Strings.ONBOARDING_IMPORT}
                </Text>
              </Pressable>
            </>
          ) : (
            <GradientButton label={Strings.ONBOARDING_NEXT} scheme={scheme} onPress={goNext} />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function SlideArt({ art, scheme }: { art: Slide['art']; scheme: 'light' | 'dark' }) {
  if (art === 'mark') {
    return (
      <View style={styles.art}>
        <BrandMark size={132} />
      </View>
    );
  }
  const icon = art === 'grid' ? 'square.grid.2x2' : 'lock.fill';
  return (
    <View style={styles.art}>
      <LinearGradient
        colors={BrandGradient[scheme]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.disc}
      >
        <IconSymbol name={icon} color="#FFFFFF" size={54} />
      </LinearGradient>
      <Sparkle size={26} style={styles.discSparkleTop} />
      <Sparkle size={16} style={styles.discSparkleBottom} />
    </View>
  );
}

function GradientButton({
  label,
  onPress,
  scheme,
}: {
  label: string;
  onPress: () => void;
  scheme: 'light' | 'dark';
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [{ width: '100%', opacity: pressed ? 0.9 : 1 }]}
    >
      <LinearGradient
        colors={BrandGradient[scheme]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cta}
      >
        <Text style={styles.ctaText} maxFontSizeMultiplier={1.4}>
          {label}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    minHeight: 44,
  },
  skip: { minWidth: 48, alignItems: 'flex-end', paddingVertical: Spacing.sm },
  skipText: { fontSize: FontSize.md, fontWeight: '600' },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  art: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  disc: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C4DFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  discSparkleTop: { position: 'absolute', top: 6, right: 14 },
  discSparkleBottom: { position: 'absolute', bottom: 14, left: 10 },
  title: {
    fontFamily: Fonts.display,
    fontSize: FontSize.xxxl,
    textAlign: 'center',
    lineHeight: FontSize.xxxl * 1.08,
  },
  body: {
    fontSize: FontSize.md,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 340,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  dot: { height: 8, width: 8, borderRadius: 4 },
  footer: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  cta: {
    minHeight: 54,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  ctaText: {
    color: '#FFFFFF',
    fontFamily: Fonts.displaySemibold,
    fontSize: FontSize.lg,
  },
  secondary: { paddingVertical: Spacing.md, alignItems: 'center' },
  secondaryText: { fontSize: FontSize.md, fontWeight: '600' },
});
