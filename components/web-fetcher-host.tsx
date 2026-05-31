import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { breadcrumb, warn } from '@/lib/log';
import { useActiveServer } from '@/servers/store';
import { webFetcher } from '@/services/webview-fetcher';

export function WebFetcherHost() {
  const active = useActiveServer();
  const enabled = !!active?.useWebViewFetch && !!active?.baseUrl;
  const baseUrl = enabled ? active!.baseUrl : '';

  useEffect(() => {
    return () => {
      webFetcher.reset();
    };
  }, [baseUrl]);

  if (!enabled) return null;

  return (
    <View style={styles.host} pointerEvents="none" collapsable={false}>
      <WebView
        ref={(r) => webFetcher.setRef(r)}
        source={{ uri: baseUrl }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        cacheEnabled
        onLoadEnd={() => {
          breadcrumb({ category: 'web-fetcher', message: 'ready', data: { baseUrl } });
          webFetcher.setReady(baseUrl);
        }}
        onError={(e) => warn('[web-fetcher] error', e.nativeEvent)}
        onHttpError={(e) =>
          warn('[web-fetcher] http error', {
            status: e.nativeEvent.statusCode,
            url: e.nativeEvent.url,
          })
        }
        onMessage={(e) => webFetcher.handleMessage(e.nativeEvent.data)}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: -10000,
    top: -10000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  web: { width: 1, height: 1 },
});
