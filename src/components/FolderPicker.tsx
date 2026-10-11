/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Check, FolderOpen, FolderPlus } from 'lucide-react';

interface FolderPickerProps {
  /** Known folders to choose from (usually the folders already in the library). */
  folders: string[];
  /** The feed's current folder. */
  current?: string;
  /** Called with the chosen folder name. */
  onSelect: (folder: string) => void;
}

/**
 * Inline affordance for re-assigning a feed to a different folder, or to a
 * brand-new one. Used by Settings and the Sidebar feed action sheet — the
 * durable fix for a feed the auto-classifier filed under the wrong folder.
 */
export const FolderPicker: React.FC<FolderPickerProps> = ({ folders, current, onSelect }) => {
  const [newFolder, setNewFolder] = useState('');

  const options = Array.from(new Set([...(folders || []), ...(current ? [current] : [])])).sort(
    (a, b) => a.localeCompare(b)
  );

  const moveToNewFolder = () => {
    const name = newFolder.trim();
    if (!name) return;
    onSelect(name);
    setNewFolder('');
  };

  return (
    <div className="space-y-2 pt-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((folder) => {
          const active = folder === current;
          return (
            <button
              key={folder}
              type="button"
              onClick={() => onSelect(folder)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition inline-flex items-center gap-1.5 ${
                active
                  ? 'bg-[#0A84FF] text-white font-semibold'
                  : 'bg-white/[0.06] hover:bg-white/[0.12] text-slate-300'
              }`}
            >
              <FolderOpen className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[160px]">{folder}</span>
              {active && <Check className="w-3 h-3 shrink-0" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newFolder}
          onChange={(e) => setNewFolder(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              moveToNewFolder();
            }
          }}
          placeholder="New folder…"
          className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-[#0A84FF] transition"
        />
        <button
          type="button"
          onClick={moveToNewFolder}
          disabled={!newFolder.trim()}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 disabled:opacity-40 transition inline-flex items-center gap-1 shrink-0"
        >
          <FolderPlus className="w-3 h-3" />
          <span>Move</span>
        </button>
      </div>
    </div>
  );
};
