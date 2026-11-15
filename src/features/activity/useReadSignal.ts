import { useEffect } from 'react';

import type { ContentKind } from '@/features/feed/types';

import { recordRead } from './store';

/** Counts a detail page as "read" once it has stayed open this long. */
export const READ_AFTER_MS = 30_000;

export function useReadSignal(kind: ContentKind, id: string | undefined) {
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => recordRead({ kind, id }), READ_AFTER_MS);
    return () => clearTimeout(t);
  }, [kind, id]);
}
