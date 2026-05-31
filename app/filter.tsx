import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useGateStore } from '@/gate/store';
import {
  type RatingFilter,
  type SortOrder,
  useSearchStore,
} from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';

const SORT_OPTIONS: { value: SortOrder; label: string; sub: string }[] = [
  { value: 'newest', label: 'Newest', sub: 'Most recently posted first' },
  { value: 'score', label: 'Top score', sub: 'Highest-scoring posts first' },
  { value: 'random', label: 'Random', sub: 'Shuffled results' },
];

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: 'all', label: 'All ratings' },
  { value: 'safe', label: 'Safe only' },
  { value: 'questionable', label: 'Questionable only' },
  { value: 'explicit', label: 'Explicit only' },
];

export default function FilterScreen() {
  const router = useRouter();
  const c = useThemeColors();

  const order = useSearchStore((s) => s.order);
  const ratingFilter = useSearchStore((s) => s.ratingFilter);
  const setOrder = useSearchStore((s) => s.setOrder);
  const setRatingFilter = useSearchStore((s) => s.setRatingFilter);
  const resetFilters = useSearchStore((s) => s.resetFilters);

  const gateUnlocked = useGateStore((s) => s.unlocked);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerTitle: 'Filter & Sort',
          headerRight: () => (
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Done"
              hitSlop={8}
              style={{ padding: Spacing.sm }}
            >
              <Text style={{ color: c.accent, fontWeight: '600' }}>Done</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.xxl }}>
        <Section title="SORT BY" color={c.textMuted}>
          {SORT_OPTIONS.map((opt) => (
            <FilterRow
              key={opt.value}
              label={opt.label}
              sub={opt.sub}
              selected={order === opt.value}
              onPress={() => setOrder(opt.value)}
            />
          ))}
        </Section>

        <Section title="RATING" color={c.textMuted}>
          {!gateUnlocked ? (
            <Card padding="lg">
              <Text style={[styles.helper, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>
                Mature content is locked. Only safe-rated posts are shown. Unlock in Settings to
                enable other ratings.
              </Text>
            </Card>
          ) : (
            RATING_OPTIONS.map((opt) => (
              <FilterRow
                key={opt.value}
                label={opt.label}
                selected={ratingFilter === opt.value}
                onPress={() => setRatingFilter(opt.value)}
              />
            ))
          )}
        </Section>

        <Button
          label="Reset to defaults"
          variant="secondary"
          fullWidth
          onPress={resetFilters}
        />
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
    <View style={{ gap: Spacing.sm }}>
      <Text
        style={[styles.sectionTitle, { color }]}
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
      >
        {title}
      </Text>
      <View style={{ gap: 4 }}>{children}</View>
    </View>
  );
}

function FilterRow({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? c.surfaceMuted
            : selected
              ? c.surface
              : 'transparent',
          borderColor: selected ? c.accent : c.border,
          minHeight: 44,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{ color: c.text, fontSize: FontSize.md, fontWeight: selected ? '600' : '500' }}
          maxFontSizeMultiplier={1.6}
        >
          {label}
        </Text>
        {sub ? (
          <Text style={{ color: c.textMuted, fontSize: FontSize.xs, marginTop: 2 }} maxFontSizeMultiplier={1.6}>
            {sub}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: selected ? 0 : 1.5,
          borderColor: c.border,
          backgroundColor: selected ? c.accent : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accentText }} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: FontSize.xs, letterSpacing: 0.5, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  helper: { fontSize: FontSize.sm, lineHeight: 20 },
});
