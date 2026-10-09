import React, { useState } from 'react';
import { Plus, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Lobby({ onJoinRoom, onGenerateCode }) {
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = inputCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleaned) {
      setError('Enter a code');
      return;
    }
    setError('');
    onJoinRoom(cleaned);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const match = text.match(/room=([A-Za-z0-9-]+)/i);
        const code = match ? match[1] : text.trim();
        setInputCode(code.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
        setError('');
      }
    } catch {}
  };

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto px-4 z-10 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 shadow-sm p-6 sm:p-8 flex flex-col justify-between min-h-[440px]">
        
        {/* Minimal Header */}
        <div className="text-center space-y-1.5 pt-2">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            QuickDrop
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Direct peer-to-peer sharing between devices.
          </p>
        </div>

        {/* Core Actions */}
        <div className="space-y-5 my-auto py-4">
          {/* Generate Code Button */}
          <button
            onClick={onGenerateCode}
            className="w-full h-12 rounded-xl font-medium text-sm bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Generate New Code</span>
          </button>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800"></span>
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 dark:text-zinc-500">
                or enter code
              </span>
            </div>
          </div>

          {/* Join Code Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2 relative">
              <div className="relative flex-1">
                <input
                  type="text"
                  maxLength={10}
                  value={inputCode}
                  onChange={(e) => {
                    setInputCode(e.target.value.toUpperCase());
                    if (error) setError('');
                  }}
                  placeholder="000-000"
                  className="w-full h-12 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-4 text-center font-mono text-lg font-semibold tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors uppercase"
                />
                {!inputCode && (
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[11px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    paste
                  </button>
                )}
              </div>
              <button
                type="submit"
                aria-label="Join Room"
                className="h-12 w-12 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 flex items-center justify-center transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            {error && <p className="text-xs text-rose-500 text-center">{error}</p>}
          </form>
        </div>

        {/* Minimal Bottom Info */}
        <div className="text-center pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
            End-to-end direct transfer • No cloud storage
          </p>
        </div>
      </div>
    </div>
  );
}
