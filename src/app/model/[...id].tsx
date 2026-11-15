import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ActionBar, LinkRow, Section, StatBox } from '@/components/DetailParts';
import { Markdown } from '@/components/Markdown';
import { ErrorState, SkeletonBlock } from '@/components/states';
import { AppText, Button, Chip, ContentColumn, KindBadge } from '@/components/ui';
import { queryKeys } from '@/features/feed/hooks';
import { fetchModel, fetchModelCard, modelToFeedItem, modelUrl, type Benchmark } from '@/features/models/api';
import { isFollowingHandle, toggleFollow, usePreferences } from '@/features/preferences/store';
import { compactNumber, relativeTime } from '@/lib/format';
import { recallItem } from '@/lib/item-cache';
import { HF_BASE } from '@/lib/http';
import { splitFrontmatter } from '@/lib/markdown';
import { radius, spacing, useColors } from '@/theme';

function BenchmarkTable({ rows }: { rows: Benchmark[] }) {
  const c = useColors();
  return (
    <View style={[styles.table, { borderColor: c.border }]}>
      {rows.map((r, i) => (
        <View
          key={i}
          style={[styles.benchRow, { borderColor: c.border }, i === rows.length - 1 && { borderBottomWidth: 0 }]}
          accessible
          accessibilityLabel={`${r.dataset}, ${r.metric}: ${r.value}`}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" numberOfLines={1}>
              {r.dataset}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1}>
              {r.metric}
            </AppText>
          </View>
          <AppText variant="subtitle">{r.value}</AppText>
        </View>
      ))}
    </View>
  );
}

const CARD_PREVIEW_BLOCKS = 60;

export default function ModelScreen() {
  const params = useLocalSearchParams<{ id: string[] | string }>();
  const id = Array.isArray(params.id) ? params.id.join('/') : params.id;
  const c = useColors();
  const cached = recallItem('model', id);
  const following = usePreferences().following;
  const [expanded, setExpanded] = useState(false);

  const model = useQuery({
    queryKey: queryKeys.model(id),
    queryFn: ({ signal }) => fetchModel(id, signal),
  });
  const card = useQuery({
    queryKey: queryKeys.modelCard(id),
    queryFn: ({ signal }) => fetchModelCard(id, signal),
  });
  const cardBody = useMemo(() => (card.data ? splitFrontmatter(card.data).body : null), [card.data]);

  const m = model.data;
  const item = m ? modelToFeedItem(m) : cached;
  if (!item && model.error) return <ErrorState error={model.error} onRetry={() => model.refetch()} fallbackUrl={modelUrl(id)} />;
  const author = m?.author ?? id.split('/')[0];
  const isFollowing = isFollowingHandle(following, author);

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={{ backgroundColor: c.background }}>
      <ContentColumn>
        <KindBadge kind="model" />
        <AppText variant="caption" tone="secondary" style={{ marginTop: spacing.md }}>
          {author}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {m?.name ?? id.split('/').slice(1).join('/') ?? id}
        </AppText>
        <View style={[styles.chips, { marginTop: spacing.sm }]}>
          {m?.pipelineTag ? <Chip label={m.pipelineTag} /> : null}
          {m?.library ? <Chip label={m.library} /> : null}
          {m?.license ? <Chip label={`license: ${m.license}`} /> : null}
          {m?.gated ? <Chip label="gated" /> : null}
        </View>

        <View style={styles.stats}>
          <StatBox value={compactNumber(m?.downloads ?? item?.downloads)} label="downloads / mo" />
          <StatBox value={compactNumber(m?.likes ?? item?.likes)} label="likes" />
          {m?.lastModified ? <StatBox value={relativeTime(m.lastModified)} label="updated" /> : null}
        </View>

        {item ? (
          <ActionBar
            item={item}
            extra={
              <Button
                label={isFollowing ? `Following ${author}` : `Follow ${author}`}
                icon={isFollowing ? 'checkmark' : 'person-add-outline'}
                variant="secondary"
                onPress={() => toggleFollow(author)}
              />
            }
          />
        ) : null}

        {m?.benchmarks.length ? (
          <Section title="Reported results">
            <BenchmarkTable rows={m.benchmarks} />
            <AppText variant="caption" tone="muted">
              Self-reported in the model card metadata.
            </AppText>
          </Section>
        ) : null}

        <Section title="Model card">
          {card.isPending ? (
            <SkeletonBlock lines={8} />
          ) : card.error ? (
            <ErrorState error={card.error} onRetry={() => card.refetch()} fallbackUrl={modelUrl(id)} />
          ) : cardBody?.trim() ? (
            <>
              <Markdown source={cardBody} base={`${HF_BASE}/${id}/resolve/main/`} maxBlocks={expanded ? 600 : CARD_PREVIEW_BLOCKS} />
              {!expanded ? (
                <View style={{ marginTop: spacing.md }}>
                  <Button label="Show full model card" icon="chevron-down" variant="secondary" onPress={() => setExpanded(true)} />
                </View>
              ) : null}
            </>
          ) : (
            <AppText tone="muted">This model has no model card.</AppText>
          )}
        </Section>

        {m?.tags.length ? (
          <Section title="Tags">
            <View style={styles.chips}>
              {m.tags.slice(0, 24).map((t) => (
                <Chip key={t} label={t} />
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Links">
          <LinkRow icon="happy-outline" label="Open on Hugging Face" detail={modelUrl(id)} url={modelUrl(id)} />
          <LinkRow icon="folder-outline" label="Files and versions" url={`${modelUrl(id)}/tree/main`} />
          {m?.baseModels.map((b) => (
            <LinkRow key={b} icon="git-branch-outline" label="Base model" detail={b} url={modelUrl(b)} />
          ))}
          {m?.spaces.slice(0, 5).map((s) => (
            <LinkRow key={s} icon="rocket-outline" label="Space" detail={s} url={`${HF_BASE}/spaces/${s}`} />
          ))}
        </Section>
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
