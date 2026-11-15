import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface PersistentStore<T> {
  get(): T;
  set(update: T | ((prev: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** Loads the persisted value once; safe to call repeatedly. */
  hydrate(): Promise<void>;
  readonly hydrated: boolean;
}

/** Tiny observable store persisted as JSON in AsyncStorage (localStorage on web). */
export function createPersistentStore<T extends object>(
  key: string,
  initial: T,
  migrate: (raw: unknown) => T = (raw) => ({
    ...initial,
    ...(raw as Partial<T>),
  }),
): PersistentStore<T> {
  let value = initial;
  let hydrated = false;
  let hydrating: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());

  return {
    get: () => value,
    set(update) {
      value = typeof update === 'function' ? (update as (prev: T) => T)(value) : update;
      emit();
      AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {
        // Persistence is best-effort; the in-memory state stays correct.
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hydrate() {
      hydrating ??= AsyncStorage.getItem(key)
        .then((raw) => {
          if (raw) value = migrate(JSON.parse(raw));
        })
        .catch(() => undefined)
        .finally(() => {
          hydrated = true;
          emit();
        });
      return hydrating;
    },
    get hydrated() {
      return hydrated;
    },
  };
}

export function useStore<T extends object, S = T>(store: PersistentStore<T>, selector: (v: T) => S = (v) => v as unknown as S): S {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}
