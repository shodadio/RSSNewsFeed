/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const AUTH_EXPIRED_EVENT = 'nnw_auth_expired';

export function getStoredSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('nnw_session_token');
}

export function notifySessionExpired(message?: string) {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nnw_session_token');
    window.dispatchEvent(
      new CustomEvent(AUTH_EXPIRED_EVENT, {
        detail: { message: message || 'Session passcode token is required.' }
      })
    );
  }
}

export function getAuthHeaders(contentType: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  return headers;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401) {
    notifySessionExpired('Passcode authentication required.');
  }
  return res;
}
