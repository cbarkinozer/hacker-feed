import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppText, IconButton } from '@/components/ui';
import { loadHfSession } from '@/features/auth/session';
import { loadKaggleCredentials } from '@/features/kaggle/credentials';
import { startSession } from '@/features/preferences/store';
import { activityStore } from '@/features/activity/store';
import { savedStore } from '@/features/saved/store';
import { HttpError, shouldRetry } from '@/lib/http';
import { goBackOrHome } from '@/lib/navigation';
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
    Promise.all([startSession(), savedStore.hydrate(), activityStore.hydrate(), loadKaggleCredentials(), loadHfSession()]).finally(() => {
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
            screenOptions={({ navigation }) => ({
              headerTintColor: c.text,
              headerStyle: { backgroundColor: c.background },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: c.background },
              headerBackButtonDisplayMode: 'minimal',
              // Opened directly (deep link / web refresh): there is no history, so offer a way home.
              ...(navigation.canGoBack()
                ? {}
                : {
                    headerLeft: () => (
                      <IconButton icon="home-outline" label="Go to Home" color={c.text} onPress={() => router.replace('/')} />
                    ),
                  }),
            })}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="paper/[id]" options={{ title: 'Paper' }} />
            <Stack.Screen name="auth" options={{ headerShown: false }} />
            <Stack.Screen name="hn/[id]" options={{ title: 'Hacker News' }} />
            <Stack.Screen name="video/[vid]" options={{ title: 'Video' }} />
            <Stack.Screen name="model/[...id]" options={{ title: 'Model' }} />
            <Stack.Screen name="article/[source]/[...path]" options={{ title: 'Article' }} />
            <Stack.Screen name="search" options={{ title: 'Search' }} />
            <Stack.Screen
              name="settings"
              options={{
                title: 'Preferences',
                // Always offer an explicit way out, in addition to back/swipe.
                headerRight: () => (
                  <Pressable onPress={goBackOrHome} accessibilityRole="button" hitSlop={10} style={{ paddingHorizontal: 8 }}>
                    <AppText variant="body" style={{ fontWeight: '700', color: c.text }}>
                      Done
                    </AppText>
                  </Pressable>
                ),
              }}
            />
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
