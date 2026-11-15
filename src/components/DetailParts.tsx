import type { ReactNode } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/features/feed/types';
import { toggleSaved, useIsSaved } from '@/features/saved/store';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

import { AppText, Button, Icon, type IconName } from './ui';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="muted" accessibilityRole="header">
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

export function LinkRow({ icon, label, url, detail }: { icon: IconName; label: string; url: string; detail?: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => openExternal(url)}
      accessibilityRole="link"
      accessibilityLabel={`${label}${detail ? `, ${detail}` : ''}`}
      style={({ pressed }) => [
        styles.linkRow,
        {
          borderColor: c.border,
          backgroundColor: pressed ? c.surface : 'transparent',
        },
      ]}>
      <Icon name={icon} size={18} color={c.text} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" numberOfLines={1}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {detail}
          </AppText>
        ) : null}
      </View>
      <Icon name="open-outline" size={16} />
    </Pressable>
  );
}

/** Save / share / open-on-HF row shared by all detail screens. */
export function ActionBar({ item, extra }: { item: FeedItem; extra?: ReactNode }) {
  const saved = useIsSaved(item);
  return (
    <View style={styles.actions}>
      <Button
        label={saved ? 'Saved' : 'Save'}
        icon={saved ? 'bookmark' : 'bookmark-outline'}
        onPress={() => toggleSaved(item)}
        variant={saved ? 'primary' : 'secondary'}
      />
      <Button
        label="Share"
        icon="share-outline"
        variant="secondary"
        onPress={() =>
          Share.share({
            message: `${item.title}\n${item.url}`,
            url: item.url,
            title: item.title,
          }).catch(() => undefined)
        }
      />
      {extra}
    </View>
  );
}

export function StatBox({ value, label }: { value: string; label: string }) {
  const c = useColors();
  return (
    <View
      style={[styles.statBox, { backgroundColor: c.surface, borderColor: c.border }]}
      accessible
      accessibilityLabel={`${value} ${label}`}>
      <AppText variant="subtitle">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm, marginTop: spacing.xl },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  statBox: {
    flex: 1,
    minWidth: 90,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
