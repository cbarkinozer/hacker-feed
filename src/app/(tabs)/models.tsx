import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { Chip, ContentColumn, Segmented } from '@/components/ui';
import { useModelsInfinite } from '@/features/feed/hooks';
import { modelToFeedItem, type ModelSort } from '@/features/models/api';
import { rememberItems } from '@/lib/item-cache';
import { spacing } from '@/theme';

const SORTS: { value: ModelSort; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'likes', label: 'Most liked' },
  { value: 'downloads', label: 'Most downloaded' },
];

const TASKS = [
  'text-generation',
  'image-text-to-text',
  'text-to-image',
  'automatic-speech-recognition',
  'text-to-speech',
  'feature-extraction',
  'image-to-video',
  'robotics',
];

export default function ModelsScreen() {
  const [sort, setSort] = useState<ModelSort>('trending');
  const [task, setTask] = useState<string | undefined>();
  const q = useModelsInfinite(sort, task);
  const items = useMemo(() => {
    const list = q.data?.pages.flatMap((p) => p.items.map(modelToFeedItem)) ?? [];
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
      fallbackUrl="https://huggingface.co/models"
      header={
        <ContentColumn>
          <Segmented options={SORTS} value={sort} onChange={setSort} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tasks}>
            <Chip label="All tasks" selected={!task} onPress={() => setTask(undefined)} />
            {TASKS.map((t) => (
              <Chip key={t} label={t} selected={task === t} onPress={() => setTask(task === t ? undefined : t)} />
            ))}
          </ScrollView>
        </ContentColumn>
      }
    />
  );
}

const styles = StyleSheet.create({
  tasks: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
});
