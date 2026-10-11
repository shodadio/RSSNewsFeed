/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AUTH_REQUIRED_EVENT = 'nnw_auth_required';

/**
 * Fired when any API call comes back 401 — the passphrase session has gone
 * (expired, revoked, or the passphrase was changed). The app listens and raises
 * the gate again.
 */
export function notifyAuthRequired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
  }
}

/**
 * Headers for our own JSON APIs. The session is an HttpOnly cookie, so it is
 * attached by the browser automatically and is deliberately unreadable here.
 */
export function getJsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

/** fetch for our own API: surfaces the gate whenever the server says 401. */
export async function guardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) notifyAuthRequired();
  return res;
}
