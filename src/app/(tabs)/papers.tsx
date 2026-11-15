import { useCallback, useMemo, useState } from 'react';

import { FeedList } from '@/components/FeedList';
import { ContentColumn, Segmented } from '@/components/ui';
import { usePapersInfinite } from '@/features/feed/hooks';
import { isNewSince } from '@/features/feed/rank';
import type { FeedItem } from '@/features/feed/types';
import { paperToFeedItem, type PaperSort } from '@/features/papers/api';
import { getPreviousVisit } from '@/features/preferences/store';
import { rememberItems, setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';

const SORTS: { value: PaperSort; label: string }[] = [
  { value: 'latest', label: 'Daily' },
  { value: 'trending', label: 'Trending' },
];

export default function PapersScreen() {
  const [sort, setSort] = useState<PaperSort>('latest');
  const q = usePapersInfinite(sort);
  const items = useMemo(() => {
    const list = q.data?.pages.flatMap((p) => p.items.map(paperToFeedItem)) ?? [];
    rememberItems(list);
    return list;
  }, [q.data]);

  // Opening a paper registers the current list so the detail screen can swipe through it.
  const onPress = useCallback(
    (item: FeedItem) => {
      setPaperSequence(items.map((i) => i.id));
      openItem(item);
    },
    [items],
  );
  const previous = getPreviousVisit();
  const isNew = useCallback((item: FeedItem) => isNewSince(item, previous), [previous]);

  return (
    <FeedList
      items={items}
      isLoading={q.isPending}
      error={q.error}
      onRefresh={q.refetch}
      onEndReached={() => q.fetchNextPage()}
      hasNextPage={q.hasNextPage}
      isFetchingNextPage={q.isFetchingNextPage}
      onPressItem={onPress}
      isNew={isNew}
      showKind={false}
      fallbackUrl="https://huggingface.co/papers"
      header={
        <ContentColumn>
          <Segmented options={SORTS} value={sort} onChange={setSort} />
        </ContentColumn>
      }
    />
  );
}
