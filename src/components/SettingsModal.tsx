/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  X,
  KeyRound,
  Trash2,
  LogOut,
  Shield,
  Check,
  AlertCircle,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  Smartphone,
  Cloud,
  Lock,
  Unlock
} from 'lucide-react';
import { Feed } from '../types';
import { getStorageMode, setStorageMode, saveLocalFeeds } from '../utils/storage';
import { getAuthHeaders } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  feeds: Feed[];
  onDeleteFeed: (feedId: string) => void;
  onLogout: () => void;
  onImportComplete?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  feeds,
  onDeleteFeed,
  onLogout,
  onImportComplete
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinStatus, setPinStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  // OPML state inside Settings
  const [opmlText, setOpmlText] = useState('');
  const [importing, setImporting] = useState(false);
  const [opmlStatus, setOpmlStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Storage Mode state (iPhone / iCloud PWA persistence)
  const [storageModeState, setStorageModeState] = useState<'iphone' | 'icloud'>(() => {
    return getStorageMode();
  });

  const [authRequired, setAuthRequired] = useState(true);
  const [togglingAuth, setTogglingAuth] = useState(false);
  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<Feed | null>(null);

  useEffect(() => {
    fetch('/api/auth/verify', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.authRequired === 'boolean') {
          setAuthRequired(d.authRequired);
        }
      })
      .catch(() => {});
  }, []);

  const handleToggleAuthRequired = async () => {
    setTogglingAuth(true);
    const next = !authRequired;
    try {
      const res = await fetch('/api/auth/toggle-required', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ authRequired: next })
      });
      if (res.ok) {
        setAuthRequired(next);
      }
    } catch {
      // Network/API failure: leave the current setting unchanged.
    } finally {
      setTogglingAuth(false);
    }
  };

  const handleStorageModeChange = (mode: 'iphone' | 'icloud') => {
    setStorageModeState(mode);
    setStorageMode(mode);
    saveLocalFeeds(feeds);
  };

  if (!isOpen) return null;

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPin(true);
    setPinStatus(null);

    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPin, newPin })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPinStatus({ type: 'success', text: 'Passcode changed successfully!' });
        setCurrentPin('');
        setNewPin('');
      } else {
        setPinStatus({ type: 'error', text: data.message || 'Failed to update passcode.' });
      }
    } catch {
      setPinStatus({ type: 'error', text: 'Network error updating PIN.' });
    } finally {
      setSavingPin(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setOpmlText(content);
    };
    reader.readAsText(file);
  };

  const handleImportOPML = async () => {
    if (!opmlText.trim()) {
      setOpmlStatus({ type: 'error', text: 'Please paste OPML XML or choose a file.' });
      return;
    }

    setImporting(true);
    setOpmlStatus(null);

    try {
      const res = await fetch('/api/opml/import', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ opmlContent: opmlText })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setOpmlStatus({
          type: 'success',
          text: `Successfully imported ${data.importedCount} new feed(s) from ${data.totalParsed} outlines!`
        });
        if (onImportComplete) onImportComplete();
      } else {
        setOpmlStatus({ type: 'error', text: data.error || 'Failed to parse OPML.' });
      }
    } catch {
      setOpmlStatus({ type: 'error', text: 'Network error importing OPML.' });
    } finally {
      setImporting(false);
    }
  };

  const handleExportOPML = () => {
    window.location.href = '/api/opml/export';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 ios-header-safe ios-footer-safe animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl relative text-slate-100 max-h-[85dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-amber-400" />
          Settings & Account
        </h3>
        <p className="text-xs text-slate-400 mb-6">Personal configuration and security controls.</p>

        {/* Account Info */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white">Owner Account</div>
              <div className="text-xs text-slate-400 font-mono">rol.asthana@purvasa.uk</div>
            </div>
          </div>
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Lock App
          </button>
        </div>

        {/* PWA Data Persistence (iPhone / iCloud) */}
        <div className="border-t border-slate-800 pt-5 mb-6">
          <h4 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-amber-400" /> PWA Data Persistence (iPhone / iCloud)
          </h4>
          <p className="text-[11px] text-slate-400 mb-3">
            Choose where your subscriptions and reading state are saved on your Apple device.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <button
              type="button"
              onClick={() => handleStorageModeChange('iphone')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                storageModeState === 'iphone'
                  ? 'bg-amber-500/10 border-amber-500 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs">Save on iPhone</span>
                <Smartphone className={`w-4 h-4 ${storageModeState === 'iphone' ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <p className="text-[10px] text-slate-400">Stores feeds securely in local PWA storage on this device for offline usage.</p>
            </button>

            <button
              type="button"
              onClick={() => handleStorageModeChange('icloud')}
              className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                storageModeState === 'icloud'
                  ? 'bg-amber-500/10 border-amber-500 text-white'
                  : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-850'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs">Save on iCloud</span>
                <Cloud className={`w-4 h-4 ${storageModeState === 'icloud' ? 'text-amber-400' : 'text-slate-500'}`} />
              </div>
              <p className="text-[10px] text-slate-400">Enables iCloud container backup sync across your Apple devices.</p>
            </button>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Local persistence active: Your feeds, starred articles, and reading history are saved directly on your device and will never reset on server restarts.</span>
          </div>
        </div>
        {/* Passcode Protection Toggle */}
        <div className="border-t border-slate-800 pt-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {authRequired ? (
                <Lock className="w-4 h-4 text-amber-400" />
              ) : (
                <Unlock className="w-4 h-4 text-slate-500" />
              )}
              <div>
                <h4 className="text-xs font-semibold text-slate-200">Require Passcode Lock</h4>
                <p className="text-[11px] text-slate-400">
                  {authRequired
                    ? 'Protected with 4-digit PIN (default 1984)'
                    : 'Unlocked for instant access without entering passcode'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={togglingAuth}
              onClick={handleToggleAuthRequired}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 ease-in-out cursor-pointer ${
                authRequired ? 'bg-amber-500' : 'bg-slate-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  authRequired ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Change PIN Section */}
        <div className="border-t border-slate-800 pt-5 mb-6">
          <h4 className="text-xs font-semibold text-slate-200 mb-3 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-amber-400" /> Change Personal Passcode
          </h4>
          <form onSubmit={handleChangePin} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Current PIN</label>
                <input
                  type="password"
                  required
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="e.g. 1984"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">New PIN (4+ digits)</label>
                <input
                  type="password"
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="New passcode"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {pinStatus && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  pinStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                {pinStatus.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{pinStatus.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingPin || !currentPin || !newPin}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 disabled:opacity-40 transition"
            >
              Update Passcode
            </button>
          </form>
        </div>

        {/* OPML Subscriptions Import & Export Section */}
        <div className="border-t border-slate-800 pt-5 mb-6">
          <h4 className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-400" /> OPML Subscriptions Import & Export
          </h4>
          <p className="text-[11px] text-slate-400 mb-3">
            Transfer subscriptions between RSSNewsFeeds, NetNewsWire, Reeder, Feedly, and Miniflux.
          </p>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Export Subscriptions</div>
              <div className="text-[10px] text-slate-400">Download .opml file</div>
            </div>
            <button
              onClick={handleExportOPML}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download OPML
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-300">Import OPML XML</label>
              <label className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1">
                <Upload className="w-3 h-3" />
                <span>Choose file</span>
                <input type="file" accept=".opml,.xml" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <textarea
              value={opmlText}
              onChange={(e) => setOpmlText(e.target.value)}
              placeholder="Paste OPML XML here..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-amber-500 resize-none"
            />
            {opmlStatus && (
              <div
                className={`p-2 rounded-xl text-xs flex items-center gap-2 ${
                  opmlStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}
              >
                {opmlStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{opmlStatus.text}</span>
              </div>
            )}
            <button
              type="button"
              disabled={importing || !opmlText.trim()}
              onClick={handleImportOPML}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-40 transition"
            >
              {importing ? 'Importing...' : 'Import OPML Feeds'}
            </button>
          </div>
        </div>

        {/* Manage Feeds List */}
        <div className="border-t border-slate-800 pt-5">
          <h4 className="text-xs font-semibold text-slate-200 mb-2">
            Active Subscriptions ({feeds.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-850 text-xs"
              >
                <div className="truncate pr-2">
                  <div className="font-medium text-slate-200 truncate">{feed.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">{feed.url}</div>
                </div>
                <button
                  onClick={() => setConfirmDeleteFeed(feed)}
                  className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition shrink-0"
                  title="Unsubscribe"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteFeed !== null}
        title="Unsubscribe from feed?"
        message={`This removes "${confirmDeleteFeed?.title ?? ''}" and its articles from your library. You can add it again later.`}
        confirmLabel="Unsubscribe"
        destructive
        onCancel={() => setConfirmDeleteFeed(null)}
        onConfirm={() => {
          if (confirmDeleteFeed) onDeleteFeed(confirmDeleteFeed.id);
          setConfirmDeleteFeed(null);
        }}
      />
    </div>
  );
};
