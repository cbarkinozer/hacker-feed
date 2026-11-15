import { useCallback, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { FeedItem } from '@/features/feed/types';
import { itemKey } from '@/features/feed/types';
import { usePreferences } from '@/features/preferences/store';
import { openItem } from '@/lib/navigation';
import { MAX_CONTENT_WIDTH, MAX_GRID_WIDTH, spacing, useColors } from '@/theme';

import { FeedCard } from './FeedCard';
import { AppText } from './ui';
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
  /** Show #1, #2… positions (weekly/monthly top lists). */
  ranked?: boolean;
  /** Lay cards out in 2–3 columns on wide screens (image-led lists like the blog). */
  grid?: boolean;
  /** itemKey of the first item older than the last visit; shows a "caught up" divider above it. */
  caughtUpKey?: string;
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
  ranked,
  grid,
  caughtUpKey,
}: Props) {
  const c = useColors();
  const { density } = usePreferences();
  const { width } = useWindowDimensions();
  const columns = grid && density === 'comfortable' ? (width >= 1300 ? 3 : width >= 860 ? 2 : 1) : 1;
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
    ({ item, index }: { item: FeedItem; index: number }) => (
      <View style={columns > 1 ? [styles.gridCell, { width: `${100 / columns}%` }] : styles.cell}>
        {columns === 1 && caughtUpKey === itemKey(item) ? (
          <AppText variant="caption" tone="muted" style={styles.caughtUp} accessibilityRole="header">
            ✓ You&apos;re all caught up. Older items below
          </AppText>
        ) : null}
        <FeedCard
          item={item}
          onPress={onPressItem}
          isNew={isNew?.(item)}
          showKind={showKind}
          rank={ranked ? index + 1 : undefined}
          density={density}
        />
      </View>
    ),
    [onPressItem, isNew, showKind, ranked, density, columns, caughtUpKey],
  );

  let body: ReactElement | null = null;
  if (isLoading) body = <SkeletonList />;
  else if (error && !items.length) body = <ErrorState error={error} onRetry={() => void onRefresh()} fallbackUrl={fallbackUrl} />;
  else if (!items.length) body = empty ?? <MessageState icon="file-tray-outline" title="Nothing here yet" />;

  return (
    <FlatList
      // numColumns can't change on the fly; remount when the column count changes.
      key={`cols-${columns}`}
      numColumns={columns}
      columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
      data={isLoading ? [] : items}
      keyExtractor={itemKey}
      renderItem={renderItem}
      ListHeaderComponent={header ?? undefined}
      ListEmptyComponent={body ?? undefined}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator style={styles.footer} color={c.textMuted} />
        ) : !hasNextPage && items.length > 0 ? (
          <View style={styles.footer}>
            <AppText variant="caption" tone="muted">
              That&apos;s everything for now ✓
            </AppText>
          </View>
        ) : (
          <View style={styles.footer} />
        )
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
  gridRow: { width: '100%', maxWidth: MAX_GRID_WIDTH, alignSelf: 'center', paddingHorizontal: spacing.sm },
  gridCell: { padding: spacing.sm },
  caughtUp: { textAlign: 'center', paddingVertical: spacing.md },
  footer: { height: 64, alignItems: 'center', justifyContent: 'center' },
});
