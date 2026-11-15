import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionBar, LinkRow, Section, StatBox } from '@/components/DetailParts';
import { MessageState } from '@/components/states';
import { AppText, Button, Chip, ContentColumn, KindBadge } from '@/components/ui';
import { hnPage } from '@/features/hn/api';
import { findVideo, frameUrl, videoToFeedItem, youtubeUrl } from '@/features/videos/api';
import { rememberItems } from '@/lib/item-cache';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

export default function VideoScreen() {
  const { vid } = useLocalSearchParams<{ vid: string }>();
  const c = useColors();
  const video = findVideo(vid);
  useEffect(() => {
    if (video) rememberItems([videoToFeedItem(video)]);
  }, [video]);
  if (!video)
    return (
      <MessageState icon="videocam-outline" title="Video not in the catalog" message="It may have been removed in a newer data export." />
    );
  const item = videoToFeedItem(video);

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={{ backgroundColor: c.background }}>
      <Stack.Screen options={{ title: 'Video' }} />
      <ContentColumn>
        <Image source={frameUrl(video.vid)} style={[styles.hero, { backgroundColor: c.skeleton }]} contentFit="cover" accessible={false} />
        <KindBadge kind="video" />
        <AppText variant="title" style={styles.title} accessibilityRole="header">
          {video.title}
        </AppText>
        <AppText variant="caption" tone="muted">
          {[video.channel, video.areaName, video.level, video.type].filter(Boolean).join(' · ')}
        </AppText>
        <View style={styles.stats}>
          <StatBox value={String(video.recommenders)} label="HN recommenders" />
          <StatBox value={String(video.mentions)} label="HN mentions" />
          {video.firstYear ? (
            <StatBox
              value={video.firstYear === video.lastYear ? String(video.firstYear) : `${video.firstYear}–${video.lastYear}`}
              label="discussed"
            />
          ) : null}
        </View>
        <ActionBar
          item={item}
          extra={<Button label="Watch on YouTube" icon="play-circle-outline" onPress={() => openExternal(youtubeUrl(video.vid))} />}
        />

        {video.summary ? (
          <Section title="Summary">
            <AppText variant="body" tone="secondary" selectable style={{ lineHeight: 24 }}>
              {video.summary}
            </AppText>
          </Section>
        ) : null}
        {video.whyHn ? (
          <Section title="Why Hacker News likes it">
            <AppText variant="body" tone="secondary" selectable style={{ lineHeight: 24 }}>
              {video.whyHn}
            </AppText>
          </Section>
        ) : null}
        {video.quote ? (
          <Section title={`A commenter said${video.quote.year ? ` · ${video.quote.year}` : ''}`}>
            <View style={[styles.quote, { borderLeftColor: c.accentStrong }]}>
              <AppText variant="body" tone="secondary" selectable style={{ fontStyle: 'italic', lineHeight: 24 }}>
                “{video.quote.text}”
              </AppText>
            </View>
            {video.quote.commentId ? (
              <LinkRow icon="chatbubble-outline" label="See the comment" url={hnPage(video.quote.commentId)} />
            ) : null}
          </Section>
        ) : null}
        {video.tags.length ? (
          <Section title="Topics">
            <View style={styles.chips}>
              {video.tags.map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          </Section>
        ) : null}
        <AppText variant="caption" tone="muted" style={{ marginTop: spacing.lg }}>
          Curation by HackerTube (ODC-By 1.0), derived from the open-index/hacker-news dataset.
        </AppText>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  hero: { width: '100%', aspectRatio: 16 / 9, maxHeight: 360, borderRadius: radius.lg, marginBottom: spacing.md },
  title: { marginTop: spacing.sm },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quote: { borderLeftWidth: 3, paddingLeft: spacing.md },
});
