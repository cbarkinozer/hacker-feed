import { useMemo, useState } from 'react';

import { FeedList } from '@/components/FeedList';
import { ContentColumn, Segmented } from '@/components/ui';
import { articleToFeedItem } from '@/features/blogs/api';
import { useBlogInfinite, useCommunityInfinite } from '@/features/feed/hooks';
import { rememberItems } from '@/lib/item-cache';

type Source = 'official' | 'community' | 'communityTrending';

const SOURCES: { value: Source; label: string }[] = [
  { value: 'official', label: 'Official blog' },
  { value: 'community', label: 'Community' },
  { value: 'communityTrending', label: 'Community · Trending' },
];

export default function BlogsScreen() {
  const [source, setSource] = useState<Source>('official');
  const official = useBlogInfinite(source === 'official');
  const community = useCommunityInfinite(source === 'communityTrending' ? 'trending' : 'recent', source !== 'official');
  const q = source === 'official' ? official : community;

  const items = useMemo(() => {
    const list = q.data?.pages.flatMap((p) => p.items.map(articleToFeedItem)) ?? [];
    rememberItems(list);
    return list;
  }, [q.data]);

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
      fallbackUrl={source === 'official' ? 'https://huggingface.co/blog' : 'https://huggingface.co/blog/community'}
      header={
        <ContentColumn>
          <Segmented options={SOURCES} value={source} onChange={setSource} />
        </ContentColumn>
      }
    />
  );
}
