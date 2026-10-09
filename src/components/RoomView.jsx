import React, { useState, useRef } from 'react';
import { 
  QrCode, Copy, Check, LogOut, Laptop, Smartphone, UploadCloud, 
  File, Folder, Image as ImageIcon, FileText, Download, Archive, 
  X, ExternalLink, RefreshCw, Eye, EyeOff
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
    <div className="w-full max-w-3xl mx-auto px-4 py-2 z-10 animate-in fade-in duration-300">
      
      {/* Minimal Top Room Bar */}
      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">Room:</span>
            <div 
              className="flex items-center cursor-pointer"
              onMouseEnter={() => isPrivacyMode && setCodeRevealed(true)}
              onMouseLeave={() => isPrivacyMode && setCodeRevealed(false)}
              onClick={() => setCodeRevealed(!codeRevealed)}
            >
              <span className={`text-lg font-mono font-bold tracking-wider text-zinc-900 dark:text-zinc-100 select-none transition-all ${
                isPrivacyMode && !codeRevealed ? 'filter blur-[6px] opacity-60' : ''
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
                  className="ml-1.5 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  {codeRevealed ? <EyeOff className="w-3.5 h-3.5 text-emerald-500" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>

            <button
              onClick={handleCopyRoomCode}
              title="Copy code"
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />

          {/* Minimal Peer Counter */}
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className={`w-1.5 h-1.5 rounded-full ${peers.length > 0 ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span>{peers.length > 0 ? `${peers.length + 1} connected` : 'Waiting for device'}</span>
          </div>
        </div>

        {/* Minimal Action Buttons */}
        <div className="flex items-center gap-1.5">
          {onNewRoomCode && (
            <button
              onClick={onNewRoomCode}
              title="New room code"
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenQR}
            title="Scan QR Code"
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <QrCode className="w-4 h-4" />
          </button>

          <button
            onClick={onLeaveRoom}
            title="Leave room"
            className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Minimal Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'files'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <File className="w-3.5 h-3.5" />
          <span>Files</span>
          {receivedFiles.length > 0 && (
            <span className="text-[10px] opacity-75">({receivedFiles.length})</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'images'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Photos</span>
          {receivedImages.length > 0 && (
            <span className="text-[10px] opacity-75">({receivedImages.length})</span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'text'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>
      </div>

      {/* Tab 1: Files & Folders */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Minimal Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-2xl p-8 text-center transition-colors ${
              isDragOver
                ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800/40'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3 max-w-xs mx-auto">
              <UploadCloud className="w-6 h-6 text-zinc-400 dark:text-zinc-500" />
              <div>
                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                  Drop files or folders here
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                  Direct peer-to-peer streaming
                </p>
              </div>

              {/* Minimal Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                >
                  Browse Files
                </button>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  Browse Folder
                </button>
              </div>

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

          {/* In-Flight Active Transfers */}
          {activeTransfers.length > 0 && (
            <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-4 space-y-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Transferring ({activeTransfers.length})
              </span>
              <div className="space-y-2">
                {activeTransfers.map((item) => (
                  <div key={item.fileId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate pr-2">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-2 text-zinc-400 text-[11px] shrink-0 font-mono">
                        <span>{formatSpeed(item.speed)}</span>
                        <button
                          onClick={() => onCancelTransfer(item.fileId)}
                          className="hover:text-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Hairline Progress Bar */}
                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Received Files List */}
          <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Received ({receivedFiles.length})
              </span>
              {receivedFiles.length > 1 && (
                <button
                  onClick={onDownloadAllZip}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Download ZIP</span>
                </button>
              )}
            </div>

            {receivedFiles.length === 0 ? (
              <p className="text-center py-8 text-zinc-400 text-xs">
                No files received yet.
              </p>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {receivedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex items-center justify-between py-2.5 group"
                  >
                    <div className="flex items-center gap-3 overflow-hidden pr-2">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          onClick={() => setSelectedImagePreview(file.previewUrl)}
                          className={`w-8 h-8 object-cover rounded-md cursor-pointer border border-zinc-200 dark:border-zinc-800 transition-all ${
                            isPrivacyMode ? 'filter blur-[10px] group-hover:blur-none' : ''
                          }`}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                          <File className="w-4 h-4" />
                        </div>
                      )}

                      <div className="overflow-hidden">
                        <p className={`text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate transition-all ${
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
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
                      title="Download"
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

      {/* Tab 2: Photos Gallery */}
      {activeTab === 'images' && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-5 space-y-4">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 block">
            Photos ({receivedImages.length})
          </span>

          {receivedImages.length === 0 ? (
            <p className="text-center py-10 text-zinc-400 text-xs">
              No photos shared yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {receivedImages.map((img) => (
                <div
                  key={img.fileId}
                  className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    className={`w-full h-full object-cover cursor-pointer transition-all ${
                      isPrivacyMode ? 'filter blur-[16px] group-hover:blur-none' : ''
                    }`}
                    onClick={() => setSelectedImagePreview(img.previewUrl)}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => triggerDownload(img.blob, img.name)}
                      className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedImagePreview(img.previewUrl)}
                      className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white"
                      title="Preview"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Notes / Text */}
      {activeTab === 'text' && (
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Synced Notes
            </span>
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedText ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="relative group">
            <textarea
              value={syncedText}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Type or paste text..."
              rows={9}
              className={`w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3.5 font-mono text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 resize-y transition-all ${
                isPrivacyMode ? 'filter blur-[5px] group-hover:blur-none focus:blur-none select-none' : ''
              }`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
            <span>{syncedText.length} chars</span>
            {syncedText && (
              <button
                onClick={() => onTextChange('')}
                className="hover:text-rose-500 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedImagePreview && (
        <div
          onClick={() => setSelectedImagePreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-8 right-0 text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImagePreview}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
}
