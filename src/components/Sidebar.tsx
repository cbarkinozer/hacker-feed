import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { usePapersInfinite, useSpacesInfinite } from '@/features/feed/hooks';
import type { FeedItem } from '@/features/feed/types';
import { paperToFeedItem } from '@/features/papers/api';
import { compactNumber } from '@/lib/format';
import { setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

import { SkeletonBlock } from './states';
import { AppText } from './ui';

function RankedList({
  title,
  items,
  loading,
  onPress,
  more,
}: {
  title: string;
  items: FeedItem[];
  loading: boolean;
  onPress: (i: FeedItem) => void;
  more: () => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.box, { borderColor: c.border, backgroundColor: c.surfaceElevated }]}>
      <AppText variant="label" tone="muted" accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      {loading ? (
        <SkeletonBlock lines={5} />
      ) : (
        items.map((item, i) => (
          <Pressable
            key={item.id}
            onPress={() => onPress(item)}
            accessibilityRole="button"
            accessibilityLabel={`Number ${i + 1}: ${item.title}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
            <AppText variant="subtitle" style={[styles.rank, { color: i < 3 ? c.accentStrong : c.textMuted }]}>
              {i + 1}
            </AppText>
            <View style={{ flex: 1 }}>
              <AppText variant="caption" numberOfLines={2} style={{ fontWeight: '600', color: c.text }}>
                {item.emoji ? `${item.emoji} ` : ''}
                {item.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                {item.upvotes !== undefined ? `▲ ${compactNumber(item.upvotes)}` : `♥ ${compactNumber(item.likes)}`}
              </AppText>
            </View>
          </Pressable>
        ))
      )}
      <Pressable onPress={more} accessibilityRole="link" hitSlop={6}>
        <AppText variant="caption" tone="link">
          See all →
        </AppText>
      </Pressable>
    </View>
  );
}

/** Desktop/tablet rail next to the Home feed: this week's top papers and trending Spaces. */
export function Sidebar() {
  const weekly = usePapersInfinite('week');
  const spaces = useSpacesInfinite('trending');
  const papers = (weekly.data?.pages[0]?.items ?? []).slice(0, 7).map(paperToFeedItem);
  const topSpaces = (spaces.data?.pages[0]?.items ?? []).slice(0, 6);
  return (
    <ScrollView style={styles.sidebar} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <RankedList
        title="Top papers this week"
        items={papers}
        loading={weekly.isPending}
        onPress={(item) => {
          setPaperSequence(papers.map((p) => p.id));
          openItem(item);
        }}
        more={() => router.navigate('/papers')}
      />
      <RankedList
        title="Trending Spaces"
        items={topSpaces}
        loading={spaces.isPending}
        onPress={openItem}
        more={() => router.navigate('/trending' as never)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sidebar: { width: 340, flexGrow: 0 },
  content: { gap: spacing.lg, paddingVertical: spacing.lg, paddingRight: spacing.lg },
  box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  rank: { width: 20, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
