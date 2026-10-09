import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, QrCode, Smartphone, Wifi, Globe } from 'lucide-react';

export default function QRCodeModal({ isOpen, onClose, roomCode, joinUrl, tunnelUrl, localWifiUrl }) {
  const [selectedMode, setSelectedMode] = useState(tunnelUrl ? 'internet' : 'wifi');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const currentUrl = selectedMode === 'internet' && tunnelUrl ? `${tunnelUrl}/?room=${roomCode}` : localWifiUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayCode = roomCode && roomCode.length === 6 ? `${roomCode.slice(0, 3)}-${roomCode.slice(3)}` : roomCode;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 shadow-2xl flex flex-col items-center text-center space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Mobile Pairing</span>
        </div>

        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Scan to Connect</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Point your phone camera at this QR code to join room <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">{displayCode}</span>
          </p>
        </div>

        {/* Mode Selector Tabs */}
        {tunnelUrl && (
          <div className="flex w-full p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-semibold">
            <button
              onClick={() => setSelectedMode('internet')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                selectedMode === 'internet'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Internet / 4G / 5G</span>
            </button>

            <button
              onClick={() => setSelectedMode('wifi')}
              className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                selectedMode === 'wifi'
                  ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>Direct Wi-Fi</span>
            </button>
          </div>
        )}

        {/* QR Code Container */}
        <div className="p-4 bg-white rounded-2xl shadow-inner border border-zinc-200">
          <QRCodeSVG
            value={currentUrl}
            size={190}
            level="H"
            includeMargin={true}
          />
        </div>

        {/* Room Code & Copy URL */}
        <div className="w-full bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 rounded-xl p-3 flex items-center justify-between">
          <div className="text-left overflow-hidden pr-2">
            <span className="text-[10px] text-zinc-400 uppercase font-mono block">Room Code</span>
            <span className="font-mono font-bold text-lg text-zinc-900 dark:text-zinc-100 tracking-wider">
              {displayCode}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 transition-colors shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          {selectedMode === 'wifi'
            ? 'Ensure your phone is on the same Wi-Fi and your PC Wi-Fi is set to Private network in Windows Settings.'
            : 'Works on any mobile network, Wi-Fi, or cellular data.'}
        </p>
      </div>
    </div>
  );
}
