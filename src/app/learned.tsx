import { ScrollView, StyleSheet, View } from 'react-native';

import { Section } from '@/components/DetailParts';
import { AppText, Button, ContentColumn, IconButton } from '@/components/ui';
import { HALF_LIFE_DAYS, learnedProfile, type LearnedEntry } from '@/features/activity/affinity';
import { forgetLearned, resetAffinity, restoreDismissed, useAffinity, useDismissed } from '@/features/activity/store';
import { spacing, useColors } from '@/theme';

function Row({ entry, max, tone }: { entry: LearnedEntry; max: number; tone: 'up' | 'down' }) {
  const c = useColors();
  const color = tone === 'up' ? c.accentStrong : c.textMuted;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText variant="body" numberOfLines={1}>
          {entry.key}
          <AppText variant="caption" tone="muted">
            {entry.type === 'author' ? '  author' : ''}
          </AppText>
        </AppText>
        <View style={[styles.track, { backgroundColor: c.skeleton }]}>
          <View style={{ width: `${Math.max(6, (Math.abs(entry.weight) / max) * 100)}%`, height: '100%', backgroundColor: color }} />
        </View>
      </View>
      <IconButton icon="close" size={18} color={c.textMuted} label={`Forget ${entry.key}`} onPress={() => forgetLearned(entry)} />
    </View>
  );
}

/** Shows what For You has learned, and lets you remove any of it. */
export default function LearnedScreen() {
  const c = useColors();
  const affinity = useAffinity();
  const hidden = useDismissed().length;
  const { liked, muted } = learnedProfile(affinity);
  const maxUp = Math.max(1, ...liked.map((e) => e.weight));
  const maxDown = Math.max(1, ...muted.map((e) => Math.abs(e.weight)));
  const empty = !liked.length && !muted.length;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={styles.scroll}>
      <ContentColumn>
        <AppText variant="caption" tone="muted">
          For You learns from what you open, read for a while and save, and from what you hide or scroll past. Weights fade with a half-life
          of {HALF_LIFE_DAYS} days, so it follows your current interests. Everything stays on this device.
        </AppText>

        {empty ? (
          <AppText variant="body" tone="muted" style={{ marginTop: spacing.lg }}>
            Nothing learned yet. Open and save a few things, and your interests will show up here.
          </AppText>
        ) : null}

        {liked.length ? (
          <Section title="You like">
            {liked.map((e) => (
              <Row key={`${e.type}:${e.key}`} entry={e} max={maxUp} tone="up" />
            ))}
          </Section>
        ) : null}

        {muted.length ? (
          <Section title="Showing less of">
            {muted.map((e) => (
              <Row key={`${e.type}:${e.key}`} entry={e} max={maxDown} tone="down" />
            ))}
          </Section>
        ) : null}

        <Section title="Hidden items">
          <AppText variant="caption" tone="muted">
            {hidden ? `${hidden} item${hidden === 1 ? '' : 's'} hidden with “show less like this”.` : 'Nothing hidden.'}
          </AppText>
          {hidden ? <Button label="Show hidden items again" icon="eye-outline" variant="secondary" onPress={restoreDismissed} /> : null}
        </Section>

        {!empty || hidden ? (
          <View style={{ marginTop: spacing.lg }}>
            <Button label="Reset everything learned" icon="refresh" variant="secondary" onPress={resetAffinity} />
          </View>
        ) : null}
      </ContentColumn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
});
