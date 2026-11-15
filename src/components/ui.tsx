import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import type { ContentKind } from '@/features/feed/types';
import { KIND_LABEL } from '@/features/feed/types';
import { kindColor, MAX_CONTENT_WIDTH, radius, spacing, useColors } from '@/theme';

type Variant = 'display' | 'title' | 'subtitle' | 'body' | 'caption' | 'label';

const variantStyle: Record<Variant, TextStyle> = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  caption: { fontSize: 13, lineHeight: 18 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
};

export function AppText({
  variant = 'body',
  tone = 'primary',
  style,
  ...rest
}: TextProps & {
  variant?: Variant;
  tone?: 'primary' | 'secondary' | 'muted' | 'link';
}) {
  const c = useColors();
  const color = {
    primary: c.text,
    secondary: c.textSecondary,
    muted: c.textMuted,
    link: c.link,
  }[tone];
  return <Text maxFontSizeMultiplier={1.8} {...rest} style={[variantStyle[variant], { color }, style]} />;
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 18, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.textMuted} />;
}

export function KindBadge({ kind }: { kind: ContentKind }) {
  const color = kindColor[kind];
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]} accessibilityLabel={`${KIND_LABEL[kind]}`}>
      <View style={[styles.badgeDot, { backgroundColor: color }]} />
      <Text style={[variantStyle.label, { color }]} maxFontSizeMultiplier={1.4}>
        {KIND_LABEL[kind].toUpperCase()}
      </Text>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? c.accent : c.surface,
          borderColor: selected ? c.accent : c.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <Text
        style={[
          variantStyle.caption,
          {
            color: selected ? c.onAccent : c.textSecondary,
            fontWeight: selected ? '600' : '400',
          },
        ]}
        maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.segment,
              {
                backgroundColor: active ? c.text : c.surface,
                borderColor: active ? c.text : c.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}>
            <Text
              style={[
                variantStyle.caption,
                {
                  color: active ? c.background : c.textSecondary,
                  fontWeight: '600',
                },
              ]}
              maxFontSizeMultiplier={1.4}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={14} />
      <AppText variant="caption" tone="muted">
        {value}
      </AppText>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.5 : 1 }, style]}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Button({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const c = useColors();
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? c.accent : c.surface,
          borderColor: primary ? c.accent : c.border,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}>
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          <Icon name={icon} size={16} color={primary ? c.onAccent : c.text} />
        </View>
      ) : null}
      <Text style={[variantStyle.caption, { color: primary ? c.onAccent : c.text, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

/** Centers content to a readable column on tablets and desktop web. */
export function ContentColumn({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.column, style]}>{children}</View>;
}

export function Divider() {
  const c = useColors();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.border,
        marginVertical: spacing.lg,
      }}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmented: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    minHeight: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
});
