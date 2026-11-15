import { useCallback, useMemo, useState } from 'react';

import { FeedList } from '@/components/FeedList';
import { MessageState } from '@/components/states';
import { ContentColumn, Segmented } from '@/components/ui';
import type { ContentKind, FeedItem } from '@/features/feed/types';
import { sortedEntries, useSavedEntries } from '@/features/saved/store';
import { setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';

type Filter = 'all' | ContentKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paper', label: 'Papers' },
  { value: 'model', label: 'Models' },
  { value: 'blog', label: 'Blog' },
  { value: 'community', label: 'Articles' },
];

export default function SavedScreen() {
  const entries = useSavedEntries();
  const [filter, setFilter] = useState<Filter>('all');
  const items = useMemo(
    () =>
      sortedEntries(entries)
        .map((e) => e.item)
        .filter((i) => filter === 'all' || i.kind === filter),
    [entries, filter],
  );
  const onPress = useCallback(
    (item: FeedItem) => {
      setPaperSequence(items.filter((i) => i.kind === 'paper').map((i) => i.id));
      openItem(item);
    },
    [items],
  );

  return (
    <FeedList
      items={items}
      isLoading={false}
      onRefresh={async () => undefined}
      onPressItem={onPress}
      header={
        <ContentColumn>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        </ContentColumn>
      }
      empty={
        <MessageState
          icon="bookmark-outline"
          title="No saved items"
          message="Tap the bookmark on any paper, model, or article to keep it here. Saved items stay on this device."
        />
      }
    />
  );
}
