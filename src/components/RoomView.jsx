import React, { useState, useRef, useEffect } from 'react';
import { 
  QrCode, Copy, Check, LogOut, Laptop, Smartphone, UploadCloud, 
  File, Folder, Image as ImageIcon, MessageSquare, Download, Archive, 
  X, ExternalLink, RefreshCw, Send, ClipboardPaste, FileText, CheckCircle2
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
  messages = [],
  onSendMessage,
  isDirectP2P,
}) {
  const [activeTab, setActiveTab] = useState('text'); // default to 'text' for proper texting or 'files'
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  
  // Message input state
  const [messageInput, setMessageInput] = useState('');
  const [textMode, setTextMode] = useState('chat'); // 'chat' | 'scratchpad'
  const messagesEndRef = useRef(null);

  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const displayCode = roomCode && roomCode.length === 6 
    ? `${roomCode.slice(0, 3)} ${roomCode.slice(3)}` 
    : roomCode;

  // Auto-scroll message feed
  useEffect(() => {
    if (activeTab === 'text' && textMode === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab, textMode]);

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(displayCode.replace(/\s+/g, ''));
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(syncedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyMessage = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSendMessageSubmit = (e) => {
    e?.preventDefault();
    const trimmed = messageInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setMessageInput('');
  };

  const handleQuickPaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setMessageInput(clipText);
      }
    } catch {}
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

  // Helper to render URLs as clickable links
  const renderMessageContent = (text) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 break-all text-blue-600 dark:text-blue-400 hover:opacity-80"
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-1 z-10 animate-in fade-in duration-200">
      
      {/* Top Room Bar */}
      <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Room Code</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold font-mono tracking-wider text-zinc-900 dark:text-zinc-50">
                {displayCode}
              </span>
              <button
                onClick={handleCopyRoomCode}
                title="Copy Room Code"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="h-7 w-px bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block" />

          {/* Status badge */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
            <span className={`w-2 h-2 rounded-full ${peers.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>
              {peers.length > 0 ? `${peers.length} Device${peers.length > 1 ? 's' : ''} Connected` : 'Waiting for device...'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {onNewRoomCode && (
            <button
              onClick={onNewRoomCode}
              title="Generate a new room code"
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800 transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Code</span>
            </button>
          )}

          <button
            onClick={onOpenQR}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QR Code</span>
          </button>

          <button
            onClick={onLeaveRoom}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Connected Peers Strip */}
      <div className="mb-4 flex items-center gap-2 overflow-x-auto text-xs px-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60">
          {deviceInfo?.isMobile ? <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> : <Laptop className="w-3.5 h-3.5 text-zinc-400" />}
          <span>{deviceInfo?.deviceName} (You)</span>
        </div>

        {peers.map((peer) => (
          <div
            key={peer.id}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium animate-in fade-in"
          >
            {peer.isMobile ? <Smartphone className="w-3.5 h-3.5 opacity-80" /> : <Laptop className="w-3.5 h-3.5 opacity-80" />}
            <span>{peer.deviceName || 'Peer Device'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        ))}

        {peers.length === 0 && (
          <span className="text-zinc-400 italic text-[11px] ml-1">
            Scan QR or enter this code on your other device to connect.
          </span>
        )}
      </div>

      {/* Minimal Tabs Navigation */}
      <div className="flex items-center gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'text'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Text & Messages</span>
          {messages.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-800">
              {messages.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'files'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <File className="w-3.5 h-3.5" />
          <span>Files & Folders</span>
          {receivedFiles.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-800">
              {receivedFiles.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('images')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'images'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Photos</span>
          {receivedImages.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-zinc-700 text-zinc-200 dark:bg-zinc-300 dark:text-zinc-800">
              {receivedImages.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PROPER TEXTING & MESSAGING */}
      {activeTab === 'text' && (
        <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          
          {/* Header & Sub-mode toggle: Chat vs Live Notepad */}
          <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-xs">
              <button
                onClick={() => setTextMode('chat')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  textMode === 'chat'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Instant Messages
              </button>
              <button
                onClick={() => setTextMode('scratchpad')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  textMode === 'scratchpad'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
              >
                Live Synced Notepad
              </button>
            </div>

            {textMode === 'scratchpad' ? (
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedText ? 'Copied' : 'Copy All'}</span>
              </button>
            ) : (
              <span className="text-[11px] text-zinc-400">
                {messages.length} message{messages.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Sub-mode A: Instant Messages / Snippets Feed */}
          {textMode === 'chat' && (
            <div className="space-y-4">
              {/* Message Feed Container */}
              <div className="min-h-[260px] max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center text-zinc-400 text-xs space-y-1">
                    <MessageSquare className="w-6 h-6 opacity-40 mb-1" />
                    <p className="font-medium text-zinc-500 dark:text-zinc-400">No messages yet</p>
                    <p>Type below or paste text to share instantly between devices.</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === deviceInfo?.id || msg.isMe;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}
                      >
                        <div className="flex items-center gap-2 mb-1 px-1">
                          <span className="text-[10px] text-zinc-400">
                            {isMe ? 'You' : msg.senderName || 'Peer'}
                          </span>
                          <span className="text-[9px] text-zinc-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 max-w-[85%] sm:max-w-[75%]">
                          <div
                            className={`p-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words ${
                              isMe
                                ? 'bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 rounded-tr-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-sm border border-zinc-200/60 dark:border-zinc-700/60'
                            }`}
                          >
                            {renderMessageContent(msg.text)}
                          </div>

                          {/* Quick Copy Button on message */}
                          <button
                            onClick={() => handleCopyMessage(msg.text, msg.id)}
                            title="Copy text"
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 opacity-60 group-hover:opacity-100 transition-opacity"
                          >
                            {copiedMsgId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <form onSubmit={handleSendMessageSubmit} className="pt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type a message, note, or link..."
                    className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-400 dark:focus:border-zinc-600 transition-all pr-16"
                  />
                  {!messageInput && (
                    <button
                      type="button"
                      onClick={handleQuickPaste}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded text-[11px] font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      Paste
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!messageInput.trim()}
                  className="h-11 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium text-xs sm:text-sm hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          )}

          {/* Sub-mode B: Live Collaborative Scratchpad (Tarang Notepad) */}
          {textMode === 'scratchpad' && (
            <div className="space-y-3">
              <textarea
                value={syncedText}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Type or paste notes, code snippets, or text here to sync live across devices..."
                rows={9}
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3.5 font-mono text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-400 dark:focus:border-zinc-600 resize-y leading-relaxed"
              />

              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span>{syncedText.length} characters • {syncedText.trim() ? syncedText.trim().split(/\s+/).length : 0} words</span>
                {syncedText && (
                  <button
                    onClick={() => onTextChange('')}
                    className="text-rose-500 hover:underline"
                  >
                    Clear Note
                  </button>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: FILES & FOLDERS */}
      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded-2xl p-7 sm:p-9 text-center transition-all duration-200 ${
              isDragOver
                ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/60 dark:bg-zinc-800/60'
                : 'border-zinc-300 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:border-zinc-400 dark:hover:border-zinc-700'
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-3 max-w-sm mx-auto">
              <UploadCloud className="w-8 h-8 text-zinc-400" />
              <div>
                <p className="font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                  Drag and drop files or folders
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Direct peer transfer with no file size limit
                </p>
              </div>

              {/* Upload buttons */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                >
                  <File className="w-3.5 h-3.5" />
                  <span>Select Files</span>
                </button>

                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center gap-1.5 border border-zinc-200/60 dark:border-zinc-700/60"
                >
                  <Folder className="w-3.5 h-3.5" />
                  <span>Select Folder</span>
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

          {/* Active Transfers */}
          {activeTransfers.length > 0 && (
            <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs space-y-2.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Transferring ({activeTransfers.length})
              </h4>
              <div className="space-y-2">
                {activeTransfers.map((item) => (
                  <div
                    key={item.fileId}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 overflow-hidden pr-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 text-zinc-400 text-[11px]">
                        <span>{formatSpeed(item.speed)}</span>
                        <span>{formatTimeRemaining(item.eta)}</span>
                        <button
                          onClick={() => onCancelTransfer(item.fileId)}
                          className="hover:text-rose-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-zinc-900 dark:bg-zinc-100 h-full rounded-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                      <span>{formatBytes(item.bytesTransferred)} / {formatBytes(item.totalBytes)}</span>
                      <span>{item.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Received Files List */}
          <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Received Files ({receivedFiles.length})
              </h4>
              {receivedFiles.length > 1 && (
                <button
                  onClick={onDownloadAllZip}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 transition-opacity hover:opacity-90"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Download All (.zip)</span>
                </button>
              )}
            </div>

            {receivedFiles.length === 0 ? (
              <div className="text-center py-8 text-zinc-400 text-xs">
                No files received yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {receivedFiles.map((file) => (
                  <div
                    key={file.fileId}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden pr-2">
                      {file.previewUrl ? (
                        <img
                          src={file.previewUrl}
                          alt={file.name}
                          onClick={() => setSelectedImagePreview(file.previewUrl)}
                          className="w-9 h-9 object-cover rounded-lg cursor-pointer border border-zinc-200 dark:border-zinc-700"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-500 shrink-0">
                          <File className="w-4 h-4" />
                        </div>
                      )}

                      <div className="overflow-hidden">
                        <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-zinc-400 font-mono">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => triggerDownload(file.blob, file.name)}
                      className="p-1.5 rounded-lg bg-zinc-200/70 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 transition-colors shrink-0"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PHOTOS */}
      {activeTab === 'images' && (
        <div className="bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Shared Photos ({receivedImages.length})
            </h4>
          </div>

          {receivedImages.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-xs">
              No photos shared yet. Send images in Files tab to view them here.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {receivedImages.map((img) => (
                <div
                  key={img.fileId}
                  className="relative group rounded-xl overflow-hidden aspect-square border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"
                >
                  <img
                    src={img.previewUrl}
                    alt={img.name}
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
                    onClick={() => setSelectedImagePreview(img.previewUrl)}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => triggerDownload(img.blob, img.name)}
                      className="p-2 rounded-full bg-white text-zinc-900 shadow-sm"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedImagePreview(img.previewUrl)}
                      className="p-2 rounded-full bg-white text-zinc-900 shadow-sm"
                      title="View"
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

      {/* Lightbox Modal */}
      {selectedImagePreview && (
        <div
          onClick={() => setSelectedImagePreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute -top-9 right-0 p-1 text-white hover:text-zinc-300"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={selectedImagePreview}
              alt="Fullscreen preview"
              className="max-w-full max-h-[85vh] rounded-xl object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
}
