import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { StatsPanel } from '@/components/StatsPanel';
import { MessageState } from '@/components/states';
import { AppText, Button, ContentColumn, Segmented } from '@/components/ui';
import { useHfSession } from '@/features/auth/session';
import type { ContentKind, FeedItem } from '@/features/feed/types';
import { sortedEntries, useSavedEntries } from '@/features/saved/store';
import { setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';
import { spacing } from '@/theme';

type Filter = 'all' | ContentKind;
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'paper', label: 'Papers' },
  { value: 'model', label: 'Models' },
  { value: 'space', label: 'Spaces' },
  { value: 'dataset', label: 'Datasets' },
  { value: 'blog', label: 'Blog' },
  { value: 'community', label: 'Articles' },
  { value: 'hn', label: 'HN' },
  { value: 'video', label: 'Videos' },
  { value: 'kaggle', label: 'Kaggle' },
];

/** Personal space: reading stats and saved items (all on-device). */
export default function YouScreen() {
  const entries = useSavedEntries();
  const session = useHfSession();
  const [filter, setFilter] = useState<Filter>('all');
  const all = useMemo(() => sortedEntries(entries).map((e) => e.item), [entries]);
  const items = useMemo(() => all.filter((i) => filter === 'all' || i.kind === filter), [all, filter]);
  const onPress = useCallback(
    (item: FeedItem) => {
      setPaperSequence(items.filter((i) => i.kind === 'paper').map((i) => i.id));
      openItem(item);
    },
    [items],
  );

  return (
    <FeedList
      items={items}
      isLoading={false}
      onRefresh={async () => undefined}
      onPressItem={onPress}
      header={
        <ContentColumn>
          <View style={styles.account}>
            {session ? (
              <AppText variant="caption" tone="muted">
                🤗 Signed in to Hugging Face as {session.username}
              </AppText>
            ) : (
              <Button
                label="Sign in with Hugging Face"
                icon="log-in-outline"
                variant="secondary"
                onPress={() => router.push('/settings')}
              />
            )}
          </View>
          <StatsPanel savedCount={all.length} />
          <AppText variant="subtitle" accessibilityRole="header" style={styles.heading}>
            Saved · {all.length}
          </AppText>
          <Segmented options={FILTERS} value={filter} onChange={setFilter} />
        </ContentColumn>
      }
      empty={
        <MessageState
          icon="bookmark-outline"
          title="No saved items"
          message="Tap the bookmark on any paper, model, or article to keep it here. Saved items stay on this device."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  account: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, alignItems: 'flex-start' },
  heading: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
});
