import { HF_BASE, HttpError, NetworkError } from '@/lib/http';

import type { HfSession } from './session';

/**
 * Upvotes a paper as the signed-in user.
 * NOTE: POST /api/papers/{id}/upvote is what huggingface.co itself calls, but it is not documented
 * for OAuth tokens. Callers must treat any failure as "fall back to the website".
 */
export async function upvotePaper(id: string, session: HfSession, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${HF_BASE}/api/papers/${encodeURIComponent(id)}/upvote`, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
  } catch {
    throw new NetworkError();
  }
  if (!res.ok) throw new HttpError(res.status, `Upvote failed (${res.status})`);
}
