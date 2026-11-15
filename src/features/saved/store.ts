import type { FeedItem } from '@/features/feed/types';
import { itemKey } from '@/features/feed/types';
import { createPersistentStore, useStore } from '@/lib/store';

export interface SavedEntry {
  item: FeedItem;
  savedAt: number;
}

interface SavedState {
  version: 1;
  entries: Record<string, SavedEntry>;
}

export const savedStore = createPersistentStore<SavedState>('hfm.saved.v1', { version: 1, entries: {} }, (raw) => {
  const r = raw as Partial<SavedState> | null;
  return {
    version: 1,
    entries: r && typeof r.entries === 'object' && r.entries ? r.entries : {},
  };
});

export function toggleSaved(item: FeedItem) {
  const key = itemKey(item);
  savedStore.set((s) => {
    const entries = { ...s.entries };
    if (entries[key]) delete entries[key];
    else entries[key] = { item, savedAt: Date.now() };
    return { ...s, entries };
  });
}

export function removeSaved(key: string) {
  savedStore.set((s) => {
    const entries = { ...s.entries };
    delete entries[key];
    return { ...s, entries };
  });
}

export const useIsSaved = (item: Pick<FeedItem, 'kind' | 'id'>) => useStore(savedStore, (s) => !!s.entries[itemKey(item)]);
export const useSavedEntries = () => useStore(savedStore, (s) => s.entries);

export function sortedEntries(entries: Record<string, SavedEntry>): SavedEntry[] {
  return Object.values(entries).sort((a, b) => b.savedAt - a.savedAt);
}
