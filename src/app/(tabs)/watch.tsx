import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { AppText, Chip, ContentColumn } from '@/components/ui';
import { listVideos, videoAreas, videoToFeedItem } from '@/features/videos/api';
import { rememberItems } from '@/lib/item-cache';
import { spacing } from '@/theme';

const PAGE = 20;

/** Talks and videos that Hacker News commenters keep recommending (HackerTube's catalog, bundled offline). */
export default function WatchScreen() {
  const [area, setArea] = useState<string | undefined>();
  const [limit, setLimit] = useState(PAGE);
  const areas = useMemo(() => videoAreas().slice(0, 14), []);
  const { items: videos, nextOffset } = useMemo(() => listVideos({ area, limit }), [area, limit]);
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
          <AppText variant="caption" tone="muted" style={styles.note}>
            Videos Hacker News keeps recommending, curated by HackerTube. No algorithm, no clickbait thumbnails (frames come from the
            video).
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
