import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { AppText, Chip, ContentColumn, Segmented } from '@/components/ui';
import { listVideos, type VideoMode, videoAreas, videoToFeedItem } from '@/features/videos/api';
import { rememberItems } from '@/lib/item-cache';
import { spacing } from '@/theme';

const PAGE = 20;

/** Videos Hacker News commenters recommend (HackerTube's catalog, bundled offline). */
export default function WatchScreen() {
  const [mode, setMode] = useState<VideoMode>('trending');
  const [area, setArea] = useState<string | undefined>();
  const [limit, setLimit] = useState(PAGE);
  const areas = useMemo(() => videoAreas().slice(0, 14), []);
  const { items: videos, nextOffset } = useMemo(() => listVideos({ area, mode, limit }), [area, mode, limit]);
  const items = useMemo(() => videos.map(videoToFeedItem), [videos]);
  useEffect(() => rememberItems(items), [items]);

  return (
    <FeedList
      items={items}
      isLoading={false}
      onRefresh={async () => undefined}
      onEndReached={() => setLimit((l) => l + PAGE)}
      hasNextPage={nextOffset !== null}
      showKind={false}
      grid
      header={
        <ContentColumn>
          <Segmented
            options={[
              { value: 'trending', label: 'Trending now' },
              { value: 'top', label: 'All-time best' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setLimit(PAGE);
            }}
          />
          <AppText variant="caption" tone="muted" style={styles.note}>
            {mode === 'trending'
              ? 'Videos Hacker News commenters recommended this year, most recommended first.'
              : 'The most recommended videos in Hacker News history. Curated by HackerTube.'}
          </AppText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label="All" selected={!area} onPress={() => setArea(undefined)} />
            {areas.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                selected={area === a.id}
                onPress={() => {
                  setArea(area === a.id ? undefined : a.id);
                  setLimit(PAGE);
                }}
              />
            ))}
          </ScrollView>
        </ContentColumn>
      }
    />
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
