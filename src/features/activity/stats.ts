import type { ContentKind } from '@/features/feed/types';

// Pure reading-activity math (streaks, heatmap, badges). Everything is computed on-device.

export interface DayActivity {
  /** Items opened that day (detail screens or external pages). */
  count: number;
  kinds: Partial<Record<ContentKind, number>>;
}

export type ActivityDays = Record<string, DayActivity>;

/** Local calendar day key, e.g. "2026-11-15" — streaks follow the user's own day boundaries. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const addDays = (date: Date, n: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Consecutive active days ending today — or yesterday, so the streak isn't "lost" before you open the app. */
export function currentStreak(days: ActivityDays, now: Date): number {
  let cursor = days[dayKey(now)]?.count ? now : addDays(now, -1);
  let streak = 0;
  while (days[dayKey(cursor)]?.count) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(days: ActivityDays): number {
  const active = Object.keys(days)
    .filter((k) => days[k].count > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of active) {
    const [y, m, d] = k.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    run = prev && dayKey(addDays(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run);
    prev = date;
  }
  return best;
}

export interface HeatCell {
  key: string;
  count: number;
  /** 0 = none … 4 = most active, relative to the busiest day shown. */
  level: 0 | 1 | 2 | 3 | 4;
  isFuture: boolean;
}

/** GitHub-style grid: `weeks` columns × 7 rows (Mon→Sun), ending with the current week. */
export function heatmap(days: ActivityDays, now: Date, weeks = 17): HeatCell[][] {
  const mondayOffset = (now.getDay() + 6) % 7;
  const start = addDays(now, -mondayOffset - (weeks - 1) * 7);
  const today = dayKey(now);
  const columns: HeatCell[][] = [];
  let max = 0;
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = dayKey(addDays(start, w * 7 + d));
      const count = days[key]?.count ?? 0;
      max = Math.max(max, count);
      col.push({ key, count, level: 0, isFuture: key > today });
    }
    columns.push(col);
  }
  for (const col of columns)
    for (const cell of col)
      cell.level = cell.count === 0 ? 0 : (Math.min(4, Math.ceil((cell.count / Math.max(max, 1)) * 4)) as HeatCell['level']);
  return columns;
}

export interface Totals {
  total: number;
  activeDays: number;
  thisWeek: number;
  byKind: Partial<Record<ContentKind, number>>;
}

export function totals(days: ActivityDays, now: Date): Totals {
  const byKind: Partial<Record<ContentKind, number>> = {};
  let total = 0;
  let activeDays = 0;
  for (const day of Object.values(days)) {
    total += day.count;
    if (day.count) activeDays++;
    for (const [k, n] of Object.entries(day.kinds)) byKind[k as ContentKind] = (byKind[k as ContentKind] ?? 0) + (n ?? 0);
  }
  let thisWeek = 0;
  for (let i = 0; i < 7; i++) thisWeek += days[dayKey(addDays(now, -i))]?.count ?? 0;
  return { total, activeDays, thisWeek, byKind };
}

export interface Badge {
  id: string;
  emoji: string;
  title: string;
  description: string;
  earned: boolean;
  /** 0..1 progress toward the badge. */
  progress: number;
}

/** Badges reward steady, varied reading — not time spent scrolling. */
export function badges(days: ActivityDays, savedCount: number, now: Date): Badge[] {
  const t = totals(days, now);
  const longest = Math.max(longestStreak(days), currentStreak(days, now));
  const kindsTried = Object.values(t.byKind).filter((n) => (n ?? 0) > 0).length;
  const make = (id: string, emoji: string, title: string, description: string, value: number, goal: number): Badge => ({
    id,
    emoji,
    title,
    description,
    earned: value >= goal,
    progress: Math.min(1, value / goal),
  });
  return [
    make('first', '🌱', 'First step', 'Open your first item', t.total, 1),
    make('papers10', '📄', 'Paper reader', 'Read 10 papers', t.byKind.paper ?? 0, 10),
    make('papers50', '🎓', 'Scholar', 'Read 50 papers', t.byKind.paper ?? 0, 50),
    make('models10', '🧪', 'Model scout', 'Explore 10 models', t.byKind.model ?? 0, 10),
    make('explorer', '🧭', 'Explorer', 'Open papers, models, Spaces, datasets and articles', kindsTried, 5),
    make('streak3', '🔥', 'Warming up', '3-day reading streak', longest, 3),
    make('streak7', '⚡', 'Week strong', '7-day reading streak', longest, 7),
    make('streak30', '🏆', 'Habit formed', '30-day reading streak', longest, 30),
    make('curator', '🔖', 'Curator', 'Save 10 items', savedCount, 10),
  ];
}
