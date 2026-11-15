import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui';
import { useColors } from '@/theme';

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
  { name: 'models', title: 'Models', icon: 'cube-outline', iconActive: 'cube' },
  {
    name: 'blogs',
    title: 'Blogs',
    icon: 'newspaper-outline',
    iconActive: 'newspaper',
  },
  {
    name: 'saved',
    title: 'Saved',
    icon: 'bookmark-outline',
    iconActive: 'bookmark',
  },
];

function HeaderActions() {
  const c = useColors();
  return (
    <View style={styles.actions}>
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
  actions: { flexDirection: 'row', gap: 8, paddingRight: 12 },
});
