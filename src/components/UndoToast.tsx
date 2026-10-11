/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Undo2, X } from 'lucide-react';

interface UndoToastProps {
  message: string;
  actionLabel?: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

/**
 * Transient bottom toast offering a single "Undo" affordance for a destructive
 * action that has already been applied. The caller owns the dismissal timer;
 * this component only renders the affordance and its countdown bar.
 */
export const UndoToast: React.FC<UndoToastProps> = ({
  message,
  actionLabel = 'Undo',
  onUndo,
  onDismiss,
  durationMs = 6000
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[90] flex justify-center px-4 pb-[calc(84px+max(16px,env(safe-area-inset-bottom,16px)))] pointer-events-none"
    >
      <div className="pointer-events-auto relative overflow-hidden w-full max-w-sm rounded-2xl bg-[#1C1C1E] border border-white/10 shadow-2xl text-slate-100 animate-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex-1 min-w-0 text-xs font-medium text-slate-200 truncate">
            {message}
          </span>
          <button
            type="button"
            onClick={onUndo}
            className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#0A84FF] hover:bg-[#0071E3] active:bg-[#0060C0] text-white text-xs font-bold transition"
          >
            <Undo2 className="w-3.5 h-3.5 stroke-[2]" />
            <span>{actionLabel}</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="shrink-0 p-1 text-[#8E8E93] hover:text-white transition"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>
        <div
          className="h-0.5 bg-[#0A84FF] origin-left"
          style={{ animation: `undoCountdown ${durationMs}ms linear forwards` }}
        />
      </div>
    </div>
  );
};
