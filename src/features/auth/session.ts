import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

// Hugging Face OAuth app "HackerFeed" (public client, PKCE). The client id is public by design.
export const HF_CLIENT_ID = '9f31ae1e-93ca-488e-926c-3d9a85a4ddc3';
export const HF_SCOPES = ['openid', 'profile', 'write-discussions'];
export const HF_DISCOVERY = {
  authorizationEndpoint: 'https://huggingface.co/oauth/authorize',
  tokenEndpoint: 'https://huggingface.co/oauth/token',
  userInfoEndpoint: 'https://huggingface.co/oauth/userinfo',
};

export interface HfSession {
  accessToken: string;
  /** Epoch ms; null when the server didn't say. */
  expiresAt: number | null;
  username: string;
  name?: string;
  avatar?: string;
}

// Native: Keychain/Keystore. Web has no secure store, so the token lives in localStorage.
const KEY = 'hf.auth.session';
let current: HfSession | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const read = (): Promise<string | null> => (Platform.OS === 'web' ? AsyncStorage.getItem(KEY) : SecureStore.getItemAsync(KEY));
const write = (v: string): Promise<void> => (Platform.OS === 'web' ? AsyncStorage.setItem(KEY, v) : SecureStore.setItemAsync(KEY, v));
const erase = (): Promise<void> => (Platform.OS === 'web' ? AsyncStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY));

export const isExpired = (s: HfSession, now = Date.now()) => s.expiresAt !== null && s.expiresAt <= now;

export async function loadHfSession() {
  try {
    const raw = await read();
    const parsed = raw ? (JSON.parse(raw) as Partial<HfSession>) : null;
    const ok = parsed?.accessToken && parsed.username;
    current = ok ? (parsed as HfSession) : null;
    // An expired token can't do anything; drop it so the UI offers sign-in again.
    if (current && isExpired(current)) {
      current = null;
      await erase();
    }
  } catch {
    current = null;
  }
  emit();
}

export async function saveHfSession(s: HfSession) {
  current = s;
  await write(JSON.stringify(s));
  emit();
}

export async function clearHfSession() {
  current = null;
  await erase();
  emit();
}

export const getHfSession = () => current;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useHfSession = () => useSyncExternalStore(subscribe, () => current);
