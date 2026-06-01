import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TagSearchInput } from '@/components/tag-search-input';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { confirm, prompt as iosPrompt } from '@/components/ui/confirm-dialog';
import { useToast } from '@/components/ui/toast';
import { FontSize, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import {
  recentTagKey,
  useSearchHistoryStore,
  type RecentTag,
  type SavedSearch,
} from '@/hooks/use-search-history';
import { useSearchStore } from '@/hooks/use-search-store';
import { useThemeColors } from '@/hooks/use-theme-color';
import { useActiveServer } from '@/servers/store';

export default function SearchScreen() {
  const router = useRouter();
  const server = useActiveServer();
  const c = useThemeColors();
  const toast = useToast();

  const tags = useSearchStore((s) => s.tags);
  const setTags = useSearchStore((s) => s.setTags);
  const addTag = useSearchStore((s) => s.addTag);
  const removeTag = useSearchStore((s) => s.removeTag);
  const clearTags = useSearchStore((s) => s.clear);

  const recents = useSearchHistoryStore((s) => s.recents);
  const saved = useSearchHistoryStore((s) => s.saved);
  const removeRecent = useSearchHistoryStore((s) => s.removeRecent);
  const clearRecents = useSearchHistoryStore((s) => s.clearRecents);
  const saveSearch = useSearchHistoryStore((s) => s.saveSearch);
  const deleteSaved = useSearchHistoryStore((s) => s.deleteSaved);

  const [savePromptVisible, setSavePromptVisible] = useState(false);
  const [pendingName, setPendingName] = useState('');

  if (!server) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: c.text }}>No active server</Text>
      </SafeAreaView>
    );
  }

  const serverRecents = recents
    .filter((r) => r.serverId === server.id && !tags.includes(r.tag))
    .slice(0, 12);
  const serverSaved = saved.filter((s) => !s.serverId || s.serverId === server.id);

  // Recent tags compose into the current search rather than replacing it.
  const applyRecentTag = (tag: string) => addTag(tag);

  const applySaved = (s: SavedSearch) => {
    setTags(s.tags);
    toast.success(`Applied: ${s.name}`);
    router.back();
  };

  const handleSaveCurrent = async () => {
    if (tags.length === 0) {
      toast.warning('Add at least one tag first');
      return;
    }
    // iOS gets the native Alert.prompt; Android falls back to inline modal.
    if (Platform.OS === 'ios') {
      const name = await iosPrompt(Strings.SEARCH_SAVE_PROMPT, undefined, tags.join(' '));
      if (name === null) return;
      const entry = saveSearch({ name, tags, serverId: server.id });
      toast.success(`Saved "${entry.name}"`);
    } else {
      setPendingName(tags.join(' '));
      setSavePromptVisible(true);
    }
  };

  const handleRemoveRecent = async (r: RecentTag) => {
    const ok = await confirm({
      title: 'Remove recent?',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (ok) removeRecent(recentTagKey(r));
  };

  const handleDeleteSaved = async (s: SavedSearch) => {
    const ok = await confirm({
      title: `Delete "${s.name}"?`,
      confirmLabel: Strings.ACTION_DELETE,
      destructive: true,
    });
    if (ok) deleteSaved(s.id);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen
        options={{
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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text
              style={[styles.label, { color: c.textMuted }]}
              accessibilityRole="header"
              maxFontSizeMultiplier={1.4}
            >
              SEARCH ON {server.name.toUpperCase()}
            </Text>
            {tags.length > 0 ? (
              <View style={styles.chipsWrap}>
                {tags.map((tag) => (
                  <Chip key={tag} label={tag} mode="removable" onRemove={() => removeTag(tag)} />
                ))}
                <Button label="Clear" variant="ghost" size="sm" onPress={clearTags} />
                <Button
                  label={Strings.SEARCH_SAVE_ACTION}
                  variant="secondary"
                  size="sm"
                  onPress={handleSaveCurrent}
                />
              </View>
            ) : (
              <Text style={[styles.helper, { color: c.textMuted }]} maxFontSizeMultiplier={1.6}>
                {Strings.SEARCH_EMPTY_BODY}
              </Text>
            )}
          </View>

          <TagSearchInput
            server={server}
            onTagPicked={(tag) => addTag(tag)}
          />

          {serverSaved.length > 0 ? (
            <View>
              <Text
                style={[styles.label, { color: c.textMuted }]}
                accessibilityRole="header"
                maxFontSizeMultiplier={1.4}
              >
                {Strings.SEARCH_SAVED_TITLE.toUpperCase()}
              </Text>
              <View style={styles.chipsWrap}>
                {serverSaved.map((s) => (
                  <Chip
                    key={s.id}
                    label={s.name}
                    mode="selectable"
                    onPress={() => applySaved(s)}
                    onLongPress={() => handleDeleteSaved(s)}
                    accessibilityHint="Long-press to delete"
                  />
                ))}
              </View>
            </View>
          ) : null}

          {serverRecents.length > 0 ? (
            <View>
              <View style={styles.sectionHeader}>
                <Text
                  style={[styles.label, { color: c.textMuted }]}
                  accessibilityRole="header"
                  maxFontSizeMultiplier={1.4}
                >
                  {Strings.SEARCH_RECENTS_TITLE.toUpperCase()}
                </Text>
                <Button label="Clear" variant="ghost" size="sm" onPress={clearRecents} />
              </View>
              <View style={styles.chipsWrap}>
                {serverRecents.map((r) => (
                  <Chip
                    key={recentTagKey(r)}
                    label={r.tag}
                    mode="selectable"
                    onPress={() => applyRecentTag(r.tag)}
                    onLongPress={() => handleRemoveRecent(r)}
                    accessibilityHint="Long-press to remove"
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <AndroidSavePrompt
        visible={savePromptVisible}
        defaultValue={pendingName}
        onCancel={() => setSavePromptVisible(false)}
        onConfirm={(name) => {
          const entry = saveSearch({ name, tags, serverId: server.id });
          setSavePromptVisible(false);
          toast.success(`Saved "${entry.name}"`);
        }}
      />
    </SafeAreaView>
  );
}

function AndroidSavePrompt({
  visible,
  defaultValue,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  defaultValue: string;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  // Lightweight Android fallback. iOS uses Alert.prompt natively.
  // We use Alert.alert for the title only and rely on the user re-running with
  // the default name preserved — keeping the implementation minimal until we
  // need a real text-input modal.
  if (!visible) return null;
  Alert.alert(
    Strings.SEARCH_SAVE_PROMPT,
    `Will be saved as: "${defaultValue}"`,
    [
      { text: Strings.ACTION_CANCEL, style: 'cancel', onPress: onCancel },
      { text: Strings.ACTION_SAVE, onPress: () => onConfirm(defaultValue) },
    ],
  );
  return null;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: FontSize.xs, letterSpacing: 0.5, fontWeight: '600' },
  helper: { fontSize: FontSize.sm, marginTop: 6 },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
