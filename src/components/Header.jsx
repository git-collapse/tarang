import React from 'react';
import { Sun, Moon, Laptop, Smartphone, Radio } from 'lucide-react';

export default function Header({ theme, toggleTheme, deviceInfo, isConnected }) {
  return (
    <header className="w-full flex items-center justify-between py-4 px-6 max-w-5xl mx-auto z-20">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">QuickDrop</h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              P2P Sync
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">Instant cross-device file & folder sharing</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Device Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-xs text-zinc-600 dark:text-zinc-300">
          {deviceInfo?.isMobile ? <Smartphone className="w-3.5 h-3.5 text-zinc-500" /> : <Laptop className="w-3.5 h-3.5 text-zinc-500" />}
          <span className="truncate max-w-[120px] font-medium">{deviceInfo?.deviceName || 'Your Device'}</span>
          <span className="flex h-2 w-2 relative">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
          </span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 shadow-sm transition-all hover:scale-105 active:scale-95"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
        </button>
      </div>
    </header>
  );
}
