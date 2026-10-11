/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  X,
  Trash2,
  AlertCircle,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  Smartphone,
  Cloud,
  Layers
} from 'lucide-react';
import { Feed, DEFAULT_FOLDER } from '../types';
import { getStorageMode, setStorageMode, saveLocalFeeds } from '../utils/storage';
import { getJsonHeaders } from '../utils/api';
import { ConfirmDialog } from './ConfirmDialog';
import { FolderPicker } from './FolderPicker';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  feeds: Feed[];
  onDeleteFeed: (feedId: string) => void;
  onUpdateFeed?: (feedId: string, updates: Partial<Feed>) => void;
  onImportComplete?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  feeds,
  onDeleteFeed,
  onUpdateFeed,
  onImportComplete
}) => {
  // OPML state inside Settings
  const [opmlText, setOpmlText] = useState('');
  const [importing, setImporting] = useState(false);
  const [opmlStatus, setOpmlStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Storage Mode state (iPhone / iCloud PWA persistence)
  const [storageModeState, setStorageModeState] = useState<'iphone' | 'icloud'>(() => {
    return getStorageMode();
  });

  const [confirmDeleteFeed, setConfirmDeleteFeed] = useState<Feed | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);

  const folderNames = useMemo(
    () => Array.from(new Set(feeds.map((f) => f.folder || DEFAULT_FOLDER))),
    [feeds]
  );

  const handleStorageModeChange = (mode: 'iphone' | 'icloud') => {
    setStorageModeState(mode);
    setStorageMode(mode);
    saveLocalFeeds(feeds);
  };

  if (!isOpen) return null;

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
        headers: getJsonHeaders(),
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
          Settings
        </h3>
        <p className="text-xs text-slate-400 mb-6">Personal configuration.</p>

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
                className="rounded-xl bg-slate-950 border border-slate-850 text-xs overflow-hidden"
              >
                <div className="flex items-center justify-between p-2.5">
                  <div className="truncate pr-2">
                    <div className="font-medium text-slate-200 truncate">{feed.title}</div>
                    <div className="text-[10px] text-slate-500 truncate">{feed.url}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onUpdateFeed && (
                      <button
                        onClick={() => setEditingFolderId(editingFolderId === feed.id ? null : feed.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-amber-300 transition max-w-[140px]"
                        title="Move to folder"
                      >
                        <Layers className="w-3 h-3 shrink-0" />
                        <span className="truncate">{feed.folder || DEFAULT_FOLDER}</span>
                      </button>
                    )}
                    <button
                      onClick={() => setConfirmDeleteFeed(feed)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded-lg transition shrink-0"
                      title="Unsubscribe"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {editingFolderId === feed.id && onUpdateFeed && (
                  <div className="px-2.5 pb-2.5 border-t border-slate-800/70">
                    <FolderPicker
                      folders={folderNames}
                      current={feed.folder || DEFAULT_FOLDER}
                      onSelect={(folder) => {
                        onUpdateFeed(feed.id, { folder });
                        setEditingFolderId(null);
                      }}
                    />
                  </div>
                )}
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
