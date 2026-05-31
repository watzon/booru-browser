import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { Strings } from '@/constants/strings';
import { useThemeColors } from '@/hooks/use-theme-color';
import { loadAuth, saveAuth } from '@/servers/credentials';
import { useServerStore } from '@/servers/store';
import { useValidateScratchpad } from '@/servers/validate-scratchpad';
import {
  API_KEY_PATH,
  AUTH_HINT,
  AUTH_LABEL,
  supportedAuthKinds,
} from '@/sources/auth-capabilities';
import { SOURCE_KINDS } from '@/sources/registry';
import type { AuthConfig, AuthKind, ServerConfig, SourceKind } from '@/sources/types';

export type ServerFormProps = {
  initialId?: string;
  onSaved: () => void;
};

export function ServerForm({ initialId, onSaved }: ServerFormProps) {
  const router = useRouter();
  const c = useThemeColors();
  const toast = useToast();

  const servers = useServerStore((s) => s.servers);
  const addServer = useServerStore((s) => s.addServer);
  const queryClient = useQueryClient();

  const existing = initialId ? servers.find((s) => s.id === initialId) ?? null : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? '');
  const [kind, setKind] = useState<SourceKind>(existing?.kind ?? 'danbooru');
  const [authKind, setAuthKind] = useState<AuthKind>('none');
  const [authField1, setAuthField1] = useState('');
  const [authField2, setAuthField2] = useState('');
  const [cookieValue, setCookieValue] = useState('');
  const [useWebViewFetch, setUseWebViewFetch] = useState(
    existing?.useWebViewFetch ?? false,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!existing) return;
    (async () => {
      const a = await loadAuth(existing.id);
      if (!a) return;
      setAuthKind(a.type);
      if (a.type === 'basic') {
        setAuthField1(a.username);
        setAuthField2(a.apiKey);
      } else if (a.type === 'apiKey') {
        setAuthField1(a.header);
        setAuthField2(a.key);
      } else if (a.type === 'queryParams') {
        setAuthField1(
          Object.entries(a.params)
            .map(([k, v]) => `${k}=${v}`)
            .join('&'),
        );
      } else if (a.type === 'cookie') {
        setCookieValue(a.cookie);
      }
    })();
  }, [existing]);

  useFocusEffect(
    useCallback(() => {
      const captured = useValidateScratchpad.getState().consume();
      if (captured !== null && captured.trim().length > 0) {
        setAuthKind('cookie');
        setCookieValue(captured);
        toast.success('Captured cookies applied');
      }
    }, [toast]),
  );

  const allowedAuthKinds = useMemo(() => supportedAuthKinds(kind), [kind]);

  useEffect(() => {
    if (!allowedAuthKinds.includes(authKind)) {
      setAuthKind('none');
    }
  }, [allowedAuthKinds, authKind]);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = baseUrl.trim();
    if (!trimmedName) return Alert.alert('Missing name');
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      return Alert.alert('Invalid URL', 'Base URL must start with https:// or http://');
    }
    const id = existing?.id ?? `srv_${Date.now().toString(36)}`;
    let auth: AuthConfig | undefined;
    if (authKind === 'none') {
      auth = undefined;
    } else if (authKind === 'basic') {
      auth = { type: 'basic', username: authField1.trim(), apiKey: authField2.trim() };
    } else if (authKind === 'apiKey') {
      auth = { type: 'apiKey', header: authField1.trim() || 'X-API-Key', key: authField2.trim() };
    } else if (authKind === 'queryParams') {
      const params = parseQueryParams(authField1);
      if (Object.keys(params).length === 0) {
        return Alert.alert('Missing query params', 'Enter at least one key=value pair.');
      }
      auth = { type: 'queryParams', params };
    } else if (authKind === 'cookie') {
      const trimmed = cookieValue.trim();
      if (!trimmed) {
        return Alert.alert('Missing cookies', 'Capture cookies via Validate Client or paste them.');
      }
      auth = { type: 'cookie', cookie: trimmed };
    }

    setSubmitting(true);
    try {
      const server: ServerConfig = {
        id,
        name: trimmedName,
        kind,
        baseUrl: trimmedUrl,
        auth,
        useWebViewFetch,
      };
      await saveAuth(id, auth);
      addServer(server);
      queryClient.invalidateQueries({ queryKey: ['posts', id] });
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['autocomplete', id] });
      toast.success(Strings.SERVERS_SAVED);
      onSaved();
    } catch (e) {
      Alert.alert('Save failed', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const openValidate = (overrideUrl?: string) => {
    const url = (overrideUrl ?? baseUrl).trim();
    if (!/^https?:\/\//i.test(url)) {
      return Alert.alert(
        'Enter base URL first',
        'Validate Client opens the server in a WebView, so we need the URL first.',
      );
    }
    router.push({ pathname: '/server/validate', params: { url } });
  };

  const openApiKeyPage = () => {
    const path = API_KEY_PATH[kind];
    if (!path) return;
    const trimmed = baseUrl.trim().replace(/\/+$/, '');
    openValidate(`${trimmed}${path}`);
  };

  const sourceHint = AUTH_HINT[kind]?.[authKind];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxxl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        <Input
          label="NAME"
          value={name}
          onChangeText={setName}
          placeholder="My Danbooru"
          autoCorrect={false}
        />
        <Input
          label="BASE URL"
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://danbooru.donmai.us"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View>
          <Text
            style={[styles.label, { color: c.textMuted }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            SOURCE TYPE
          </Text>
          <View style={styles.optionGroup}>
            {SOURCE_KINDS.filter((k) => k.kind !== 'custom').map((k) => {
              const selected = kind === k.kind;
              return (
                <Pressable
                  key={k.kind}
                  onPress={() => setKind(k.kind)}
                  accessibilityRole="button"
                  accessibilityLabel={k.label}
                  accessibilityState={{ selected }}
                  hitSlop={8}
                  style={[
                    styles.option,
                    {
                      borderColor: c.accent,
                      backgroundColor: selected ? c.accent : 'transparent',
                      minHeight: 36,
                    },
                  ]}
                >
                  <Text
                    style={{ color: selected ? c.accentText : c.accent, fontWeight: '600' }}
                    maxFontSizeMultiplier={1.4}
                  >
                    {k.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Button
          label="Validate client / Sign in"
          variant="secondary"
          onPress={() => openValidate()}
          leadingIcon={<IconSymbol name="lock.fill" color={c.text} size={18} />}
          fullWidth
          accessibilityHint="Opens the server's home page in a WebView so you can sign in or pass a verification challenge"
        />

        <Card padding="lg" style={{ gap: Spacing.md }}>
          <Text
            style={[styles.label, { color: c.textMuted, marginBottom: 0 }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.4}
          >
            AUTHENTICATION
          </Text>
          <View style={styles.optionGroup}>
            {allowedAuthKinds.map((a) => {
              const selected = authKind === a;
              return (
                <Pressable
                  key={a}
                  onPress={() => setAuthKind(a)}
                  accessibilityRole="button"
                  accessibilityLabel={AUTH_LABEL[a]}
                  accessibilityState={{ selected }}
                  hitSlop={8}
                  style={[
                    styles.option,
                    {
                      borderColor: c.accent,
                      backgroundColor: selected ? c.accent : 'transparent',
                      minHeight: 36,
                    },
                  ]}
                >
                  <Text
                    style={{ color: selected ? c.accentText : c.accent, fontWeight: '600' }}
                    maxFontSizeMultiplier={1.4}
                  >
                    {AUTH_LABEL[a]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {sourceHint ? (
            <Text style={[styles.helper, { color: c.textMuted }]}>{sourceHint}</Text>
          ) : null}

          {authKind === 'basic' ? (
            <>
              <Input
                label="USERNAME"
                value={authField1}
                onChangeText={setAuthField1}
                placeholder="username"
                autoCapitalize="none"
              />
              <Input
                label="API KEY"
                value={authField2}
                onChangeText={setAuthField2}
                placeholder="api-key"
                secureTextEntry
              />
              {API_KEY_PATH[kind] ? (
                <Button
                  label="Open API key page in browser"
                  variant="ghost"
                  size="sm"
                  onPress={openApiKeyPage}
                  leadingIcon={<IconSymbol name="link" color={c.accent} size={16} />}
                />
              ) : null}
            </>
          ) : null}

          {authKind === 'apiKey' ? (
            <>
              <Input
                label="HEADER NAME"
                value={authField1}
                onChangeText={setAuthField1}
                placeholder="X-API-Key"
                autoCapitalize="none"
              />
              <Input
                label="KEY VALUE"
                value={authField2}
                onChangeText={setAuthField2}
                placeholder="key value"
                secureTextEntry
              />
            </>
          ) : null}

          {authKind === 'queryParams' ? (
            <Input
              label="KEY=VALUE PAIRS"
              value={authField1}
              onChangeText={setAuthField1}
              placeholder="api_key=...&user_id=..."
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />
          ) : null}

          {authKind === 'cookie' ? (
            <>
              <Input
                label="COOKIE HEADER VALUE"
                value={cookieValue}
                onChangeText={setCookieValue}
                placeholder="cf_clearance=...; session=..."
                autoCapitalize="none"
                autoCorrect={false}
                multiline
              />
              <Text style={[styles.helper, { color: c.textMuted }]}>
                Tap Validate Client to sign in or pass Cloudflare in a WebView. Captured cookies will
                be inserted here. On iOS the system also remembers HttpOnly cookies and applies them
                automatically.
              </Text>
            </>
          ) : null}
        </Card>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '500' }} maxFontSizeMultiplier={1.6}>
              Use embedded browser for API
            </Text>
            <Text style={[styles.helper, { color: c.textMuted, marginTop: 4 }]}>
              Routes JSON requests through Safari WebKit. Slower per-request but works on sites
              that block native fetch (ATF, Cloudflare-protected boorus).
            </Text>
          </View>
          <Switch
            value={useWebViewFetch}
            onValueChange={setUseWebViewFetch}
            accessibilityLabel="Use embedded browser for API"
          />
        </View>

        <Button
          label={existing ? 'Save' : 'Add server'}
          onPress={submit}
          loading={submitting}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function parseQueryParams(raw: string): Record<string, string> {
  const trimmed = raw.trim().replace(/^[?&]+/, '');
  if (!trimmed) return {};
  const out: Record<string, string> = {};
  for (const pair of trimmed.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const k = decodeURIComponent(pair.slice(0, eq)).trim();
    const v = decodeURIComponent(pair.slice(eq + 1)).trim();
    if (k) out[k] = v;
  }
  return out;
}

const styles = StyleSheet.create({
  label: { fontSize: FontSize.xs, letterSpacing: 0.5, marginBottom: Spacing.sm, fontWeight: '600' },
  helper: { fontSize: FontSize.xs, lineHeight: 18 },
  optionGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 4,
  },
});
