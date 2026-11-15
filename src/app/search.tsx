import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { FeedList } from '@/components/FeedList';
import { MessageState } from '@/components/states';
import { ContentColumn, Icon, IconButton, Segmented } from '@/components/ui';
import type { FeedItem } from '@/features/feed/types';
import { fetchModels, modelToFeedItem } from '@/features/models/api';
import { paperToFeedItem, searchPapers } from '@/features/papers/api';
import { rememberItems, setPaperSequence } from '@/lib/item-cache';
import { openItem } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

type Scope = 'models' | 'papers';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'models', label: 'Models' },
  { value: 'papers', label: 'Papers' },
];

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchScreen() {
  const c = useColors();
  const [text, setText] = useState('');
  const [scope, setScope] = useState<Scope>('models');
  // Paper search has a much lower rate limit (50 req / 5 min), so debounce it harder.
  const query = useDebounced(text.trim(), scope === 'papers' ? 700 : 400);
  const enabled = query.length >= 2;

  const result = useQuery({
    queryKey: ['search', scope, query],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
    queryFn: async ({ signal }): Promise<FeedItem[]> =>
      scope === 'models'
        ? (
            await fetchModels({
              search: query,
              sort: 'downloads',
              limit: 30,
              signal,
            })
          ).items.map(modelToFeedItem)
        : (await searchPapers(query, signal)).map(paperToFeedItem),
  });

  const items = useMemo(() => {
    const list = enabled ? (result.data ?? []) : [];
    rememberItems(list);
    return list;
  }, [enabled, result.data]);

  const onPress = useCallback(
    (item: FeedItem) => {
      if (item.kind === 'paper') setPaperSequence(items.map((i) => i.id));
      openItem(item);
    },
    [items],
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ContentColumn style={styles.top}>
        <View style={[styles.inputWrap, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Icon name="search" />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={scope === 'models' ? 'Search models, e.g. "qwen"' : 'Search papers, e.g. "diffusion"'}
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.text }]}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="never"
            accessibilityLabel="Search query"
          />
          {text ? <IconButton icon="close-circle" label="Clear search" onPress={() => setText('')} size={18} /> : null}
        </View>
        <Segmented options={SCOPES} value={scope} onChange={setScope} />
      </ContentColumn>
      <FeedList
        items={items}
        isLoading={enabled && result.isPending}
        error={result.error}
        onRefresh={result.refetch}
        onPressItem={onPress}
        showKind={false}
        fallbackUrl={`https://huggingface.co/${scope === 'models' ? 'models' : 'papers'}?search=${encodeURIComponent(query)}`}
        empty={
          enabled ? (
            <MessageState icon="search-outline" title="No results" message={`Nothing matched "${query}".`} />
          ) : (
            <MessageState icon="search-outline" title={`Search ${scope}`} message="Type at least two characters." />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.sm },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: spacing.sm },
});
