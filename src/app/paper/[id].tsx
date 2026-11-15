import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ActionBar, LinkRow, Section, StatBox } from '@/components/DetailParts';
import { ErrorState, SkeletonBlock } from '@/components/states';
import { AppText, Button, Chip, ContentColumn, KindBadge } from '@/components/ui';
import { upvotePaper } from '@/features/auth/api';
import { useHfSession } from '@/features/auth/session';
import { recordOpen } from '@/features/activity/store';
import { queryKeys } from '@/features/feed/hooks';
import { KIND_LABEL } from '@/features/feed/types';
import { modelUrl } from '@/features/models/api';
import { fetchPaper, paperLinks, paperToFeedItem } from '@/features/papers/api';
import { isFollowingHandle, toggleFollow, usePreferences } from '@/features/preferences/store';
import { compactNumber, relativeTime } from '@/lib/format';
import { getPaperSequence, recallItem } from '@/lib/item-cache';
import { openExternal } from '@/lib/navigation';
import { spacing, useColors } from '@/theme';

function PaperDetail({ id }: { id: string }) {
  const c = useColors();
  const cached = recallItem('paper', id);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: queryKeys.paper(id),
    queryFn: ({ signal }) => fetchPaper(id, signal),
  });
  const following = usePreferences().following;
  const item = data ? paperToFeedItem(data) : cached;
  const links = paperLinks(id);
  const session = useHfSession();
  const [upvoteState, setUpvoteState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  // Signed in: try the API, and fall back to the website if Hugging Face rejects it. Signed out: website.
  const upvote = {
    state: upvoteState,
    press: async () => {
      if (!session) return openExternal(links.hf);
      setUpvoteState('busy');
      try {
        await upvotePaper(id, session);
        setUpvoteState('done');
      } catch {
        setUpvoteState('failed');
        void openExternal(links.hf);
      }
    },
  };

  if (!item && error) return <ErrorState error={error} onRetry={() => refetch()} fallbackUrl={links.hf} />;

  const authors = data?.authors ?? item?.authors ?? [];
  const summary = data?.summary || item?.summary;
  const org = data?.organizationHandle;

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={{ backgroundColor: c.background }}>
      <ContentColumn>
        <KindBadge kind="paper" />
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {item?.title ?? id}
        </AppText>
        {authors.length ? (
          <AppText variant="caption" tone="secondary">
            {authors.join(', ')}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          arXiv {id}
          {data?.publishedAt ? ` · published ${relativeTime(data.publishedAt)}` : ''}
          {data?.organization ? ` · ${data.organization}` : ''}
        </AppText>

        <View style={styles.stats}>
          <StatBox value={compactNumber(item?.upvotes ?? 0)} label="upvotes" />
          {data?.githubStars ? <StatBox value={compactNumber(data.githubStars)} label="GitHub stars" /> : null}
          {data?.numComments !== undefined ? <StatBox value={compactNumber(data.numComments)} label="comments" /> : null}
        </View>

        {item ? (
          <ActionBar
            item={item}
            extra={
              <Button
                label={upvote.state === 'done' ? 'Upvoted' : upvote.state === 'busy' ? 'Upvoting…' : 'Upvote on HF'}
                icon="arrow-up"
                variant={upvote.state === 'done' ? 'primary' : 'secondary'}
                disabled={upvote.state === 'busy' || upvote.state === 'done'}
                onPress={upvote.press}
              />
            }
          />
        ) : null}
        {upvote.state === 'failed' ? (
          <AppText variant="caption" tone="muted">
            Couldn&apos;t upvote from the app, so the paper page was opened instead.
          </AppText>
        ) : null}

        <Section title="Abstract">
          {summary ? (
            <AppText variant="body" tone="secondary" selectable style={{ lineHeight: 26 }}>
              {summary}
            </AppText>
          ) : isPending ? (
            <SkeletonBlock />
          ) : (
            <AppText tone="muted">No abstract available.</AppText>
          )}
        </Section>

        {data?.keywords.length ? (
          <Section title="Keywords">
            <View style={styles.chips}>
              {data.keywords.slice(0, 12).map((k) => (
                <Chip key={k} label={k} />
              ))}
            </View>
          </Section>
        ) : null}

        {data?.linked.length ? (
          <Section title={`Released with this paper · ${data.linked.length}`}>
            {data.linked.slice(0, 8).map((l) => (
              <LinkRow
                key={`${l.kind}:${l.id}`}
                icon={l.kind === 'model' ? 'cube-outline' : l.kind === 'dataset' ? 'server-outline' : 'rocket-outline'}
                label={`${l.emoji ? `${l.emoji} ` : ''}${l.id}`}
                detail={KIND_LABEL[l.kind]}
                url={l.kind === 'model' ? modelUrl(l.id) : `https://huggingface.co/${l.kind === 'dataset' ? 'datasets' : 'spaces'}/${l.id}`}
                onPress={l.kind === 'model' ? () => router.push(`/model/${l.id}` as never) : undefined}
              />
            ))}
          </Section>
        ) : null}

        <Section title="Links">
          <LinkRow icon="happy-outline" label="Hugging Face paper page" detail="Discussion, linked models & datasets" url={links.hf} />
          <LinkRow icon="document-outline" label="arXiv" detail={links.arxiv} url={links.arxiv} />
          <LinkRow icon="download-outline" label="PDF" url={links.pdf} />
          {data?.githubRepo ? <LinkRow icon="logo-github" label="Code" detail={data.githubRepo} url={data.githubRepo} /> : null}
          {data?.projectPage ? (
            <LinkRow icon="globe-outline" label="Project page" detail={data.projectPage} url={data.projectPage} />
          ) : null}
        </Section>

        {org ? (
          <Section title="Organization">
            <View style={styles.chips}>
              <Chip
                label={isFollowingHandle(following, org) ? `Following ${org}` : `Follow ${org}`}
                selected={isFollowingHandle(following, org)}
                onPress={() => toggleFollow(org)}
              />
            </View>
          </Section>
        ) : null}
      </ContentColumn>
    </ScrollView>
  );
}

/** Swipe horizontally between papers when opened from a list; single page otherwise. */
export default function PaperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const sequence = useMemo(() => {
    const seq = getPaperSequence();
    return seq.includes(id) ? seq : [id];
  }, [id]);
  const initialIndex = Math.max(0, sequence.indexOf(id));
  const [index, setIndex] = useState(initialIndex);

  return (
    <>
      <Stack.Screen
        options={{
          title: sequence.length > 1 ? `Paper ${index + 1} of ${sequence.length}` : 'Paper',
        }}
      />
      <FlatList
        data={sequence}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
        keyExtractor={(x) => x}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(next);
          // Swiping to a paper counts as reading it, same as tapping it in a list.
          if (sequence[next]) recordOpen({ kind: 'paper', id: sequence[next] });
        }}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <PaperDetail id={item} />
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  title: { marginTop: spacing.md, marginBottom: spacing.sm },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
