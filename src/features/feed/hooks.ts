import { useInfiniteQuery, useQueries, type InfiniteData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { articleToFeedItem, fetchBlogPosts, fetchCommunityPosts, type ArticlePage } from '@/features/blogs/api';
import { dayKey } from '@/features/activity/stats';
import { fetchHn, type HnFeed, type HnPage } from '@/features/hn/api';
import {
  fetchKaggleCompetitions,
  fetchKaggleDatasets,
  type CompetitionSort,
  type KaggleCredentials,
  type KaggleDatasetSort,
  type KagglePage,
} from '@/features/kaggle/api';
import { dailyVideos, videoToFeedItem } from '@/features/videos/api';
import { fetchModels, modelToFeedItem, type CursorPage, type Model } from '@/features/models/api';
import { fetchDatasets, fetchSpaces, type RepoSort } from '@/features/repos/api';
import { fetchDailyPapers, paperToFeedItem, type Page, type Paper, type PaperSort } from '@/features/papers/api';
import { getPreviousVisit, usePreferences } from '@/features/preferences/store';
import { activityStore, useDismissed } from '@/features/activity/store';
import { rememberItems } from '@/lib/item-cache';

import { buildHomeFeed } from './rank';
import { itemKey, type ContentKind, type FeedItem } from './types';

export type HomeMode = 'forYou' | 'latest' | 'following';

// Query keys are shared with the per-tab screens so the cache is reused across tabs.
export const queryKeys = {
  papers: (sort: string) => ['papers', sort] as const,
  paper: (id: string) => ['paper', id] as const,
  models: (sort: string, filter?: string) => ['models', sort, filter ?? ''] as const,
  model: (id: string) => ['model', id] as const,
  modelCard: (id: string) => ['modelCard', id] as const,
  blog: () => ['blog'] as const,
  community: (sort: string) => ['community', sort] as const,
  article: (path: string) => ['article', path] as const,
  authorModels: (handle: string) => ['authorModels', handle] as const,
  spaces: (sort: string) => ['spaces', sort] as const,
  datasets: (sort: string) => ['datasets', sort] as const,
  hn: (feed: string) => ['hn', feed] as const,
  hnStory: (id: string) => ['hnStory', id] as const,
  kaggleDatasets: (sort: string) => ['kaggleDatasets', sort] as const,
  kaggleCompetitions: (user: string, sort: string) => ['kaggleCompetitions', user, sort] as const,
};

export function useHnInfinite(feed: HnFeed = 'front', enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.hn(feed),
    queryFn: ({ pageParam, signal }) => fetchHn({ feed, page: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (last: HnPage) => last.nextPage,
    enabled,
  });
}

export function useKaggleDatasetsInfinite(sort: KaggleDatasetSort = 'hottest', enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.kaggleDatasets(sort),
    queryFn: ({ pageParam, signal }) => fetchKaggleDatasets({ sort, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (last: KagglePage) => last.nextPage,
    enabled,
  });
}

export function useKaggleCompetitionsInfinite(credentials: KaggleCredentials | null, sort: CompetitionSort = 'latestDeadline') {
  return useInfiniteQuery({
    queryKey: queryKeys.kaggleCompetitions(credentials?.username ?? '', sort),
    queryFn: ({ pageParam, signal }) => fetchKaggleCompetitions({ credentials: credentials!, sort, page: pageParam, signal }),
    initialPageParam: 1,
    getNextPageParam: (last: KagglePage) => last.nextPage,
    enabled: !!credentials,
    retry: false,
  });
}

export function usePapersInfinite(sort: PaperSort = 'latest', enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.papers(sort),
    queryFn: ({ pageParam, signal }) => fetchDailyPapers({ page: pageParam, sort, signal }),
    initialPageParam: 0,
    getNextPageParam: (last: Page<Paper>) => last.nextPage,
    enabled,
  });
}

export function useModelsInfinite(sort: 'trending' | 'likes' | 'downloads' | 'updated' = 'trending', pipelineTag?: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.models(sort, pipelineTag),
    queryFn: ({ pageParam, signal }) => fetchModels({ sort, pipelineTag, next: pageParam, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CursorPage<Model>) => last.next,
    enabled,
  });
}

export function useSpacesInfinite(sort: RepoSort = 'trending', enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.spaces(sort),
    queryFn: ({ pageParam, signal }) => fetchSpaces({ sort, next: pageParam, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CursorPage<FeedItem>) => last.next,
    enabled,
  });
}

export function useDatasetsInfinite(sort: RepoSort = 'trending', enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.datasets(sort),
    queryFn: ({ pageParam, signal }) => fetchDatasets({ sort, next: pageParam, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: CursorPage<FeedItem>) => last.next,
    enabled,
  });
}

export function useBlogInfinite(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.blog(),
    queryFn: ({ pageParam, signal }) => fetchBlogPosts({ page: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (last: ArticlePage) => last.nextPage,
    enabled,
  });
}

export function useCommunityInfinite(sort: 'recent' | 'trending' = 'recent', enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.community(sort),
    queryFn: ({ pageParam, signal }) => fetchCommunityPosts({ page: pageParam, sort, signal }),
    initialPageParam: 0,
    getNextPageParam: (last: ArticlePage) => last.nextPage,
    enabled,
  });
}

