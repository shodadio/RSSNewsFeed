/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from './usePWAInstall';
import { Smartphone, Download, X, Share, PlusSquare } from 'lucide-react';
import { triggerHaptic } from '../utils/haptics';

export const PWAInstallGuide: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Suppress completely if already in standalone app mode
  if (isInstalled) {
    return null;
  }

  const handleOpenModal = () => {
    triggerHaptic('light');
    setShowIOSModal(true);
  };

  const handleCloseModal = () => {
    triggerHaptic('light');
    setShowIOSModal(false);
  };

  const modalContent = showIOSModal ? (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 ios-header-safe ios-footer-safe animate-in fade-in duration-150"
      onClick={handleCloseModal}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-6 shadow-2xl relative text-slate-100 flex flex-col max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleCloseModal}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg transition"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0 pr-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center p-2 shadow-md shrink-0">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white tracking-tight">Install on iPhone</h3>
            <p className="text-xs text-slate-400">Run as full-screen native app</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs text-slate-300 mb-5 bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400 shrink-0 mt-0.5">
              <Share className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white">1. Tap the Share button</span>
              <p className="text-slate-400 text-[11px] mt-0.5">In Safari toolbar at the bottom of your screen.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400 shrink-0 mt-0.5">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white">2. Select "Add to Home Screen"</span>
              <p className="text-slate-400 text-[11px] mt-0.5">Scroll down the share sheet and tap the plus icon.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-xs mt-0.5">
              ✓
            </div>
            <div>
              <span className="font-semibold text-white">3. Launch from Home Screen</span>
              <p className="text-slate-400 text-[11px] mt-0.5">Launches full screen with no browser bars and fast offline cache!</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            triggerHaptic('medium');
            setShowIOSModal(false);
          }}
          className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-amber-500/10 transition flex items-center justify-center gap-1.5 shrink-0"
        >
          Got it
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {isInstallable && (
        <button
          onClick={install}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition"
          title="Install as native application"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>
      )}

      {isIOS && (
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition"
          title="Add to iPhone Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Add to iOS</span>
        </button>
      )}

      {typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </>
  );
};
