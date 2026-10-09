import React from 'react';
import { Sun, Moon, Laptop, Smartphone, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function Header({ 
  theme, 
  toggleTheme, 
  deviceInfo, 
  isConnected, 
  isPrivacyMode, 
  togglePrivacyMode 
}) {
  return (
    <header className="w-full flex items-center justify-between py-5 px-6 max-w-4xl mx-auto z-20">
      {/* Minimal Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100" />
        <span className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          QuickDrop
        </span>
        {isPrivacyMode && (
          <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            shield
          </span>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {/* Device indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          {deviceInfo?.isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
          <span className="truncate max-w-[120px]">{deviceInfo?.deviceName || 'Device'}</span>
          <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        </div>

        {/* Anti-Peep Shield Toggle */}
        <button
          onClick={togglePrivacyMode}
          title={isPrivacyMode ? "Anti-Peep Shield On (Alt+P)" : "Enable Anti-Peep Shield (Alt+P)"}
          className={`p-2 rounded-lg transition-colors text-xs flex items-center gap-1.5 ${
            isPrivacyMode
              ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
          }`}
        >
          {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span className="hidden md:inline font-medium">Privacy</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
