import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { Chip, ContentColumn, Segmented } from '@/components/ui';
import { articleToFeedItem } from '@/features/blogs/api';
import { useBlogInfinite, useCommunityInfinite, useHnInfinite } from '@/features/feed/hooks';
import type { HnFeed } from '@/features/hn/api';
import { rememberItems } from '@/lib/item-cache';
import { spacing } from '@/theme';

type Source = 'hn' | 'official' | 'community' | 'communityTrending';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'hn', label: 'Hacker News' },
  { value: 'official', label: 'HF Blog' },
  { value: 'community', label: 'Community' },
  { value: 'communityTrending', label: 'Community ↑' },
];

const HN_FEEDS: { value: HnFeed; label: string }[] = [
  { value: 'front', label: 'Front page' },
  { value: 'week', label: 'Best this week' },
  { value: 'ask', label: 'Ask HN' },
  { value: 'show', label: 'Show HN' },
  { value: 'new', label: 'New' },
];

export default function ReadScreen() {
  const [source, setSource] = useState<Source>('hn');
  const [hnFeed, setHnFeed] = useState<HnFeed>('front');
  const hn = useHnInfinite(hnFeed, source === 'hn');
  const official = useBlogInfinite(source === 'official');
  const community = useCommunityInfinite(source === 'communityTrending' ? 'trending' : 'recent', source.startsWith('community'));
  const q = source === 'hn' ? hn : source === 'official' ? official : community;

  const items = useMemo(
    () =>
      source === 'hn'
        ? (hn.data?.pages.flatMap((p) => p.items) ?? [])
        : (q.data?.pages.flatMap((p) => ('items' in p ? p.items : []).map((a) => articleToFeedItem(a as never))) ?? []),
    [source, hn.data, q.data],
  );
  useEffect(() => rememberItems(items), [items]);

  return (
    <FeedList
      items={items}
      isLoading={q.isPending}
      error={q.error}
      onRefresh={q.refetch}
      onEndReached={() => q.fetchNextPage()}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      showKind={false}
      ranked={source === 'hn' && hnFeed !== 'new'}
      grid={source !== 'hn'}
      fallbackUrl={source === 'hn' ? 'https://news.ycombinator.com' : 'https://huggingface.co/blog'}
      header={
        <ContentColumn>
          <Segmented options={SOURCES} value={source} onChange={setSource} />
          {source === 'hn' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {HN_FEEDS.map((f) => (
                <Chip key={f.value} label={f.label} selected={hnFeed === f.value} onPress={() => setHnFeed(f.value)} />
              ))}
            </ScrollView>
          ) : null}
        </ContentColumn>
      }
    />
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
