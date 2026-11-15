import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { MessageState } from '@/components/states';
import { AppText, Button, ContentColumn, Segmented } from '@/components/ui';
import { UnofficialNotice } from '@/components/UnofficialNotice';
import { useHomeFeed, type HomeMode } from '@/features/feed/hooks';
import { isNewSince } from '@/features/feed/rank';
import { KIND_LABEL, type FeedItem } from '@/features/feed/types';
import { usePreferences } from '@/features/preferences/store';
import { setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';
import { spacing } from '@/theme';

const MODES: { value: HomeMode; label: string }[] = [
  { value: 'forYou', label: 'For You' },
  { value: 'latest', label: 'Latest' },
  { value: 'following', label: 'Following' },
];

export default function HomeScreen() {
  const [mode, setMode] = useState<HomeMode>('forYou');
  const feed = useHomeFeed(mode);
  const prefs = usePreferences();
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

  return (
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
      onPressItem={onPress}
      fallbackUrl="https://huggingface.co"
    />
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  pad: { paddingHorizontal: spacing.lg },
});
