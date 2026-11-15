import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { MessageState } from '@/components/states';
import { Button, Chip, ContentColumn, Segmented } from '@/components/ui';
import {
  useDatasetsInfinite,
  useKaggleCompetitionsInfinite,
  useKaggleDatasetsInfinite,
  useModelsInfinite,
  useSpacesInfinite,
} from '@/features/feed/hooks';
import { useKaggleCredentials } from '@/features/kaggle/credentials';
import type { FeedItem } from '@/features/feed/types';
import { modelToFeedItem, type ModelSort } from '@/features/models/api';
import type { RepoSort } from '@/features/repos/api';
import { rememberItems } from '@/lib/item-cache';
import { spacing } from '@/theme';

type RepoType = 'models' | 'spaces' | 'datasets' | 'kaggle' | 'competitions';

const TYPES: { value: RepoType; label: string }[] = [
  { value: 'models', label: 'Models' },
  { value: 'spaces', label: 'Spaces' },
  { value: 'datasets', label: 'Datasets' },
  { value: 'kaggle', label: 'Kaggle' },
  { value: 'competitions', label: 'Contests' },
];

const MODEL_SORTS: { value: ModelSort; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'likes', label: 'Most liked' },
  { value: 'downloads', label: 'Most downloaded' },
];

const REPO_SORTS: { value: RepoSort; label: string }[] = [
  { value: 'trending', label: 'Trending' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'likes', label: 'Most liked' },
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

export default function TrendingScreen() {
  const [type, setType] = useState<RepoType>('models');
  const [modelSort, setModelSort] = useState<ModelSort>('trending');
  const [repoSort, setRepoSort] = useState<RepoSort>('trending');
  const [task, setTask] = useState<string | undefined>();

  const credentials = useKaggleCredentials();
  const kaggle = useKaggleDatasetsInfinite('hottest', type === 'kaggle');
  const contests = useKaggleCompetitionsInfinite(type === 'competitions' ? credentials : null);
  const models = useModelsInfinite(modelSort, task, type === 'models');
  const spaces = useSpacesInfinite(repoSort, type === 'spaces');
  const datasets = useDatasetsInfinite(repoSort, type === 'datasets');

  const modelItems = useMemo(() => models.data?.pages.flatMap((p) => p.items.map(modelToFeedItem)) ?? [], [models.data]);
  const spaceItems = useMemo(() => spaces.data?.pages.flatMap((p) => p.items) ?? [], [spaces.data]);
  const datasetItems = useMemo(() => datasets.data?.pages.flatMap((p) => p.items) ?? [], [datasets.data]);

  const kaggleItems = useMemo(() => kaggle.data?.pages.flatMap((p) => p.items) ?? [], [kaggle.data]);
  const contestItems = useMemo(() => contests.data?.pages.flatMap((p) => p.items) ?? [], [contests.data]);

  const { q, items } =
    type === 'models'
      ? { q: models, items: modelItems }
      : type === 'spaces'
        ? { q: spaces, items: spaceItems }
        : type === 'datasets'
          ? { q: datasets, items: datasetItems }
          : type === 'kaggle'
            ? { q: kaggle, items: kaggleItems }
            : { q: contests, items: contestItems };
  useEffect(() => rememberItems(items as FeedItem[]), [items]);

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
      grid={type === 'spaces' || type === 'kaggle'}
      fallbackUrl={type === 'kaggle' || type === 'competitions' ? 'https://www.kaggle.com' : `https://huggingface.co/${type}`}
      empty={
        type === 'competitions' && !credentials ? (
          <MessageState
            icon="key-outline"
            title="Add your Kaggle key"
            message="Kaggle only lists competitions for signed-in users. Your key stays on this device and is sent only to kaggle.com.">
            <Button label="Open preferences" icon="settings-outline" onPress={() => router.push('/settings')} />
          </MessageState>
        ) : undefined
      }
      header={
        <ContentColumn>
          <Segmented options={TYPES} value={type} onChange={setType} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {type === 'models'
              ? MODEL_SORTS.map((s) => (
                  <Chip key={s.value} label={s.label} selected={modelSort === s.value} onPress={() => setModelSort(s.value)} />
                ))
              : REPO_SORTS.map((s) => (
                  <Chip key={s.value} label={s.label} selected={repoSort === s.value} onPress={() => setRepoSort(s.value)} />
                ))}
          </ScrollView>
          {type === 'models' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All tasks" selected={!task} onPress={() => setTask(undefined)} />
              {TASKS.map((t) => (
                <Chip key={t} label={t} selected={task === t} onPress={() => setTask(task === t ? undefined : t)} />
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
