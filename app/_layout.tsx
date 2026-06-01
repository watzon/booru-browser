import {
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/baloo-2';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from '@/components/error-boundary';
import { NavOverlay } from '@/components/nav-overlay';
import { ToastProvider } from '@/components/ui/toast';
import { WebFetcherHost } from '@/components/web-fetcher-host';
import { useGateHydration } from '@/gate/store';
import { useOnboardingStore } from '@/onboarding/store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { breadcrumb } from '@/lib/log';
import { useServerCredentialHydration } from '@/servers/hydrate';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Hold the splash until the Baloo 2 display font is ready so the wordmark never
// flashes in a fallback face.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });
  useGateHydration();
  useServerCredentialHydration();
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const network = useNetworkStatus();

  // Hold the splash until both the font and the onboarding flag are ready, so
  // first-run users go straight to the intro without a blank flash in between.
  const ready = fontsLoaded && onboardingHydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    [],
  );

  // Wire React Query to network + app-state changes so paused queries resume
  // cleanly when the device comes back online or the app foregrounds.
  useEffect(() => {
    onlineManager.setOnline(network.isConnected);
    breadcrumb({ category: 'net', message: network.isConnected ? 'online' : 'offline' });
  }, [network.isConnected]);

  useEffect(() => {
    const onChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  // Keep the splash up (returned null) until the font + onboarding flag resolve.
  if (!ready) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <ToastProvider>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="onboarding"
                    options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
                  />
                  <Stack.Screen
                    name="post/[id]"
                    options={{ headerTitle: 'Post', headerBackTitle: 'Back' }}
                  />
                  <Stack.Screen
                    name="search"
                    options={{ presentation: 'modal', headerTitle: 'Search' }}
                  />
                  <Stack.Screen
                    name="filter"
                    options={{ presentation: 'modal', headerTitle: 'Filter & Sort' }}
                  />
                  <Stack.Screen
                    name="import"
                    options={{ presentation: 'modal', headerTitle: 'Import Server List' }}
                  />
                  <Stack.Screen
                    name="scan"
                    options={{ presentation: 'modal', headerTitle: 'Scan QR Code' }}
                  />
                  <Stack.Screen
                    name="servers"
                    options={{ headerTitle: 'Boorus', headerBackTitle: 'Settings' }}
                  />
                  <Stack.Screen
                    name="server/[id]"
                    options={{ headerTitle: 'Server' }}
                  />
                  <Stack.Screen
                    name="server/new"
                    options={{ presentation: 'modal', headerTitle: 'Add Server' }}
                  />
                  <Stack.Screen
                    name="server/validate"
                    options={{ presentation: 'modal', headerTitle: 'Validate Client' }}
                  />
                </Stack>
                <NavOverlay />
                <WebFetcherHost />
                <StatusBar style="auto" />
              </ToastProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default RootLayout;
