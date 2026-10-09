import React, { useState, useRef } from 'react';
import { 
  QrCode, Copy, Check, LogOut, Laptop, Smartphone, UploadCloud, 
  File, Folder, Image as ImageIcon, FileText, Download, Archive, 
  Trash2, X, ExternalLink, RefreshCw, Send, CheckCircle2, AlertCircle,
  Eye, EyeOff, ShieldCheck
} from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/device';
import { triggerDownload } from '../utils/zip';

export default function RoomView({
  roomCode,
  peers,
  deviceInfo,
  onLeaveRoom,
  onNewRoomCode,
  onOpenQR,
  onSendFiles,
  onDownloadAllZip,
  activeTransfers,
  receivedFiles,
  onCancelTransfer,
  syncedText,
  onTextChange,
  isDirectP2P,
  isPrivacyMode = false,
}) {
  const [activeTab, setActiveTab] = useState('files'); // 'files' | 'images' | 'text'
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [codeRevealed, setCodeRevealed] = useState(false);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const displayCode = roomCode && roomCode.length === 6 ? `${roomCode.slice(0, 3)}-${roomCode.slice(3)}` : roomCode;

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(displayCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(syncedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const files = [];
      const queue = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) queue.push(entry);
        } else {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (queue.length > 0) {
        // Recursive reader for folders & files
        const readEntries = async (entry, path = '') => {
          if (entry.isFile) {
            return new Promise((resolve) => {
              entry.file((file) => {
                file.customPath = path ? `${path}/${file.name}` : file.name;
                files.push(file);
                resolve();
              });
            });
          } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const entries = await new Promise((resolve) => {
              dirReader.readEntries((results) => resolve(results));
            });
            const subPromises = entries.map((subEntry) =>
              readEntries(subEntry, path ? `${path}/${entry.name}` : entry.name)
            );
            await Promise.all(subPromises);
          }
        };

        for (const entry of queue) {
          await readEntries(entry);
        }
      }

      if (files.length > 0) {
        onSendFiles(files);
      }
    } else if (e.dataTransfer.files?.length > 0) {
      onSendFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onSendFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const receivedImages = receivedFiles.filter((f) => f.mimeType?.startsWith('image/'));

  return (
    <div className={`w-full max-w-4xl mx-auto px-4 py-2 z-10 animate-in fade-in duration-300 ${isPrivacyMode ? 'transition-all duration-300' : ''}`}>
      
      {/* Top Room Bar */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase flex items-center gap-1.5">
              <span>Active Room</span>
              {isPrivacyMode && (
                <span className="text-[9px] text-emerald-500 font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-500/10">
                  Protected
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {/* Room Code with Anti-Peeping Mask */}
              <div 
                className="relative flex items-center group cursor-pointer"
                onMouseEnter={() => isPrivacyMode && setCodeRevealed(true)}
                onMouseLeave={() => isPrivacyMode && setCodeRevealed(false)}
                onClick={() => setCodeRevealed(!codeRevealed)}
                title={isPrivacyMode ? "Hover or click to reveal code" : ""}
              >
                <span className={`text-2xl font-black font-mono tracking-widest text-zinc-900 dark:text-zinc-50 select-none transition-all duration-200 ${
                  isPrivacyMode && !codeRevealed ? 'filter blur-[7px] opacity-60' : ''
                }`}>
                  {isPrivacyMode && !codeRevealed ? '••••••' : displayCode}
                </span>

                {isPrivacyMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCodeRevealed(!codeRevealed);
                    }}
                    className="ml-2 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    title={codeRevealed ? "Hide code" : "Reveal code"}
                  >
                    {codeRevealed ? <EyeOff className="w-3.5 h-3.5 text-emerald-500" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              <button
                onClick={handleCopyRoomCode}
                title="Copy Room Code"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

          {/* Connection Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700">
            <span className={`w-2 h-2 rounded-full ${peers.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-zinc-600 dark:text-zinc-300">
              {peers.length > 0 ? `${peers.length} Device${peers.length > 1 ? 's' : ''} Connected` : 'Waiting for peers...'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onNewRoomCode && (
            <button
              onClick={onNewRoomCode}
              title="Generate a brand new room code"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60 transition-all hover:scale-105 active:scale-95"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
              <span>New Code</span>
            </button>
          )}

          <button
            onClick={onOpenQR}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60 transition-all hover:scale-105 active:scale-95"
          >
            <QrCode className="w-4 h-4 text-blue-500" />
            <span>Scan QR</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 transition-all active:scale-95"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>
      </div>

      {/* Connected Devices Strip */}
      <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-zinc-200/70 dark:border-zinc-800/70 rounded-xl p-3 mb-4 flex items-center justify-between overflow-x-auto text-xs">
        <div className="flex items-center gap-3">
          <span className="text-zinc-400 font-medium">In this room:</span>
          {/* Current device */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900 font-medium">
            {deviceInfo?.isMobile ? <Smartphone className="w-3.5 h-3.5" /> : <Laptop className="w-3.5 h-3.5" />}
            <span>{deviceInfo?.deviceName} (You)</span>
          </div>

          {/* Remote peers */}
          {peers.map((peer) => (
            <div
              key={peer.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 font-medium animate-in fade-in"
            >
              {peer.isMobile ? <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> : <Laptop className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{peer.deviceName || 'Peer Device'}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${isDirectP2P ? 'bg-emerald-500' : 'bg-blue-500'}`} title={isDirectP2P ? 'Direct P2P' : 'Relay'} />
            </div>
          ))}

          {peers.length === 0 && (
            <span className="text-zinc-400 italic">No other devices yet. Scan QR or share code to connect.</span>
          )}
        </div>

        {isDirectP2P && (
          <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            ⚡ WebRTC Direct P2P
          </span>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'files'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <File className="w-4 h-4" />
          <span>Files & Folders</span>
          {receivedFiles.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white">
              {receivedFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'images'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Images</span>
          {receivedImages.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white">
              {receivedImages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'text'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>QuickSync Text</span>
        </button>
      </div>

      {/* Tab 1: Files & Folders */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all duration-200 backdrop-blur-xl ${
              isDragOver
                ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
                : 'border-zinc-300 dark:border-zinc-700/80 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-600'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-4 max-w-sm mx-auto">
              <div className={`p-4 rounded-2xl transition-transform ${isDragOver ? 'scale-110' : ''} bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-sm`}>
                <UploadCloud className="w-8 h-8" />
              </div>

              <div>
                <p className="font-bold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                  Drag & Drop files or folders here
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  Unlimited size • Transferred directly to connected peers
                </p>
              </div>

              {/* Upload buttons */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <File className="w-4 h-4" />
                  <span>Select Files</span>
                </button>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <Folder className="w-4 h-4" />
                  <span>Select Folder</span>
                </button>
              </div>

              {/* Hidden Inputs */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <input
                ref={folderInputRef}
                type="file"
                webkitdirectory="true"
                directory="true"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>

          {/* Active Transfers List */}
          {activeTransfers.length > 0 && (
            <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-lg space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Active Transfers ({activeTransfers.length})
              </h4>
              <div className="space-y-2">
                {activeTransfers.map((item) => (
                  <div
                    key={item.fileId}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.isSending ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {item.isSending ? 'Sending' : 'Receiving'}
                        </span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-zinc-500 text-[11px]">
                        <span>{formatSpeed(item.speed)}</span>
                        <span>{formatTimeRemaining(item.eta)}</span>
                        <button
                          onClick={() => onCancelTransfer(item.fileId)}
                          className="text-zinc-400 hover:text-rose-500"
                          title="Cancel transfer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span>{formatBytes(item.bytesTransferred)} / {formatBytes(item.totalBytes)}</span>
                      <span>{item.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Received Files List */}
          <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <span>Received Items ({receivedFiles.length})</span>
                {isPrivacyMode && (
                  <span className="text-[10px] text-zinc-400 font-normal">
                    (Hover to reveal items)
                  </span>
                )}
              </h4>
              {receivedFiles.length > 1 && (
                <button
                  onClick={onDownloadAllZip}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Download All as ZIP</span>
                </button>
              )}
            </div>

            {receivedFiles.length === 0 ? (
              <div className="text-center py-10 text-zinc-400 text-xs">
                No files received yet. Drop items above to start transferring!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {receivedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60 group hover:border-zinc-300 dark:hover:border-zinc-600 transition-all"
                  >
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          onClick={() => setSelectedImagePreview(file.previewUrl)}
                          className={`w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-all border border-zinc-200 dark:border-zinc-700 ${
                            isPrivacyMode ? 'filter blur-[10px] group-hover:blur-none duration-200' : ''
                          }`}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                          <File className="w-5 h-5" />
                        </div>
                      )}

                      <div className="overflow-hidden">
                        <p className={`text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate transition-all duration-200 ${
                          isPrivacyMode ? 'filter blur-[3px] group-hover:blur-none select-none' : ''
                        }`}>
                          {file.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => triggerDownload(file.blob, file.name)}
                      className="p-2 rounded-lg bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-colors shrink-0"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Images Gallery */}
      {activeTab === 'images' && (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <span>Shared Images</span>
              {isPrivacyMode && (
                <span className="text-[10px] text-emerald-500 font-normal">
                  (Anti-Peep: Hover to view photo)
                </span>
              )}
            </h4>
            <span className="text-xs text-zinc-400">{receivedImages.length} images</span>
          </div>

          {receivedImages.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs">
              No photos or images shared yet. Drop images in the Files tab to preview them here!
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {receivedImages.map((img) => (
                <div
                  key={img.fileId}
                  className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shadow-sm"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    className={`w-full h-full object-cover transition-all group-hover:scale-105 duration-300 cursor-pointer ${
                      isPrivacyMode ? 'filter blur-[16px] group-hover:blur-none' : ''
                    }`}
                    onClick={() => setSelectedImagePreview(img.previewUrl)}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => triggerDownload(img.blob, img.name)}
                      className="p-2 rounded-full bg-white/90 text-zinc-900 hover:bg-white shadow-md transition-transform hover:scale-110"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedImagePreview(img.previewUrl)}
                      className="p-2 rounded-full bg-white/90 text-zinc-900 hover:bg-white shadow-md transition-transform hover:scale-110"
                      title="Preview"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Text & Notes (QuickSync clone feature) */}
      {activeTab === 'text' && (
        <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <span>Real-time QuickSync Text</span>
                {isPrivacyMode && (
                  <span className="text-[10px] text-emerald-500 font-normal">
                    (Anti-Peep: Hover over box to read)
                  </span>
                )}
              </h4>
              <p className="text-xs text-zinc-400">Anything you paste or type updates instantly across all connected devices.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 transition-all hover:scale-105"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
          </div>

          <div className="relative group">
            <textarea
              value={syncedText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Type or paste text, links, code snippets or notes here..."
              rows={10}
              className={`w-full rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-950 p-4 font-mono text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y transition-all duration-300 ${
                isPrivacyMode ? 'filter blur-[5px] group-hover:blur-none focus:blur-none select-none' : ''
              }`}
            />
            {isPrivacyMode && (
              <div className="pointer-events-none absolute top-3 right-3 px-2 py-1 rounded bg-zinc-900/80 text-[10px] text-zinc-300 backdrop-blur-md border border-zinc-700 group-hover:opacity-0 transition-opacity">
                Hover to read
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
            <span>{syncedText.length} characters • {syncedText.trim() ? syncedText.trim().split(/\s+/).length : 0} words</span>
            {syncedText && (
              <button
                onClick={() => onTextChange('')}
                className="text-rose-500 hover:text-rose-600 transition-colors"
              >
                Clear Text
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal for Images */}
      {selectedImagePreview && (
        <div
          onClick={() => setSelectedImagePreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-10 right-0 p-1 text-white hover:text-zinc-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImagePreview}
              alt="Fullscreen preview"
              className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}

    </div>
  );
}
