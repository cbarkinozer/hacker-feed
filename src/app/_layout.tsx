import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { startSession } from '@/features/preferences/store';
import { savedStore } from '@/features/saved/store';
import { HttpError, shouldRetry } from '@/lib/http';
import { palette, useResolvedScheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: shouldRetry,
      // Honour HF's rate-limit reset window when we have it (capped so the UI doesn't hang).
      retryDelay: (attempt, err) =>
        err instanceof HttpError && err.retryAfter ? Math.min(err.retryAfter, 20) * 1000 : Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const scheme = useResolvedScheme();
  const c = palette[scheme];

  useEffect(() => {
    Promise.all([startSession(), savedStore.hydrate()]).finally(() => {
      setReady(true);
      SplashScreen.hideAsync().catch(() => undefined);
    });
  }, []);

  if (!ready) return null;

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          value={{
            ...navTheme,
            colors: {
              ...navTheme.colors,
              background: c.background,
              card: c.background,
              text: c.text,
              border: c.border,
              primary: c.accentStrong,
            },
          }}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerTintColor: c.text,
              headerStyle: { backgroundColor: c.background },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: c.background },
              headerBackButtonDisplayMode: 'minimal',
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="paper/[id]" options={{ title: 'Paper' }} />
            <Stack.Screen name="model/[...id]" options={{ title: 'Model' }} />
            <Stack.Screen name="article/[source]/[...path]" options={{ title: 'Article' }} />
            <Stack.Screen name="search" options={{ title: 'Search' }} />
            <Stack.Screen
              name="settings"
              options={{
                title: 'Preferences',
                presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              }}
            />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
