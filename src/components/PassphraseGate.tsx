/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { KeyRound, AlertCircle, Loader2 } from 'lucide-react';

interface PassphraseGateProps {
  onUnlocked: () => void;
}

/**
 * The one lock in this app: a single shared passphrase, checked by the server.
 * Rendered only while the server reports that a passphrase is configured and
 * this browser has no valid session.
 */
export const PassphraseGate: React.FC<PassphraseGateProps> = ({ onUnlocked }) => {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase || busy) return;

    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphrase })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setPassphrase('');
        onUnlocked();
        return;
      }

      setError(
        data.message ||
          (res.status === 429
            ? 'Too many attempts. Wait a minute and try again.'
            : 'Incorrect passphrase.')
      );
      setPassphrase('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-[#1C1C1E] border border-white/[0.1] rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/20 border border-[#0A84FF]/30 flex items-center justify-center text-[#0A84FF]">
            <KeyRound className="w-5 h-5 stroke-[1.75]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight">RSSNewsFeeds</h1>
            <p className="text-[11px] text-[#8E8E93]">This app is protected by a shared passphrase.</p>
          </div>
        </div>

        <label htmlFor="passphrase" className="block text-[11px] text-[#8E8E93] mt-5 mb-1.5">
          Passphrase
        </label>
        <input
          id="passphrase"
          name="passphrase"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Enter the passphrase"
          className="w-full bg-black/50 border border-white/[0.12] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[#8E8E93] focus:outline-none focus:border-[#0A84FF] transition"
        />

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/20 text-[11px] text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !passphrase}
          className="mt-4 w-full py-2.5 rounded-xl bg-[#0A84FF] hover:bg-[#0A84FF]/90 active:bg-[#0A84FF]/80 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none transition"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
          {busy ? 'Checking…' : 'Unlock'}
        </button>

        <p className="text-[10px] text-[#8E8E93] mt-3 leading-relaxed">
          Your library is stored on this device; the passphrase unlocks the server
          side of it. It is set in the server environment, not in the app.
        </p>
      </form>
    </div>
  );
};
