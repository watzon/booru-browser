import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { TagPill } from '@/components/tag-pill';
import { FontSize, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/use-theme-color';
import type { Post, TagCategory } from '@/sources/types';

const CATEGORY_LABEL: Record<TagCategory, string> = {
  artist: 'Artist',
  character: 'Character',
  copyright: 'Copyright',
  species: 'Species',
  general: 'General',
  meta: 'Meta',
  lore: 'Lore',
  unknown: 'Tags',
};

const CATEGORY_ORDER: TagCategory[] = [
  'artist',
  'character',
  'copyright',
  'species',
  'general',
  'meta',
  'lore',
  'unknown',
];

type Group = { category: TagCategory; tags: string[] };

function groupTags(post: Post): Group[] {
  const groups = new Map<TagCategory, Set<string>>();
  if (post.tagsByCategory) {
    for (const [cat, tags] of Object.entries(post.tagsByCategory)) {
      if (!tags) continue;
      const set = groups.get(cat as TagCategory) ?? new Set<string>();
      tags.forEach((t) => set.add(t));
      groups.set(cat as TagCategory, set);
    }
  }
  const categorized = new Set<string>();
  for (const set of groups.values()) for (const t of set) categorized.add(t);
  const leftover = post.tags.filter((t) => !categorized.has(t));
  if (leftover.length > 0) {
    const bucket: TagCategory = groups.size === 0 ? 'unknown' : 'general';
    const set = groups.get(bucket) ?? new Set<string>();
    leftover.forEach((t) => set.add(t));
    groups.set(bucket, set);
  }
  return CATEGORY_ORDER.map((cat) => ({
    category: cat,
    tags: Array.from(groups.get(cat) ?? new Set<string>()).sort(),
  })).filter((g) => g.tags.length > 0);
}

type Props = {
  post: Post;
  onTagPress: (tag: string) => void;
};

export function TagPanel({ post, onTagPress }: Props) {
  const c = useThemeColors();
  const groups = groupTags(post);
  const metaColor = 'rgba(255,255,255,0.7)';
  const groupHeaderColor = 'rgba(255,255,255,0.85)';
  const groupCountColor = 'rgba(255,255,255,0.45)';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={[styles.meta, { color: metaColor }]} accessibilityRole="text">
        {post.width}×{post.height} · rating: {post.rating}
        {post.score !== undefined ? ` · score ${post.score}` : ''}
        {post.fileExt ? ` · ${post.fileExt}` : ''}
      </Text>
      {groups.map(({ category, tags }) => (
        <View key={category} style={styles.group}>
          <Text style={[styles.groupHeader, { color: groupHeaderColor }]}>
            {CATEGORY_LABEL[category]}{' '}
            <Text style={[styles.groupCount, { color: groupCountColor }]}>· {tags.length}</Text>
          </Text>
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <TagPill key={tag} tag={tag} category={category} onPress={() => onTagPress(tag)} />
            ))}
          </View>
        </View>
      ))}
      {groups.length === 0 ? (
        <Text style={{ color: c.textMuted }}>No tags on this post.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  meta: { fontSize: FontSize.xs },
  group: { gap: 6 },
  groupHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  groupCount: { fontWeight: '500' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
