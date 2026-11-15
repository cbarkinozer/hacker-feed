import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useReadSignal } from '@/features/activity/useReadSignal';
import { ActionBar, LinkRow, Section, StatBox } from '@/components/DetailParts';
import { ErrorState, SkeletonBlock } from '@/components/states';
import { AppText, Button, ContentColumn, KindBadge } from '@/components/ui';
import { queryKeys } from '@/features/feed/hooks';
import { fetchHnStory, hnPage } from '@/features/hn/api';
import { compactNumber, relativeTime } from '@/lib/format';
import { recallItem } from '@/lib/item-cache';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

export default function HnStoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useReadSignal('hn', id);
  const c = useColors();
  const cached = recallItem('hn', id);
  const { data, error, isPending, refetch } = useQuery({
    queryKey: queryKeys.hnStory(id),
    queryFn: ({ signal }) => fetchHnStory(id, signal),
  });
  const item = data?.item ?? cached;
  if (!item && error) return <ErrorState error={error} onRetry={() => refetch()} fallbackUrl={hnPage(id)} />;

  const shown = data?.comments.length ?? 0;
  return (
    <ScrollView contentContainerStyle={styles.scroll} style={{ backgroundColor: c.background }}>
      <Stack.Screen options={{ title: 'Hacker News' }} />
      <ContentColumn>
        <KindBadge kind="hn" />
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {item?.title ?? 'Loading…'}
        </AppText>
        {item ? (
          <AppText variant="caption" tone="muted">
            {[item.authors[0] ? `by ${item.authors[0]}` : null, relativeTime(item.date) || null, item.tags[0] ?? null]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        ) : null}
        <View style={styles.stats}>
          <StatBox value={compactNumber(item?.upvotes ?? 0)} label="points" />
          <StatBox value={compactNumber(item?.comments ?? 0)} label="comments" />
        </View>
        {item ? (
          <ActionBar
            item={item}
            extra={
              item.link ? (
                <Button label="Read article" icon="open-outline" variant="secondary" onPress={() => openExternal(item.link as string)} />
              ) : null
            }
          />
        ) : null}

        {data?.text ? (
          <Section title="Post">
            <AppText variant="body" tone="secondary" selectable style={{ lineHeight: 24 }}>
              {data.text}
            </AppText>
          </Section>
        ) : null}

        <Section title={`Discussion${data ? ` · ${shown}${shown < (item?.comments ?? 0) ? '+' : ''}` : ''}`}>
          {isPending ? (
            <SkeletonBlock />
          ) : shown ? (
            data?.comments.map((cm) => (
              <View key={cm.id} style={[styles.comment, { marginLeft: Math.min(cm.depth, 5) * 12, borderLeftColor: c.border }]}>
                <AppText variant="caption" tone="muted">
                  {cm.author} · {relativeTime(cm.date)}
                </AppText>
                <AppText variant="body" tone="secondary" selectable style={{ lineHeight: 22 }}>
                  {cm.text}
                </AppText>
              </View>
            ))
          ) : (
            <AppText tone="muted">No comments yet.</AppText>
          )}
        </Section>

        <Section title="Links">
          <LinkRow icon="chatbubbles-outline" label="Discuss on Hacker News" detail="Log in there to vote or comment" url={hnPage(id)} />
        </Section>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  title: { marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  comment: { gap: 2, paddingLeft: spacing.sm, paddingVertical: spacing.xs, borderLeftWidth: 2, borderRadius: radius.sm },
});
