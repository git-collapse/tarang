import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Smartphone, Wifi, Globe } from 'lucide-react';

export default function QRCodeModal({ isOpen, onClose, roomCode, joinUrl, tunnelUrl, localWifiUrl }) {
  const [selectedMode, setSelectedMode] = useState(tunnelUrl ? 'internet' : 'wifi');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isCloud = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
  const currentUrl = isCloud ? joinUrl : (selectedMode === 'internet' && tunnelUrl ? `${tunnelUrl}/?room=${roomCode}` : localWifiUrl);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayCode = roomCode && roomCode.length === 6 ? `${roomCode.slice(0, 3)}-${roomCode.slice(3)}` : roomCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xs rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-xl flex flex-col items-center text-center space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 pt-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Scan to Pair</h3>
          <p className="text-xs text-zinc-500 font-mono">
            Room: {displayCode}
          </p>
        </div>

        {/* Mode Selector Tabs (only in local tunnel mode) */}
        {!isCloud && tunnelUrl && (
          <div className="flex w-full p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium">
            <button
              onClick={() => setSelectedMode('internet')}
              className={`flex-1 py-1 rounded-md transition-all ${
                selectedMode === 'internet'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500'
              }`}
            >
              Internet
            </button>
            <button
              onClick={() => setSelectedMode('wifi')}
              className={`flex-1 py-1 rounded-md transition-all ${
                selectedMode === 'wifi'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                  : 'text-zinc-500'
              }`}
            >
              Wi-Fi
            </button>
          </div>
        )}

        {/* QR Code Container */}
        <div className="p-3 bg-white rounded-xl border border-zinc-200">
          <QRCodeSVG
            value={currentUrl}
            size={180}
            level="M"
            includeMargin={true}
          />
        </div>

        {/* Copy Link Button */}
        <button
          onClick={handleCopy}
          className="w-full py-2 rounded-xl text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center justify-center gap-1.5"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>Copied Link</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
