import { Platform, useColorScheme } from 'react-native';

import type { ContentKind } from '@/features/feed/types';
import { usePreferences } from '@/features/preferences/store';

const shared = {
  accent: '#FFD21E',
  accentStrong: '#FF9D00',
  onAccent: '#1F2937',
  danger: '#EF4444',
};

export const palette = {
  light: {
    ...shared,
    background: '#FFFFFF',
    surface: '#F9FAFB',
    surfaceElevated: '#FFFFFF',
    border: '#E5E7EB',
    text: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#6B7280',
    link: '#2563EB',
    codeBackground: '#F3F4F6',
    skeleton: '#E5E7EB',
  },
  dark: {
    ...shared,
    background: '#0B0F19',
    surface: '#111827',
    surfaceElevated: '#1F2937',
    border: '#1F2937',
    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    link: '#60A5FA',
    codeBackground: '#1F2937',
    skeleton: '#1F2937',
  },
};

export type Colors = typeof palette.light;

export const kindColor: Record<ContentKind, string> = {
  paper: '#6366F1',
  model: '#F59E0B',
  blog: '#10B981',
  community: '#EC4899',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const MAX_CONTENT_WIDTH = 760;

export const fonts = {
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  }),
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, serif',
  }),
};

export function useResolvedScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const { theme } = usePreferences();
  if (theme === 'light' || theme === 'dark') return theme;
  return system === 'dark' ? 'dark' : 'light';
}

export function useColors(): Colors {
  return palette[useResolvedScheme()];
}
