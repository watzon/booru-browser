import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Input } from '@/components/ui/input';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useThemeColors } from '@/hooks/use-theme-color';
import { getSource } from '@/sources/registry';
import type { ServerConfig, TagSuggestion } from '@/sources/types';

type Props = {
  server: ServerConfig;
  onTagPicked: (tag: string) => void;
};

export function TagSearchInput({ server, onTagPicked }: Props) {
  const [value, setValue] = useState('');
  const c = useThemeColors();

  const lastSegment = lastTagSegment(value);

  const query = useQuery({
    queryKey: ['autocomplete', server.id, lastSegment],
    enabled: lastSegment.length >= 1,
    queryFn: async ({ signal }) => getSource(server).autocompleteTag(lastSegment, signal),
    staleTime: 60_000,
    retry: 0,
  });

  const suggestions: TagSuggestion[] = query.data ?? [];

  const submit = (tag?: string) => {
    const target = tag ?? value.trim();
    if (!target) return;
    onTagPicked(target);
    setValue('');
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <Input
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => submit()}
        placeholder="Add a tag (e.g. landscape)"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        accessibilityLabel="Tag search"
      />
      {query.isFetching && lastSegment ? (
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={c.textMuted} />
          <Text style={{ color: c.textMuted, fontSize: FontSize.sm }}>Searching tags…</Text>
        </View>
      ) : null}
      {query.isError && lastSegment ? (
        <Text style={[styles.errorText, { color: c.textMuted }]} accessibilityLiveRegion="polite">
          {Strings.SEARCH_AUTOCOMPLETE_ERROR}
        </Text>
      ) : null}
      {suggestions.length > 0 ? (
        <View style={[styles.suggestions, { borderColor: c.border, backgroundColor: c.surface }]}>
          {suggestions.slice(0, 10).map((s, idx) => (
            <Pressable
              key={s.name}
              onPress={() => submit(s.name)}
              accessibilityRole="button"
              accessibilityLabel={
                s.postCount !== undefined
                  ? `${s.name}, ${s.postCount.toLocaleString()} posts`
                  : s.name
              }
              style={({ pressed }) => [
                styles.suggestionRow,
                {
                  borderColor: c.border,
                  borderBottomWidth: idx === suggestions.slice(0, 10).length - 1 ? 0 : StyleSheet.hairlineWidth,
                  backgroundColor: pressed ? c.surfaceMuted : 'transparent',
                },
              ]}
            >
              <Text style={[styles.suggestionText, { color: c.text }]} numberOfLines={1}>
                {s.name}
              </Text>
              {s.postCount !== undefined ? (
                <Text style={[styles.suggestionCount, { color: c.textMuted }]}>
                  {s.postCount.toLocaleString()}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : value.trim().length > 0 && !query.isFetching ? (
        <Pressable
          onPress={() => submit()}
          accessibilityRole="button"
          accessibilityLabel={`Add tag ${value.trim()}`}
          style={({ pressed }) => [
            styles.suggestionRow,
            {
              borderColor: c.border,
              backgroundColor: pressed ? c.surfaceMuted : c.surface,
              borderRadius: Radius.md,
              borderWidth: StyleSheet.hairlineWidth,
            },
          ]}
        >
          <Text style={{ color: c.accent }}>Add &quot;{value.trim()}&quot;</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function lastTagSegment(s: string): string {
  const parts = s.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

const styles = StyleSheet.create({
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  suggestionText: { flex: 1, fontSize: FontSize.md },
  suggestionCount: { fontSize: FontSize.xs, marginLeft: Spacing.sm },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    paddingHorizontal: Spacing.sm,
  },
});
