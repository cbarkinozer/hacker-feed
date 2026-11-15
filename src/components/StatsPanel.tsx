import { ScrollView, StyleSheet, View } from 'react-native';

import { badges, currentStreak, heatmap, longestStreak, totals, type HeatCell } from '@/features/activity/stats';
import { useActivityDays } from '@/features/activity/store';
import { usePreferences } from '@/features/preferences/store';
import { KIND_LABEL, type ContentKind } from '@/features/feed/types';
import { kindColor, radius, spacing, useColors } from '@/theme';

import { BadgeStrip } from './Badges';
import { AppText } from './ui';

const CELL = 12;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const GAP = 3;

function Heatmap({ columns }: { columns: HeatCell[][] }) {
  const c = useColors();
  // Empty cells use a translucent text tint so they stay visible on the card in both themes.
  const shades = [`${c.textMuted}33`, `${c.accentStrong}55`, `${c.accentStrong}88`, `${c.accentStrong}BB`, c.accentStrong];
  const active = columns.flat().filter((d) => d.count > 0).length;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // Start scrolled to the most recent weeks on narrow screens.
      ref={(r) => r?.scrollToEnd({ animated: false })}
      accessible
      accessibilityLabel={`Reading activity: ${active} active days in the last ${columns.length} weeks`}>
      <View style={styles.heatmap}>
        {columns.map((col, i) => (
          <View key={i} style={styles.heatCol}>
            {col.map((cell) => (
              <View key={cell.key} style={[styles.heatCell, { backgroundColor: cell.isFuture ? 'transparent' : shades[cell.level] }]} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

/** Streak, GitHub-style activity grid, per-type totals and badges, from on-device history. */
export function StatsPanel({ savedCount }: { savedCount: number }) {
  const c = useColors();
  const days = useActivityDays();
  const { weeklyGoal } = usePreferences();
  const now = new Date();
  const streak = currentStreak(days, now);
  const t = totals(days, now);
  const earned = badges(days, savedCount, now);
  const kinds = (Object.entries(t.byKind) as [ContentKind, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  return (
    <View style={[styles.panel, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
      <View style={styles.streakRow}>
        <AppText style={styles.flame}>{streak ? '🔥' : '🌱'}</AppText>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{streak ? `${streak}-day streak` : 'Start a streak'}</AppText>
          <AppText variant="caption" tone="muted">
            {streak
              ? `Best: ${plural(Math.max(streak, longestStreak(days)), 'day')} · open one thing a day to keep it going`
              : 'Read one paper, model or article a day.'}
          </AppText>
        </View>
      </View>

      <View style={styles.metrics}>
        <Metric value={String(t.thisWeek)} label="this week" />
        <Metric value={String(t.total)} label="all time" />
        <Metric value={String(t.activeDays)} label="active days" />
      </View>

      <View accessible accessibilityLabel={`Weekly goal: ${t.thisWeek} of ${weeklyGoal}`} style={{ gap: 4 }}>
        <AppText variant="caption" tone="muted">
          {t.thisWeek >= weeklyGoal
            ? `🎯 Weekly goal reached · ${t.thisWeek}/${weeklyGoal}`
            : `Weekly goal · ${t.thisWeek}/${weeklyGoal} (last 7 days)`}
        </AppText>
        <View style={[styles.progress, { backgroundColor: c.skeleton, width: '100%' }]}>
          <View
            style={{
              width: `${Math.min(1, t.thisWeek / weeklyGoal) * 100}%`,
              height: '100%',
              backgroundColor: c.accentStrong,
              borderRadius: 2,
            }}
          />
        </View>
      </View>

      <Heatmap columns={heatmap(days, now)} />

      {kinds.length ? (
        <View style={styles.kinds}>
          {kinds.map(([k, n]) => (
            <View key={k} style={styles.kind}>
              <View style={[styles.dot, { backgroundColor: kindColor[k] }]} />
              <AppText variant="caption" tone="secondary">
                {n} {KIND_LABEL[k].toLowerCase()}
                {n === 1 ? '' : 's'}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <AppText variant="label" tone="muted" style={{ marginTop: spacing.sm }}>
        BADGES · {earned.filter((b) => b.earned).length}/{earned.length} earned · {earned.filter((b) => b.tier === 3).length} gold
      </AppText>
      <BadgeStrip badges={earned} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flame: { fontSize: 36, lineHeight: 44 },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: { flex: 1 },
  heatmap: { flexDirection: 'row', gap: GAP },
  heatCol: { gap: GAP },
  heatCell: { width: CELL, height: CELL, borderRadius: 3 },
  kinds: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  progress: { height: 4, borderRadius: 2, overflow: 'hidden' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
