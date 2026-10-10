import React from 'react';
import { Sun, Moon, Laptop, Smartphone } from 'lucide-react';

export default function Header({ theme, toggleTheme, deviceInfo, isConnected }) {
  return (
    <header className="w-full flex items-center justify-between py-5 px-6 max-w-4xl mx-auto z-20">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50">
            QuickSync
          </span>
          <span className="flex h-2 w-2 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isConnected ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Device Name Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-xs font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60">
          {deviceInfo?.isMobile ? (
            <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <Laptop className="w-3.5 h-3.5 text-zinc-500" />
          )}
          <span className="truncate max-w-[130px]">{deviceInfo?.deviceName || 'This Device'}</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-zinc-300" /> : <Moon className="w-4 h-4 text-zinc-700" />}
        </button>
      </div>
    </header>
  );
}
