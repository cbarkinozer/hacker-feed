import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

import type { KaggleCredentials } from './api';

// Native: Keychain / Keystore via expo-secure-store. Web has no secure storage, so the key
// lives in localStorage (this is a local, single-user client; nothing is sent anywhere but Kaggle).
const KEY = 'hf.kaggle.credentials';
let current: KaggleCredentials | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const read = (): Promise<string | null> => (Platform.OS === 'web' ? AsyncStorage.getItem(KEY) : SecureStore.getItemAsync(KEY));
const write = (v: string): Promise<void> => (Platform.OS === 'web' ? AsyncStorage.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v));
const erase = (): Promise<void> => (Platform.OS === 'web' ? AsyncStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY));

export async function loadKaggleCredentials() {
  try {
    const raw = await read();
    const parsed = raw ? (JSON.parse(raw) as Partial<KaggleCredentials>) : null;
    current = parsed?.username && parsed.key ? { username: parsed.username, key: parsed.key } : null;
  } catch {
    current = null;
  }
  loaded = true;
  emit();
}

export async function saveKaggleCredentials(c: KaggleCredentials) {
  current = { username: c.username.trim(), key: c.key.trim() };
  await write(JSON.stringify(current));
  emit();
}

export async function clearKaggleCredentials() {
  current = null;
  await erase();
  emit();
}

export const getKaggleCredentials = () => current;

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useKaggleCredentials = () => useSyncExternalStore(subscribe, () => current);
export const kaggleCredentialsLoaded = () => loaded;
