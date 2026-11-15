import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey } from '@/features/activity/stats';
import { activityStore } from '@/features/activity/store';
import type { FeedItem } from '@/features/feed/types';
import { itemKey, KIND_LABEL } from '@/features/feed/types';
import { useStore } from '@/lib/store';
import { kindColor, radius, spacing, useColors } from '@/theme';

import { AppText, Icon } from './ui';

const NONE: string[] = [];

/** Today's 5: a finite checklist; opening an item ticks it, finishing it is a small win. */
export function Digest({ items, onPress }: { items: FeedItem[]; onPress: (item: FeedItem) => void }) {
  const c = useColors();
  const seen = useStore(activityStore, (s) => (s.todayKey === dayKey(new Date()) ? s.todaySeen : NONE));
  if (!items.length) return null;
  const done = items.filter((i) => seen.includes(itemKey(i))).length;
  const complete = done === items.length;

  return (
    <View style={[styles.box, { backgroundColor: c.surfaceElevated, borderColor: complete ? c.accentStrong : c.border }]}>
      <View style={styles.head}>
        <AppText variant="subtitle" accessibilityRole="header">
          {complete ? '✅ Digest done' : "Today's 5"}
        </AppText>
        <AppText variant="caption" tone="muted">
          {done}/{items.length}
        </AppText>
      </View>
      {items.map((item) => {
        const read = seen.includes(itemKey(item));
        return (
          <Pressable
            key={itemKey(item)}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`${read ? 'Read. ' : ''}${KIND_LABEL[item.kind]}: ${item.title}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name={read ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={read ? c.accentStrong : c.textMuted} />
            <View style={[styles.dot, { backgroundColor: kindColor[item.kind] }]} />
            <AppText variant="body" numberOfLines={1} tone={read ? 'muted' : undefined} style={{ flex: 1 }}>
              {item.title}
            </AppText>
            <AppText variant="caption" tone="muted">
              {KIND_LABEL[item.kind]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.md, marginHorizontal: spacing.lg, gap: spacing.xs },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
