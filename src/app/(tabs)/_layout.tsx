import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, IconButton } from '@/components/ui';
import { currentStreak } from '@/features/activity/stats';
import { useActivityDays } from '@/features/activity/store';
import { radius, useColors } from '@/theme';

/** Reading streak pill; hidden until there is a streak to show. */
function StreakPill() {
  const c = useColors();
  const streak = currentStreak(useActivityDays(), new Date());
  if (!streak) return null;
  return (
    <Pressable
      onPress={() => router.navigate('/you' as never)}
      accessibilityRole="button"
      accessibilityLabel={`${streak}-day reading streak. Open your stats`}
      style={({ pressed }) => [styles.streak, { backgroundColor: `${c.accentStrong}22`, opacity: pressed ? 0.6 : 1 }]}>
      <AppText variant="caption" style={{ fontWeight: '700', color: c.accentStrong }}>
        🔥 {streak}
      </AppText>
    </Pressable>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: {
  name: string;
  title: string;
  icon: IconName;
  iconActive: IconName;
}[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  {
    name: 'papers',
    title: 'Papers',
    icon: 'document-text-outline',
    iconActive: 'document-text',
  },
  { name: 'trending', title: 'Trending', icon: 'flame-outline', iconActive: 'flame' },
  { name: 'read', title: 'Read', icon: 'newspaper-outline', iconActive: 'newspaper' },
  { name: 'watch', title: 'Watch', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { name: 'you', title: 'You', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

function HeaderActions() {
  const c = useColors();
  return (
    <View style={styles.actions}>
      <StreakPill />
      <IconButton icon="search" label="Search" color={c.text} onPress={() => router.push('/search')} />
      <IconButton icon="settings-outline" label="Preferences" color={c.text} onPress={() => router.push('/settings')} />
    </View>
  );
}

export default function TabLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.background },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700' },
        headerTitleAlign: 'left',
        headerRight: () => <HeaderActions />,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.background,
          borderTopColor: c.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: c.background },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarAccessibilityLabel: t.title,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} size={size - 2} color={color as string} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12 },
  streak: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
