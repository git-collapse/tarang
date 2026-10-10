import React, { useState } from 'react';
import { Plus, ArrowRight, ShieldCheck, Zap, FolderUp } from 'lucide-react';

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

  const extractRoomCode = (rawText) => {
    if (!rawText) return '';
    const match = rawText.match(/room=([A-Za-z0-9-]+)/i);
    const candidate = match ? match[1] : rawText.trim();
    return candidate.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const code = extractRoomCode(text);
      if (code) {
        setInputCode(code);
        setError('');
      }
    } catch {
      // Clipboard permission
    }
  };

  const handleInputPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text') || '';
    const code = extractRoomCode(text);
    if (code) {
      setInputCode(code);
      setError('');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto my-auto px-4 z-10 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl shadow-xl p-7 sm:p-9 flex flex-col justify-between min-h-[490px]">
        
        {/* Header */}
        <div className="text-center space-y-2 pt-2">
          <h2 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            तरंग
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
            Waves of data between devices. Instant, peer-to-peer, zero cloud storage.
          </p>
        </div>

        {/* Core Actions */}
        <div className="space-y-6 my-auto py-5">
          {/* Generate Code Button */}
          <button
            onClick={onGenerateCode}
            className="w-full h-13 rounded-xl font-medium text-base bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <Plus className="w-5 h-5" />
            <span>Generate New Code</span>
          </button>

          {/* Minimal Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
              <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 font-medium">
                Or join existing
              </span>
            </div>
          </div>

          {/* Join Code Input Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                maxLength={6}
                value={inputCode}
                onPaste={handleInputPaste}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
                  setInputCode(cleaned);
                  if (error) setError('');
                }}
                placeholder="Enter 6-digit code"
                className="flex-1 min-w-0 h-13 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 px-3 text-center font-mono text-base sm:text-lg font-bold tracking-wider sm:tracking-widest text-zinc-900 dark:text-zinc-100 placeholder:text-xs sm:placeholder:text-sm placeholder:font-semibold placeholder:tracking-wider placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-400 dark:focus:border-zinc-600 transition-all uppercase"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="h-13 px-3.5 shrink-0 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-xs font-semibold text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-all active:scale-95"
              >
                Paste
              </button>
              <button
                type="submit"
                aria-label="Join Room"
                className="h-13 w-13 shrink-0 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center transition-all active:scale-95"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            {error && <p className="text-xs text-rose-500 text-center font-medium">{error}</p>}
          </form>

          {/* Tip Box */}
          <div className="rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/80 dark:bg-zinc-950/50 p-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
            <span>Tip: Open the same link or enter this code on your phone to connect.</span>
          </div>
        </div>

        {/* Minimal Footer Badges */}
        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-around text-xs text-zinc-400 dark:text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Peer-to-Peer
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <FolderUp className="w-3.5 h-3.5" /> Files & Folders
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Encrypted
          </span>
        </div>
      </div>
    </div>
  );
}
