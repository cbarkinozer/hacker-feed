import { useInfiniteQuery, useQueries, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';

import { articleToFeedItem, fetchBlogPosts, fetchCommunityPosts, type ArticlePage } from '@/features/blogs/api';
import { fetchModels, modelToFeedItem, type CursorPage, type Model } from '@/features/models/api';
import { fetchDailyPapers, paperToFeedItem, type Page, type Paper } from '@/features/papers/api';
import { getPreviousVisit, usePreferences } from '@/features/preferences/store';
import { rememberItems } from '@/lib/item-cache';

import { buildHomeFeed } from './rank';
import type { ContentKind, FeedItem } from './types';

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
};

export function usePapersInfinite(sort: 'latest' | 'trending' = 'latest', enabled = true) {
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
  const on = (k: ContentKind) => prefs.homeKinds.includes(k);
  const papers = usePapersInfinite('latest', on('paper'));
  const models = useModelsInfinite('trending', undefined, on('model'));
  const blog = useBlogInfinite(on('blog'));
  // Trending, not recent: the recent community stream is dominated by brand-new, unvetted posts.
  const community = useCommunityInfinite('trending', on('community'));

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
  ].filter((s) => on(s.kind));

  const followedPages = followedModels.map((q) => q.data).filter((d): d is CursorPage<Model> => !!d);
  // "now" comes from the newest fetch time so ranking stays pure and stable between renders.
  const now = Math.max(0, ...sources.map((s) => s.q.dataUpdatedAt), ...followedModels.map((q) => q.dataUpdatedAt));
  const items = buildHomeFeed(
    mode,
    sources.map((s) => s.rows),
    followedPages.flatMap((d) => d.items.map(modelToFeedItem)),
    { interests: prefs.interests, following: prefs.following.map((h) => h.toLowerCase()), now },
  );
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
    isFetchingNextPage,
    hasNextPage,
    previousVisit: getPreviousVisit(),
    fetchNextPage: () => {
      for (const s of sources) if (s.q.hasNextPage && !s.q.isFetchingNextPage) s.q.fetchNextPage();
    },
    refetch: async () => {
      await Promise.all([...sources.map((s) => s.q.refetch()), ...followedModels.map((q) => q.refetch())]);
    },
  };
}
