import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { Sidebar } from '@/components/Sidebar';
import { MessageState } from '@/components/states';
import { AppText, Button, ContentColumn, Segmented } from '@/components/ui';
import { UnofficialNotice } from '@/components/UnofficialNotice';
import { Digest } from '@/components/Digest';
import { buildDigest } from '@/features/feed/digest';
import { useHomeFeed, type HomeMode } from '@/features/feed/hooks';
import { isNewSince } from '@/features/feed/rank';
import { itemKey, KIND_LABEL, type FeedItem } from '@/features/feed/types';
import { usePreferences } from '@/features/preferences/store';
import { setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';
import { SIDEBAR_BREAKPOINT, spacing } from '@/theme';

const MODES: { value: HomeMode; label: string }[] = [
  { value: 'forYou', label: 'For You' },
  { value: 'latest', label: 'Latest' },
  { value: 'following', label: 'Following' },
];

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<HomeMode>('forYou');
  const feed = useHomeFeed(mode);
  const prefs = usePreferences();
  // Frozen once built: opening an item re-ranks For You, which would otherwise reshuffle today's list.
  const [digest, setDigest] = useState<FeedItem[] | null>(null);
  if (!digest && mode === 'forYou' && feed.settled && feed.items.length >= 5) setDigest(buildDigest(feed.items));
  const caughtUpKey =
    mode === 'latest' && feed.previousVisit !== null
      ? (() => {
          const i = feed.items.findIndex((x) => !isNewSince(x, feed.previousVisit));
          return i > 0 ? itemKey(feed.items[i]) : undefined;
        })()
      : undefined;
  const isNew = useCallback((item: FeedItem) => isNewSince(item, feed.previousVisit), [feed.previousVisit]);
  const onPress = useCallback(
    (item: FeedItem) => {
      setPaperSequence(feed.items.filter((i) => i.kind === 'paper').map((i) => i.id));
      openItem(item);
    },
    [feed.items],
  );

  const header = (
    <ContentColumn style={styles.header}>
      <View style={styles.pad}>
        <UnofficialNotice compact />
      </View>
      <Segmented options={MODES} value={mode} onChange={setMode} />
      {mode === 'forYou' && digest ? <Digest items={digest} onPress={onPress} /> : null}
      {mode === 'forYou' && prefs.interests.length === 0 ? (
        <AppText variant="caption" tone="muted" style={styles.pad}>
          Ranked by freshness and popularity. Pick topics in Preferences to personalize.
        </AppText>
      ) : null}
      {feed.errors.length > 0 && feed.items.length > 0 ? (
        <AppText variant="caption" tone="muted" style={styles.pad}>
          Couldn&apos;t load: {feed.errors.map((e) => KIND_LABEL[e.kind]).join(', ')}. Pull to retry.
        </AppText>
      ) : null}
    </ContentColumn>
  );

  const empty =
    mode === 'following' ? (
      <MessageState
        icon="people-outline"
        title={prefs.following.length ? 'No recent updates' : 'Follow people and orgs'}
        message={
          prefs.following.length
            ? 'Nothing new from the accounts you follow.'
            : 'Follow Hugging Face users or organizations to see their latest models and articles here.'
        }>
        <Button label="Manage following" icon="person-add-outline" onPress={() => router.push('/settings')} />
      </MessageState>
    ) : undefined;

  const list = (
    <FeedList
      items={feed.items}
      isLoading={feed.isLoading}
      error={feed.errors[0]?.error}
      onRefresh={feed.refetch}
      onEndReached={feed.fetchNextPage}
      hasNextPage={feed.hasNextPage}
      isFetchingNextPage={feed.isFetchingNextPage}
      header={header}
      empty={empty}
      isNew={isNew}
      caughtUpKey={caughtUpKey}
      onPressItem={onPress}
      fallbackUrl="https://huggingface.co"
    />
  );
  if (width < SIDEBAR_BREAKPOINT) return list;
  // Wide screens: feed + a rail with this week's top papers and trending Spaces.
  return (
    <View style={styles.wide}>
      <View style={{ flex: 1 }}>{list}</View>
      <Sidebar />
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { flex: 1, flexDirection: 'row', maxWidth: 1180, width: '100%', alignSelf: 'center' },
  header: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  pad: { paddingHorizontal: spacing.lg },
});
