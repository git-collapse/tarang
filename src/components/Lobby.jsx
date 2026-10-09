import React, { useState } from 'react';
import { Plus, ArrowRight, ShieldCheck, Zap, FolderUp, ClipboardCopy, Sparkles } from 'lucide-react';

export default function Lobby({ onJoinRoom, onGenerateCode }) {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = inputCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleaned) {
      setError('Please enter a room code');
      return;
    }
    setError('');
    onJoinRoom(cleaned);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        // Strip out any surrounding url or query param if user pasted a full link
        const match = text.match(/room=([A-Za-z0-9-]+)/i);
        const code = match ? match[1] : text.trim();
        setInputCode(code.toUpperCase());
        setError('');
      }
    } catch {
      // Clipboard permission denied
    }
  };

  return (
    <div className="w-full max-w-md md:max-w-lg mx-auto my-auto px-4 z-10 animate-in fade-in zoom-in-95 duration-500">
      <div className="relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl shadow-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[520px]">
        
        {/* Glow corner accent */}
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center space-y-2.5 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Fast, Secure, Peer-to-Peer</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            QuickDrop
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
            Instantly sync files, folders, images, and text across any device.
          </p>
        </div>

        {/* Actions Area */}
        <div className="space-y-6 my-auto py-6">
          {/* Generate Code Button */}
          <button
            onClick={onGenerateCode}
            className="w-full h-14 rounded-xl font-semibold text-base sm:text-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-lg shadow-zinc-900/10 dark:shadow-white/5 flex items-center justify-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="w-5 h-5" />
            <span>Generate New Code</span>
          </button>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-white/90 dark:bg-zinc-900/90 px-3 text-zinc-400 dark:text-zinc-500 font-medium">
                Or join existing
              </span>
            </div>
          </div>

          {/* Join Code Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2 relative">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={12}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    if (error) setError('');
                  }}
                  placeholder="Enter 6-digit code"
                  className="w-full h-14 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 px-4 text-center font-mono text-xl sm:text-2xl font-bold tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all uppercase"
                />
                {!inputCode && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    title="Paste from clipboard"
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Paste
                  </button>
                )}
              </div>
              <button
                type="submit"
                aria-label="Join Room"
                className="h-14 w-14 shrink-0 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
            {error && <p className="text-xs text-rose-500 text-center font-medium">{error}</p>}
          </form>

          {/* Help Tip Box */}
          <div className="rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-950/50 p-3.5 text-center text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-center gap-2">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Tip:</span>
            <span>Use the same code on your phone or PC to transfer files instantly.</span>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
          <div className="flex flex-col items-center gap-1">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Direct P2P Speed</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <FolderUp className="w-4 h-4 text-blue-500" />
            <span>Files & Folders</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
