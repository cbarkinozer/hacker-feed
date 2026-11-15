import type { FeedItem } from '@/features/feed/types';
import { recordSave } from '@/features/activity/store';
import { itemKey } from '@/features/feed/types';
import { createPersistentStore, useStore } from '@/lib/store';

export interface SavedEntry {
  item: FeedItem;
  savedAt: number;
  /** Private note kept on-device; searchable. */
  note?: string;
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
  const saving = !savedStore.get().entries[key];
  savedStore.set((s) => {
    const entries = { ...s.entries };
    if (saving) entries[key] = { item, savedAt: Date.now() };
    else delete entries[key];
    return { ...s, entries };
  });
  if (saving) recordSave(item);
}

export function setNote(key: string, note: string) {
  savedStore.set((s) => {
    const entry = s.entries[key];
    if (!entry) return s;
    const trimmed = note.trim();
    return { ...s, entries: { ...s.entries, [key]: { ...entry, note: trimmed || undefined } } };
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
export const useSavedNote = (item: Pick<FeedItem, 'kind' | 'id'>) => useStore(savedStore, (s) => s.entries[itemKey(item)]?.note ?? '');
export const useSavedEntries = () => useStore(savedStore, (s) => s.entries);

export function sortedEntries(entries: Record<string, SavedEntry>): SavedEntry[] {
  return Object.values(entries).sort((a, b) => b.savedAt - a.savedAt);
}

/** Local full-text match over saved items: every word must appear in title, summary, authors, tags or your note. */
export function searchSaved(items: FeedItem[], query: string, notes: Record<string, string | undefined> = {}): FeedItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((i) => {
    const hay = `${i.title} ${i.summary ?? ''} ${i.authors.join(' ')} ${i.tags.join(' ')} ${i.id} ${notes[itemKey(i)] ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
