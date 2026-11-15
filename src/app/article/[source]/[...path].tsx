import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionBar, Section } from '@/components/DetailParts';
import { Markdown } from '@/components/Markdown';
import { ErrorState, SkeletonBlock } from '@/components/states';
import { AppText, Button, Chip, ContentColumn, KindBadge } from '@/components/ui';
import { absoluteHfUrl, fetchArticleMarkdown } from '@/features/blogs/api';
import { queryKeys } from '@/features/feed/hooks';
import type { FeedItem } from '@/features/feed/types';
import { isFollowingHandle, toggleFollow, usePreferences } from '@/features/preferences/store';
import { savedStore } from '@/features/saved/store';
import { formatAuthors, relativeTime } from '@/lib/format';
import { HF_BASE } from '@/lib/http';
import { recallItem } from '@/lib/item-cache';
import { parseMarkdown, splitFrontmatter } from '@/lib/markdown';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

export default function ArticleScreen() {
  const params = useLocalSearchParams<{
    source: string;
    path: string[] | string;
  }>();
  const kind: FeedItem['kind'] = params.source === 'community' ? 'community' : 'blog';
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path;
  const c = useColors();
  const following = usePreferences().following;
  const url = `${HF_BASE}/blog/${path}`;

  const known = recallItem(kind, path) ?? savedStore.get().entries[`${kind}:${path}`]?.item;
  // Official canonical posts live as Markdown in github.com/huggingface/blog (slug without a namespace).
  const tryMarkdown = kind === 'blog' && !path.includes('/');
  const md = useQuery({
    queryKey: queryKeys.article(path),
    queryFn: ({ signal }) => fetchArticleMarkdown(path, signal),
    enabled: tryMarkdown,
  });
  const parsed = useMemo(() => (md.data ? parseMarkdown(md.data) : null), [md.data]);

  const item: FeedItem = known ?? {
    kind,
    id: path,
    title: parsed?.frontmatter.title ?? path.split('/').pop()!.replace(/-/g, ' '),
    url,
    image: absoluteHfUrl(parsed?.frontmatter.thumbnail),
    authors: [],
    handles: path.includes('/') ? [path.split('/')[0]] : [],
    tags: [],
  };
  const namespace = path.includes('/') ? path.split('/')[0] : null;
  // Drop the leading H1: the title is already rendered above.
  const body = md.data ? splitFrontmatter(md.data).body.replace(/^\s*#\s+.*\n/, '') : null;

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={{ backgroundColor: c.background }}>
      <ContentColumn>
        <KindBadge kind={kind} />
        <AppText variant="display" style={styles.title} accessibilityRole="header">
          {item.title}
        </AppText>
        <AppText variant="caption" tone="secondary">
          {[formatAuthors(item.authors, 4), relativeTime(item.date)].filter(Boolean).join(' · ')}
        </AppText>
        {item.image ? (
          <Image source={item.image} style={[styles.hero, { backgroundColor: c.surface }]} contentFit="cover" accessible={false} />
        ) : null}

        <ActionBar
          item={item}
          extra={
            namespace ? (
              <Button
                label={isFollowingHandle(following, namespace) ? `Following ${namespace}` : `Follow ${namespace}`}
                icon="person-add-outline"
                variant="secondary"
                onPress={() => toggleFollow(namespace)}
              />
            ) : null
          }
        />

        {item.tags.length ? (
          <View style={styles.chips}>
            {item.tags.map((t) => (
              <Chip key={t} label={`#${t}`} />
            ))}
          </View>
        ) : null}

        <Section title={tryMarkdown && body ? 'Article' : 'Read'}>
          {tryMarkdown && md.isPending ? (
            <SkeletonBlock lines={10} />
          ) : tryMarkdown && md.error ? (
            <ErrorState error={md.error} onRetry={() => md.refetch()} fallbackUrl={url} />
          ) : body ? (
            <>
              <Markdown source={body} base={`${HF_BASE}/blog/`} />
              <View style={{ marginTop: spacing.xl }}>
                <Button label="View on Hugging Face" icon="open-outline" variant="secondary" onPress={() => openExternal(url)} />
              </View>
            </>
          ) : (
            <View style={[styles.fallback, { backgroundColor: c.surface, borderColor: c.border }]}>
              <AppText variant="body" tone="secondary">
                {kind === 'community'
                  ? 'Community articles are only published on huggingface.co. Open it in the reader to continue.'
                  : 'The full text of this post is only available on huggingface.co.'}
              </AppText>
              <Button label="Read article" icon="reader-outline" onPress={() => openExternal(url)} />
            </View>
          )}
        </Section>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  title: { marginTop: spacing.md, marginBottom: spacing.sm },
  hero: {
    width: '100%',
    aspectRatio: 1.9,
    borderRadius: radius.lg,
    marginTop: spacing.lg,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  fallback: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
