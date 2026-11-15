import { StyleSheet, View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { AppText } from './ui';

export const UNOFFICIAL_TEXT = 'Unofficial client. Not affiliated with or endorsed by Hugging Face.';

export function UnofficialNotice({ compact }: { compact?: boolean }) {
  const c = useColors();
  return (
    <View
      style={[styles.box, compact && styles.compact, { backgroundColor: `${c.accent}26`, borderColor: `${c.accent}66` }]}
      accessibilityRole="text">
      <AppText variant="caption" tone="secondary">
        🤗 {UNOFFICIAL_TEXT}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  compact: { paddingVertical: 6 },
});
