import { useCallback, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import type { FeedItem } from '@/features/feed/types';
import { itemKey } from '@/features/feed/types';
import { openItem } from '@/lib/navigation';
import { MAX_CONTENT_WIDTH, spacing, useColors } from '@/theme';

import { FeedCard } from './FeedCard';
import { ErrorState, MessageState, SkeletonList } from './states';

interface Props {
  items: FeedItem[];
  isLoading: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown>;
  onEndReached?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  header?: ReactElement | null;
  empty?: ReactElement;
  fallbackUrl?: string;
  isNew?: (item: FeedItem) => boolean;
  onPressItem?: (item: FeedItem) => void;
  showKind?: boolean;
}

export function FeedList({
  items,
  isLoading,
  error,
  onRefresh,
  onEndReached,
  hasNextPage,
  isFetchingNextPage,
  header,
  empty,
  fallbackUrl,
  isNew,
  onPressItem = openItem,
  showKind,
}: Props) {
  const c = useColors();
  // Track user-initiated refresh separately so background refetches don't show the spinner.
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const renderItem = useCallback(
    ({ item }: { item: FeedItem }) => (
      <View style={styles.cell}>
        <FeedCard item={item} onPress={onPressItem} isNew={isNew?.(item)} showKind={showKind} />
      </View>
    ),
    [onPressItem, isNew, showKind],
  );

  let body: ReactElement | null = null;
  if (isLoading) body = <SkeletonList />;
  else if (error && !items.length) body = <ErrorState error={error} onRetry={() => void onRefresh()} fallbackUrl={fallbackUrl} />;
  else if (!items.length) body = empty ?? <MessageState icon="file-tray-outline" title="Nothing here yet" />;

  return (
    <FlatList
      data={isLoading ? [] : items}
      keyExtractor={itemKey}
      renderItem={renderItem}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={body ?? undefined}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={c.textMuted} /> : <View style={styles.footer} />
      }
      onEndReached={hasNextPage && !isFetchingNextPage ? onEndReached : undefined}
      onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.textMuted} colors={[c.accentStrong]} />}
      contentContainerStyle={styles.content}
      style={{ backgroundColor: c.background }}
      initialNumToRender={8}
      windowSize={11}
      removeClippedSubviews
      keyboardDismissMode="on-drag"
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  cell: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm / 1.5,
  },
  footer: { height: 64, alignItems: 'center', justifyContent: 'center' },
});
