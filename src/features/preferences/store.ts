import type { ContentKind } from '@/features/feed/types';
import { createPersistentStore, useStore } from '@/lib/store';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Preferences {
  theme: ThemePreference;
  /** Kinds shown in the Home feed. */
  homeKinds: ContentKind[];
  /** Topic terms that boost items in For You (lowercase). */
  interests: string[];
  /** HF users/orgs followed locally, original casing (the API `author` filter is case-sensitive). */
  following: string[];
  /** Timestamp of the previous app session, for "new" badges. */
  lastVisit: number | null;
}

export const ALL_KINDS: ContentKind[] = ['paper', 'model', 'blog', 'community'];

export const SUGGESTED_INTERESTS = [
  'llm',
  'agents',
  'reasoning',
  'robotics',
  'vision',
  'multimodal',
  'diffusion',
  'speech',
  'reinforcement learning',
  'benchmark',
  'text-generation',
  'text-to-image',
  'image-text-to-text',
  'automatic-speech-recognition',
  'quantization',
  'gguf',
];

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  homeKinds: ALL_KINDS,
  interests: [],
  following: [],
  lastVisit: null,
};

const uniqLower = (xs: unknown) =>
  Array.isArray(xs)
    ? [
        ...new Set(
          xs
            .filter((x): x is string => typeof x === 'string')
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean),
        ),
      ]
    : [];

const uniqHandles = (xs: unknown) => {
  const seen = new Set<string>();
  return (Array.isArray(xs) ? xs : [])
    .filter((x): x is string => typeof x === 'string' && !!x.trim())
    .map((x) => x.trim())
    .filter((x) => !seen.has(x.toLowerCase()) && !!seen.add(x.toLowerCase()));
};

/** Case-insensitive membership check for followed handles. */
export const isFollowingHandle = (following: string[], handle: string) => following.some((h) => h.toLowerCase() === handle.toLowerCase());

export const preferencesStore = createPersistentStore<Preferences>('hfm.preferences.v1', DEFAULT_PREFERENCES, (raw) => {
  const r = (raw ?? {}) as Partial<Preferences>;
  const kinds = Array.isArray(r.homeKinds) ? r.homeKinds.filter((k) => ALL_KINDS.includes(k)) : ALL_KINDS;
  return {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    homeKinds: kinds.length ? kinds : ALL_KINDS,
    interests: uniqLower(r.interests),
    following: uniqHandles(r.following),
    lastVisit: typeof r.lastVisit === 'number' ? r.lastVisit : null,
  };
});

/** Captured once per app session, before lastVisit is bumped. */
let sessionPreviousVisit: number | null = null;

export async function startSession() {
  await preferencesStore.hydrate();
  sessionPreviousVisit = preferencesStore.get().lastVisit;
  preferencesStore.set((p) => ({ ...p, lastVisit: Date.now() }));
}

export const getPreviousVisit = () => sessionPreviousVisit;

export const usePreferences = () => useStore(preferencesStore);

export const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
  preferencesStore.set((p) => ({ ...p, [key]: value }));

function toggleIn(list: string[], value: string) {
  const v = value.trim().toLowerCase();
  if (!v) return list;
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export const toggleInterest = (term: string) =>
  preferencesStore.set((p) => ({
    ...p,
    interests: toggleIn(p.interests, term),
  }));
export const toggleFollow = (handle: string) =>
  preferencesStore.set((p) => {
    const h = handle.trim();
    if (!h) return p;
    const following = isFollowingHandle(p.following, h)
      ? p.following.filter((x) => x.toLowerCase() !== h.toLowerCase())
      : [...p.following, h];
    return { ...p, following };
  });
export const toggleHomeKind = (kind: ContentKind) =>
  preferencesStore.set((p) => {
    const next = p.homeKinds.includes(kind) ? p.homeKinds.filter((k) => k !== kind) : [...p.homeKinds, kind];
    return { ...p, homeKinds: next.length ? next : p.homeKinds };
  });
