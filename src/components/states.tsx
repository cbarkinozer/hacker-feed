import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';

import { describeError } from '@/lib/http';
import { openExternal } from '@/lib/navigation';
import { radius, spacing, useColors } from '@/theme';

import { AppText, Button, Icon, type IconName } from './ui';

function Pulse({ style }: { style: object }) {
  const c = useColors();
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ backgroundColor: c.skeleton, borderRadius: radius.sm, opacity }, style]} />;
}

export function SkeletonCard() {
  const c = useColors();
  return (
    <View style={[styles.card, { backgroundColor: c.surfaceElevated, borderColor: c.border }]} accessible={false}>
      <Pulse style={{ width: 70, height: 16, borderRadius: radius.pill }} />
      <Pulse style={{ width: '90%', height: 18 }} />
      <Pulse style={{ width: '65%', height: 18 }} />
      <Pulse style={{ width: '40%', height: 12 }} />
    </View>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonBlock({ lines = 6 }: { lines?: number }) {
  return (
    <View style={{ gap: spacing.sm }} accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, i) => (
        <Pulse key={i} style={{ width: i % 3 === 2 ? '60%' : '100%', height: 14 }} />
      ))}
    </View>
  );
}

export function MessageState({
  icon,
  title,
  message,
  children,
}: {
  icon: IconName;
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.message} accessibilityRole="summary">
      <Icon name={icon} size={36} />
      <AppText variant="subtitle" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="caption" tone="muted" style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

/** Error with retry plus a fallback link to the same content on huggingface.co. */
export function ErrorState({ error, onRetry, fallbackUrl }: { error: unknown; onRetry?: () => void; fallbackUrl?: string }) {
  return (
    <MessageState icon="cloud-offline-outline" title="Couldn't load this" message={describeError(error)}>
      {onRetry ? <Button label="Try again" icon="refresh" onPress={onRetry} /> : null}
      {fallbackUrl ? (
        <Button label="Open on Hugging Face" icon="open-outline" variant="secondary" onPress={() => openExternal(fallbackUrl)} />
      ) : null}
    </MessageState>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, padding: spacing.lg },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  message: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  center: { textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
});