/** Page i of every source, as FeedItems. */
function batches<T>(data: InfiniteData<{ items: T[] }> | undefined, map: (t: T) => FeedItem): FeedItem[][] {
  return data?.pages.map((p) => p.items.map(map)) ?? [];
}

interface SourceStatus {
  kind: ContentKind;
  error: unknown;
}

/**
 * Unified Home feed. Each "batch" holds page N of every enabled source and is ranked on
 * its own, so loading more appends instead of reshuffling what is already on screen.
 */
export function useHomeFeed(mode: HomeMode) {
  const prefs = usePreferences();
  // Ranking uses a snapshot of what was learned, refreshed on pull-to-refresh, so the feed
  // doesn't reshuffle under your thumb while you scroll and the profile keeps updating.
  const [affinity, setAffinity] = useState(() => activityStore.get().affinity);
  const dismissed = useDismissed();
  const on = (k: ContentKind) => prefs.homeKinds.includes(k);
  const papers = usePapersInfinite('latest', on('paper'));
  const models = useModelsInfinite('trending', undefined, on('model'));
  const blog = useBlogInfinite(on('blog'));
  // Trending, not recent: the recent community stream is dominated by brand-new, unvetted posts.
  const community = useCommunityInfinite('trending', on('community'));
  const spaces = useSpacesInfinite('trending', on('space'));
  const datasets = useDatasetsInfinite('trending', on('dataset'));
  const hn = useHnInfinite('front', on('hn'));
  const kaggle = useKaggleDatasetsInfinite('hottest', on('kaggle'));
  // Lazy initializer: the day is fixed for this mount, keeping render pure.
  const [today] = useState(() => dayKey(new Date()));
  const videoRows = [dailyVideos(today, 4).map((v) => ({ ...videoToFeedItem(v), date: `${today}T00:00:00.000Z` }))];

  const followedModels = useQueries({
    queries: (mode === 'following' ? prefs.following : []).map((handle) => ({
      queryKey: queryKeys.authorModels(handle),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchModels({
          author: handle,
          sort: 'updated' as const,
          limit: 10,
          signal,
        }),
    })),
  });

  const sources = [
    {
      kind: 'paper' as const,
      q: papers,
      rows: batches(papers.data, paperToFeedItem),
    },
    {
      kind: 'model' as const,
      q: models,
      rows: batches(models.data, modelToFeedItem),
    },
    {
      kind: 'blog' as const,
      q: blog,
      rows: batches(blog.data, articleToFeedItem),
    },
    {
      kind: 'community' as const,
      q: community,
      rows: batches(community.data, articleToFeedItem),
    },
    { kind: 'space' as const, q: spaces, rows: batches(spaces.data, (i: FeedItem) => i) },
    { kind: 'dataset' as const, q: datasets, rows: batches(datasets.data, (i: FeedItem) => i) },
    { kind: 'hn' as const, q: hn, rows: batches(hn.data, (i: FeedItem) => i) },
    { kind: 'kaggle' as const, q: kaggle, rows: batches(kaggle.data, (i: FeedItem) => i) },
  ].filter((s) => on(s.kind));
  // Videos come from the bundled catalog, so there is nothing to fetch or page.
  const showVideos = on('video');

  const followedPages = followedModels.map((q) => q.data).filter((d): d is CursorPage<Model> => !!d);
  // "now" comes from the newest fetch time so ranking stays pure and stable between renders.
  const now = Math.max(0, ...sources.map((s) => s.q.dataUpdatedAt), ...followedModels.map((q) => q.dataUpdatedAt));
  const hidden = new Set(dismissed);
  const items = buildHomeFeed(
    mode,
    [...sources.map((s) => s.rows), ...(showVideos ? [videoRows] : [])],
    followedPages.flatMap((d) => d.items.map(modelToFeedItem)),
    { interests: prefs.interests, following: prefs.following.map((h) => h.toLowerCase()), now, affinity },
  ).filter((i) => !hidden.has(itemKey(i)));
  useEffect(() => rememberItems(items), [items]);

  const errors: SourceStatus[] = sources.filter((s) => s.q.error && !s.q.data).map((s) => ({ kind: s.kind, error: s.q.error }));
  const isLoading = sources.some((s) => s.q.isPending) && items.length === 0;
  const isFetchingNextPage = sources.some((s) => s.q.isFetchingNextPage);
  const hasNextPage = mode !== 'following' && sources.some((s) => s.q.hasNextPage);

  return {
    items,
    errors,
    isLoading: isLoading || (mode === 'following' && followedModels.some((q) => q.isPending) && items.length === 0),
    isRefetching: sources.some((s) => s.q.isRefetching && !s.q.isFetchingNextPage),
    /** True once every enabled network source has answered (success or error). */
    settled: sources.every((x) => !x.q.isPending),
    isFetchingNextPage,
    hasNextPage,
    previousVisit: getPreviousVisit(),
    fetchNextPage: () => {
      for (const s of sources) if (s.q.hasNextPage && !s.q.isFetchingNextPage) s.q.fetchNextPage();
    },
    refetch: async () => {
      setAffinity(activityStore.get().affinity);
      await Promise.all([...sources.map((s) => s.q.refetch()), ...followedModels.map((q) => q.refetch())]);
    },
  };
}
