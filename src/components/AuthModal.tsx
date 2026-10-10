/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, AlertCircle, ArrowRight, X } from 'lucide-react';

interface AuthModalProps {
  onAuthenticated: (token: string, email: string) => void;
  onClose?: () => void;
  isDismissible?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onAuthenticated,
  onClose,
  isDismissible = false
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [remember] = useState(true);

  const handleLogin = async (e?: React.FormEvent, pinToSubmit?: string) => {
    if (e) e.preventDefault();
    const activePin = pinToSubmit || pin;
    if (!activePin) {
      setError('Please enter your personal passcode.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: activePin, email: 'rol.asthana@purvasa.uk' })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (remember) {
          localStorage.setItem('nnw_session_token', data.token);
          localStorage.setItem('nnw_user_email', data.user.email);
        }
        onAuthenticated(data.token, data.user.email);
      } else {
        setError(data.message || 'Incorrect PIN. Default is 1984.');
        setPin('');
      }
    } catch {
      setError('Could not reach backend authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Auto submit if 4 digits
        setTimeout(() => {
          handleLogin(undefined, nextPin);
        }, 120);
      }
    }
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 ios-header-safe ios-footer-safe animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-7 shadow-2xl text-slate-100 flex flex-col items-center text-center max-h-[90dvh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
        {isDismissible && onClose && (
          <button
            onClick={() => {
              onClose();
            }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* RSSNewsFeeds style icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 p-0.5 shadow-xl shadow-orange-500/20 mb-4">
          <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
            <Lock className="w-8 h-8 text-amber-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight">RSSNewsFeeds Personal</h2>
        <p className="text-xs text-slate-400 mt-1 mb-6 flex items-center gap-1.5 justify-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          Private to <span className="text-slate-200 font-mono">rol.asthana@purvasa.uk</span>
        </p>

        {/* PIN Indicators */}
        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-amber-400 scale-110 shadow-md shadow-amber-400/50'
                  : 'bg-slate-800 border border-slate-700'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-shake">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleKeypadPress(digit)}
              className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-amber-500 active:text-slate-950 font-medium text-lg text-white transition flex items-center justify-center border border-slate-750 select-none cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-900/40 hover:bg-slate-800 active:bg-slate-700 text-xs text-slate-400 transition flex items-center justify-center border border-slate-800 select-none cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleKeypadPress('0')}
            className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-amber-500 active:text-slate-950 font-medium text-lg text-white transition flex items-center justify-center border border-slate-750 select-none cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleLogin()}
            disabled={loading || pin.length === 0}
            className="h-14 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-40 text-slate-950 transition flex items-center justify-center font-bold select-none cursor-pointer"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <KeyRound className="w-3 h-3 text-slate-400" />
          <span>Default Passcode is <strong>1984</strong> (configurable in Settings)</span>
        </div>
      </div>
    </div>
  );
};
