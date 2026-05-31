import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { useToast } from '@/components/ui/toast';
import { useThemeColor } from '@/hooks/use-theme-color';
import { breadcrumb, warn } from '@/lib/log';
import { useValidateScratchpad } from '@/servers/validate-scratchpad';

// Injected once per page load. Reads non-HttpOnly cookies and posts them back
// to RN. HttpOnly cookies (cf_clearance, most session tokens) aren't visible
// here — on iOS they're handled transparently via the shared cookie store.
const INJECTED = `
  (function() {
    function send() {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'cookies',
          cookie: document.cookie,
          url: window.location.href,
        }));
      } catch (e) {}
    }
    send();
    // Re-send if the page rewrites cookies after challenge.
    setTimeout(send, 1500);
    setTimeout(send, 4000);
    true;
  })();
`;

export default function ValidateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ url?: string }>();
  const url = toBrowserUrl(params.url ?? '');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'icon');
  const accent = useThemeColor({}, 'tint');
  const queryClient = useQueryClient();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [capturedCookie, setCapturedCookie] = useState('');
  const [currentUrl, setCurrentUrl] = useState(url);
  const lastToastedRef = useRef(0);
  const webRef = useRef<WebView>(null);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data) as { type?: string; cookie?: string };
      if (data.type === 'cookies' && typeof data.cookie === 'string') {
        setCapturedCookie(data.cookie);
        // Toast at most once per several seconds when cookie size jumps.
        if (data.cookie.length > 0 && Date.now() - lastToastedRef.current > 4000) {
          lastToastedRef.current = Date.now();
          toast.info(`Captured ${data.cookie.length} chars`);
        }
      }
    } catch {
      // ignore
    }
  };

  const finish = (apply: boolean) => {
    if (apply) {
      if (!capturedCookie.trim() && Platform.OS !== 'ios') {
        Alert.alert(
          'No cookies captured',
          'No readable cookies on the current page. On Android this means HttpOnly cookies were skipped. Try signing in fully, then tap Done again — or paste cookies manually.',
          [{ text: 'OK' }],
        );
        return;
      }
      useValidateScratchpad.getState().capture(capturedCookie);
    }
    // Whichever way we leave, drop any cached challenge-page responses so the
    // page that pushed us here refetches with the newly-set cookies.
    queryClient.invalidateQueries({ queryKey: ['posts'] });
    queryClient.invalidateQueries({ queryKey: ['post'] });
    router.back();
  };

  if (!url) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: text }}>Missing URL</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen
        options={{
          headerTitle: hostnameOf(currentUrl),
          headerLeft: () => (
            <Pressable onPress={() => finish(false)} style={{ padding: 8 }}>
              <Text style={{ color: accent }}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={() => finish(true)} style={{ padding: 8 }}>
              <Text style={{ color: accent, fontWeight: '600' }}>Done</Text>
            </Pressable>
          ),
        }}
      />
      <WebView
        ref={webRef}
        source={{ uri: url }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        injectedJavaScript={INJECTED}
        onMessage={onMessage}
        onLoadStart={(e) => {
          breadcrumb({ category: 'validate', message: 'loadStart', data: { url: e.nativeEvent.url } });
          setCurrentUrl(e.nativeEvent.url);
        }}
        onLoadEnd={(e) => {
          breadcrumb({ category: 'validate', message: 'loadEnd', data: { url: e.nativeEvent.url } });
          setLoading(false);
        }}
        onNavigationStateChange={(s) => setCurrentUrl(s.url)}
        onError={(e) => warn('[validate] error', e.nativeEvent)}
        onHttpError={(e) =>
          warn('[validate] http error', {
            status: e.nativeEvent.statusCode,
            url: e.nativeEvent.url,
          })
        }
        style={{ flex: 1 }}
      />
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
        </View>
      ) : null}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <Text style={[styles.footerText, { color: muted }]} numberOfLines={2}>
          Sign in or wait for Cloudflare to clear. Tap{' '}
          <Text style={{ color: accent, fontWeight: '600' }}>Done</Text> when finished.
          {capturedCookie ? `  Captured: ${capturedCookie.length} chars.` : ''}
        </Text>
      </SafeAreaView>
    </View>
  );
}

function hostnameOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return 'Validate';
  }
}

// The error path passes us API URLs (e.g. /posts/123.json) — those WKWebView
// either downloads or renders blank because they aren't HTML. Convert to the
// human-readable equivalent so the user sees a real page and any challenge it
// gates renders normally. Cookies set there still apply to the API URL.
function toBrowserUrl(u: string): string {
  if (!u) return u;
  try {
    const parsed = new URL(u);
    parsed.pathname = parsed.pathname.replace(/\.json$/i, '');
    return parsed.toString();
  } catch {
    return u;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  footer: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    padding: 12,
  },
  footerText: { fontSize: 12, lineHeight: 16 },
});
