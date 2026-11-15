import { exchangeCodeAsync, makeRedirectUri, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';

import { fetchJson } from '@/lib/http';

import { HF_CLIENT_ID, HF_DISCOVERY, HF_SCOPES, saveHfSession } from './session';

// Completes the auth popup/redirect on web; no-op on native.
WebBrowser.maybeCompleteAuthSession();

interface UserInfo {
  preferred_username?: string;
  name?: string;
  picture?: string;
}

/** PKCE sign-in with Hugging Face. Redirects to hackerfeed://auth (native) or <origin>/auth (web). */
export function useHfSignIn() {
  const redirectUri = makeRedirectUri({ scheme: 'hackerfeed', path: 'auth' });
  const [request, response, promptAsync] = useAuthRequest(
    { clientId: HF_CLIENT_ID, scopes: HF_SCOPES, redirectUri, usePKCE: true },
    HF_DISCOVERY,
  );
  const [exchangeError, setError] = useState<string | null>(null);
  const responseError = response?.type === 'error' ? (response.params?.error_description ?? 'Sign-in failed.') : null;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!response) return;
    if (response.type !== 'success' || !request?.codeVerifier) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const token = await exchangeCodeAsync(
          {
            clientId: HF_CLIENT_ID,
            code: response.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier as string },
          },
          HF_DISCOVERY,
        );
        const { data } = await fetchJson<UserInfo>(HF_DISCOVERY.userInfoEndpoint, undefined, {
          Authorization: `Bearer ${token.accessToken}`,
        });
        if (cancelled) return;
        await saveHfSession({
          accessToken: token.accessToken,
          expiresAt: token.expiresIn ? Date.now() + token.expiresIn * 1000 : null,
          username: data.preferred_username ?? 'unknown',
          name: data.name,
          avatar: data.picture,
        });
        setError(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Sign-in failed.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // redirectUri is stable for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return {
    ready: !!request,
    busy,
    error: exchangeError ?? responseError,
    redirectUri,
    signIn: () => {
      setError(null);
      return promptAsync();
    },
  };
}
