import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { TIER_NAME, type Badge, type Tier } from '@/features/activity/stats';
import { radius, spacing, useColors } from '@/theme';

import { AppText } from './ui';

// Medal metals: ring, face tint and label colour per tier.
const METAL: Record<Exclude<Tier, 0>, { ring: string; face: string; label: string }> = {
  1: { ring: '#CD7F32', face: '#CD7F3226', label: '#B8691F' },
  2: { ring: '#B4BCC8', face: '#B4BCC838', label: '#8A94A3' },
  3: { ring: '#FFC400', face: '#FFC40033', label: '#D99A00' },
};
const SIZE = 64;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** A light band that sweeps across the medal, so gold visibly glints. Skipped when reduced motion is on. */
function Shine() {
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(x, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, x]);
  if (reduced) return null;
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-SIZE, SIZE * 1.4] });
  return <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX }, { skewX: '-20deg' }] }]} />;
}

function Medal({ badge }: { badge: Badge }) {
  const c = useColors();
  const metal = badge.tier > 0 ? METAL[badge.tier as 1 | 2 | 3] : null;
  return (
    // The glow lives on an outer layer: a view that clips its children (for the shine) would also clip its own shadow on iOS.
    <View style={[styles.medalOuter, badge.tier === 3 && styles.goldGlow, badge.tier === 3 && { shadowColor: METAL[3].ring }]}>
      <View style={[styles.medal, { borderColor: metal?.ring ?? c.border, backgroundColor: metal?.face ?? c.surface }]}>
        <AppText style={[styles.emoji, !metal && { opacity: 0.35 }]}>{badge.emoji}</AppText>
        {badge.tier === 3 ? <Shine /> : null}
      </View>
    </View>
  );
}

/** Horizontal strip of tiered badges: bronze, silver, gold (gold shines). Locked ones show progress to bronze. */
export function BadgeStrip({ badges }: { badges: Badge[] }) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {badges.map((b) => {
        const metal = b.tier > 0 ? METAL[b.tier as 1 | 2 | 3] : null;
        const status = b.next === null ? 'Max level' : `${b.value}/${b.next} ${b.unit}`;
        return (
          <View
            key={b.id}
            accessible
            accessibilityLabel={`${b.title}, ${TIER_NAME[b.tier]}. ${status}`}
            style={[styles.card, { borderColor: metal?.ring ?? c.border, backgroundColor: c.surface }]}>
            <Medal badge={b} />
            <AppText variant="caption" style={{ fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
              {b.title}
            </AppText>
            <AppText variant="label" style={{ color: metal?.label ?? c.textMuted }}>
              {TIER_NAME[b.tier].toUpperCase()}
            </AppText>
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.status}>
              {status}
            </AppText>
            {b.next !== null ? (
              <View style={[styles.progress, { backgroundColor: c.skeleton }]}>
                <View style={{ width: `${b.progress * 100}%`, height: '100%', backgroundColor: metal?.ring ?? c.accentStrong }} />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.sm, paddingVertical: spacing.xs },
  card: { width: 112, alignItems: 'center', gap: 3, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  medalOuter: { width: SIZE, height: SIZE, borderRadius: SIZE / 2 },
  medal: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  goldGlow: { shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  emoji: { fontSize: 28, lineHeight: 34 },
  shine: { position: 'absolute', top: -8, bottom: -8, width: 16, backgroundColor: '#FFFFFFAA' },
  status: { fontSize: 11 },
  progress: { width: '80%', height: 4, borderRadius: 2, marginTop: 2, overflow: 'hidden' },
});
