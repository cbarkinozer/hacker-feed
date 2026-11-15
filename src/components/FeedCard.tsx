import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/features/feed/types';
import { KIND_LABEL } from '@/features/feed/types';
import { detailHref } from '@/lib/navigation';
import { compactNumber, formatAuthors, relativeTime } from '@/lib/format';
import { kindColor, radius, spacing, useColors } from '@/theme';

import { BookmarkButton } from './BookmarkButton';
import { AppText, KindBadge, Stat } from './ui';

export type CardDensity = 'comfortable' | 'compact';

interface Props {
  item: FeedItem;
  onPress: (item: FeedItem) => void;
  isNew?: boolean;
  showKind?: boolean;
  /** 1-based position for ranked lists (weekly/monthly top papers). */
  rank?: number;
  density?: CardDensity;
}

const isVideo = (u: string) => /\.(mp4|webm|mov)(\?|$)/i.test(u);
// Article and Space thumbnails are designed as covers; paper thumbnails are page renders.
const HERO_KINDS = new Set<FeedItem['kind']>(['blog', 'community', 'space', 'video']);

function a11yLabel(item: FeedItem, rank?: number) {
  const authors = formatAuthors(item.authors);
  const when = relativeTime(item.date);
  return `${rank ? `Number ${rank}. ` : ''}${KIND_LABEL[item.kind]}: ${item.title}${authors ? `, by ${authors}` : ''}${when ? `, ${when}` : ''}`;
}

function Stats({ item }: { item: FeedItem }) {
  return (
    <>
      {item.upvotes !== undefined ? <Stat icon="arrow-up" value={compactNumber(item.upvotes)} label="upvotes" /> : null}
      {item.likes !== undefined ? <Stat icon="heart-outline" value={compactNumber(item.likes)} label="likes" /> : null}
      {item.comments !== undefined ? <Stat icon="chatbubble-outline" value={compactNumber(item.comments)} label="comments" /> : null}
      {item.downloads !== undefined ? <Stat icon="download-outline" value={compactNumber(item.downloads)} label="downloads" /> : null}
    </>
  );
}

/** Hacker News–style dense row: rank, title, one meta line. */
function CompactRow({ item, onPress, isNew, rank, showKind = true }: Props) {
  const c = useColors();
  const engagement = item.upvotes ?? item.likes;
  const meta = [
    engagement !== undefined ? `${item.upvotes !== undefined ? '▲' : '♥'} ${compactNumber(engagement)}` : null,
    item.comments !== undefined ? `${compactNumber(item.comments)} comments` : null,
    showKind ? KIND_LABEL[item.kind].toLowerCase() : null,
    formatAuthors(item.authors, 2) || null,
    relativeTime(item.date) || null,
  ].filter(Boolean);
  return (
    <View style={[styles.compact, { borderBottomColor: c.border }]}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel(item, rank)}
        style={({ pressed }) => [styles.compactBody, { opacity: pressed ? 0.6 : 1 }]}>
        {rank ? (
          <AppText variant="subtitle" tone="muted" style={styles.compactRank}>
            {rank}.
          </AppText>
        ) : (
          <View style={[styles.compactDot, { backgroundColor: kindColor[item.kind] }]} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="body" numberOfLines={2} style={{ fontWeight: '600' }}>
            {item.emoji ? `${item.emoji} ` : ''}
            {item.title}
            {isNew ? (
              <AppText variant="label" style={{ color: c.accentStrong }}>
                {'  NEW'}
              </AppText>
            ) : null}
          </AppText>
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {meta.join(' · ')}
          </AppText>
        </View>
      </Pressable>
      <BookmarkButton item={item} size={18} />
    </View>
  );
}

export const FeedCard = memo(function FeedCard(props: Props) {
  const { item, onPress, isNew, showKind = true, rank, density = 'comfortable' } = props;
  const c = useColors();
  if (density === 'compact') return <CompactRow {...props} />;

  const when = relativeTime(item.date);
  const authors = formatAuthors(item.authors);
  const image = item.image && !isVideo(item.image) ? item.image : undefined;
  const hero = !!image && HERO_KINDS.has(item.kind);

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel(item, rank)}
        accessibilityHint={detailHref(item) ? 'Opens details' : 'Opens in the browser'}
        style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
        {hero ? (
          <Image
            source={image}
            style={[styles.hero, { backgroundColor: c.skeleton }]}
            contentFit="cover"
            transition={200}
            accessible={false}
          />
        ) : null}
        <View style={styles.content}>
          <View style={styles.header}>
            {rank ? (
              <AppText variant="title" style={[styles.rank, { color: rank <= 3 ? c.accentStrong : c.textMuted }]}>
                #{rank}
              </AppText>
            ) : null}
            {showKind ? <KindBadge kind={item.kind} /> : null}
            {isNew ? (
              <View style={[styles.newPill, { backgroundColor: c.accent }]}>
                <AppText variant="label" style={{ color: c.onAccent }}>
                  NEW
                </AppText>
              </View>
            ) : null}
            {when ? (
              <AppText variant="caption" tone="muted">
                {when}
              </AppText>
            ) : null}
          </View>

          <View style={styles.body}>
            <View style={styles.text}>
              <AppText variant={hero ? 'title' : 'subtitle'} numberOfLines={3}>
                {item.emoji && !hero ? `${item.emoji} ` : ''}
                {item.title}
              </AppText>
              {authors ? (
                <AppText variant="caption" tone="secondary" numberOfLines={1}>
                  {authors}
                </AppText>
              ) : null}
              {item.summary ? (
                <AppText variant="caption" tone="muted" numberOfLines={item.kind === 'paper' ? 3 : 2}>
                  {item.summary}
                </AppText>
              ) : null}
            </View>
            {image && !hero ? (
              <Image
                source={image}
                style={[styles.thumb, { backgroundColor: c.skeleton }]}
                contentFit="cover"
                transition={150}
                accessible={false}
              />
            ) : null}
          </View>

          <View style={styles.footer}>
            <Stats item={item} />
            {item.tags[0] && item.kind !== 'hn' ? (
              <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.tag}>
                #{item.tags[0]}
              </AppText>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={[styles.bookmark, hero && [styles.bookmarkOnImage, { backgroundColor: c.surfaceElevated }]]}>
        <BookmarkButton item={item} size={20} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  // Capped so covers stay a highlight, not a wall, in the wide single-column feed.
  hero: { width: '100%', aspectRatio: 1.9, maxHeight: 280 },
  content: { padding: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: 36, minHeight: 28 },
  rank: { fontVariant: ['tabular-nums'] },
  bookmark: { position: 'absolute', top: spacing.sm + 2, right: spacing.sm + 2 },
  bookmarkOnImage: { borderRadius: radius.pill, padding: 2 },
  newPill: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.sm },
  body: { flexDirection: 'row', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  thumb: { width: 92, height: 92, borderRadius: radius.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: 2 },
  tag: { flexShrink: 1 },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  compactRank: { minWidth: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },
  compactDot: { width: 8, height: 8, borderRadius: 4, marginTop: 8, marginHorizontal: 10 },
});
