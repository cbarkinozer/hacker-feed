import { Image } from 'expo-image';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/features/feed/types';
import { KIND_LABEL } from '@/features/feed/types';
import { compactNumber, formatAuthors, relativeTime } from '@/lib/format';
import { radius, spacing, useColors } from '@/theme';

import { BookmarkButton } from './BookmarkButton';
import { AppText, KindBadge, Stat } from './ui';

interface Props {
  item: FeedItem;
  onPress: (item: FeedItem) => void;
  isNew?: boolean;
  showKind?: boolean;
}

export const FeedCard = memo(function FeedCard({ item, onPress, isNew, showKind = true }: Props) {
  const c = useColors();
  const when = relativeTime(item.date);
  const authors = formatAuthors(item.authors);
  return (
    <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      <Pressable
        onPress={() => onPress(item)}
        accessibilityRole="button"
        accessibilityLabel={`${KIND_LABEL[item.kind]}: ${item.title}${authors ? `, by ${authors}` : ''}${when ? `, ${when}` : ''}`}
        accessibilityHint="Opens details"
        style={({ pressed }) => [styles.content, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.header}>
          <View style={styles.meta}>
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
        </View>

        <View style={styles.body}>
          <View style={styles.text}>
            <AppText variant="subtitle" numberOfLines={3}>
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
          {item.image && !item.image.match(/\.(mp4|webm|mov)$/i) ? (
            <Image
              source={item.image}
              style={[styles.thumb, { backgroundColor: c.skeleton }]}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
              accessible={false}
            />
          ) : null}
        </View>

        <View style={styles.footer}>
          {item.upvotes !== undefined ? <Stat icon="arrow-up" value={compactNumber(item.upvotes)} label="upvotes" /> : null}
          {item.likes !== undefined ? <Stat icon="heart-outline" value={compactNumber(item.likes)} label="likes" /> : null}
          {item.downloads !== undefined ? <Stat icon="download-outline" value={compactNumber(item.downloads)} label="downloads" /> : null}
          {item.tags[0] ? (
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.tag}>
              #{item.tags[0]}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.bookmark}>
        <BookmarkButton item={item} size={20} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  content: { padding: spacing.lg, gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 36,
    minHeight: 28,
  },
  bookmark: {
    position: 'absolute',
    top: spacing.sm + 2,
    right: spacing.sm + 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  newPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  body: { flexDirection: 'row', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  thumb: { width: 76, height: 76, borderRadius: radius.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: 2,
  },
  tag: { flexShrink: 1 },
});
