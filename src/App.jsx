import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Header from './components/Header';
import Lobby from './components/Lobby';
import RoomView from './components/RoomView';
import QRCodeModal from './components/QRCodeModal';

import { getDeviceInfo } from './utils/device';
import { TransferManager } from './utils/transferManager';
import { createZipFromFiles, triggerDownload } from './utils/zip';
import { deriveRoomKey, encryptString, decryptString, hashPin } from './utils/crypto';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('tarang_theme') || 'dark';
  });

  const [deviceInfo, setDeviceInfo] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [roomPin, setRoomPin] = useState('');
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [isDirectP2P, setIsDirectP2P] = useState(false);

  const [activeTransfers, setActiveTransfers] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [syncedText, setSyncedText] = useState('');
  const [messages, setMessages] = useState([]);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({ primaryIp: window.location.hostname, port: window.location.port || 3000 });

  // Connection mode for the live badge: 'idle' | 'connecting' | 'direct' | 'relay'
  const [connectionMode, setConnectionMode] = useState('idle');

  // Live call (camera / screen share) state
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]); // [{ peerId, stream }]
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Prompt shown when trying to enter a PIN-locked room
  const [lockPrompt, setLockPrompt] = useState(null); // { code, reason }
  const [lockPinInput, setLockPinInput] = useState('');

  const transferManagerRef = useRef(null);
  const iceServersRef = useRef(null);
  const cryptoKeyRef = useRef(null);
  const pinHashRef = useRef('');

  // Initialize theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('tarang_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch network info + ICE servers (STUN/TURN) for WebRTC
  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);

    fetch('/api/info')
      .then((res) => res.json())
      .then((data) => {
        if (data?.primaryIp) {
          setNetworkInfo(data);
        }
      })
      .catch(() => {});

    fetch('/api/ice')
      .then((res) => res.json())
      .then((data) => {
        if (data?.iceServers?.length) {
          iceServersRef.current = data.iceServers;
        }
      })
      .catch(() => {});
  }, []);

  // Track roomCode in ref for reconnect handler
  const roomCodeRef = useRef(roomCode);
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  // Track deviceInfo in ref
  const deviceInfoRef = useRef(deviceInfo);
  useEffect(() => {
    deviceInfoRef.current = deviceInfo;
  }, [deviceInfo]);

  // Derive the end-to-end encryption key from the room code (+ optional PIN).
  // Stays entirely in the browser; never sent to the server.
  useEffect(() => {
    if (!roomCode) {
      cryptoKeyRef.current = null;
      return;
    }
    let active = true;
    deriveRoomKey(roomCode, roomPin).then((key) => {
      if (!active) return;
      cryptoKeyRef.current = key;
      transferManagerRef.current?.setCryptoKey(key);
    });
    return () => {
      active = false;
    };
  }, [roomCode, roomPin]);

  // Initialize Socket.io with robust auto-reconnection and room re-joining
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to signaling server:', newSocket.id);

      // If user was already in a room and reconnected, automatically re-join the room!
      if (roomCodeRef.current) {
        console.log('Auto-rejoining room after reconnect:', roomCodeRef.current);
        newSocket.emit('join-room', {
          roomId: roomCodeRef.current,
          deviceMeta: deviceInfoRef.current,
          pinHash: pinHashRef.current,
        });
      }
    });

    // Server refused entry to a locked room — prompt for the PIN.
    newSocket.on('join-rejected', ({ roomId, reason }) => {
      setRoomCode(null);
      setPeers([]);
      setLockPinInput('');
      setLockPrompt({ code: roomId, reason });
    });

    newSocket.on('disconnect', (reason) => {
      console.warn('Socket disconnected:', reason);
      setIsConnected(false);
      // If server disconnected, socket.io will automatically try to reconnect
    });

    newSocket.io.on('reconnect', (attempt) => {
      console.log(`Socket reconnected after ${attempt} attempts`);
    });

    setSocket(newSocket);

    // Keep-alive heartbeat ping every 25 seconds to prevent browser/proxy timeouts
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping-server');
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      newSocket.disconnect();
    };
  }, []);

  // Check URL query parameters for direct room link (e.g. ?room=842-194)
  useEffect(() => {
    if (!socket || !isConnected) return;

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && !roomCode) {
      joinRoom(roomParam.toUpperCase());
    }
  }, [socket, isConnected]);

  // Manage Room & Peers
  useEffect(() => {
    if (!socket || !roomCode) return;

    // Initialize Transfer Manager
    const manager = new TransferManager(
      socket,
      socket.id,
      {
        onPeerConnected: (peerId) => {
          console.log('P2P connected with peer:', peerId);
          setIsDirectP2P(true);
        },
        onPeerDisconnected: (peerId) => {
          setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId));
        },
        onChannelOpen: () => {
          setIsDirectP2P(true);
        },
        onConnectionModeChange: (mode) => {
          setConnectionMode(mode);
          setIsDirectP2P(mode === 'direct');
        },
        onRemoteStream: (peerId, stream) => {
          setRemoteStreams((prev) => [
            ...prev.filter((r) => r.peerId !== peerId),
            { peerId, stream },
          ]);
        },
        onCallEnded: () => {
          setLocalStream(null);
          setIsScreenSharing(false);
        },
        onTransferStart: (item) => {
          setActiveTransfers((prev) => [
            ...prev.filter((t) => t.fileId !== item.fileId),
            { ...item, progress: 0, speed: 0, bytesTransferred: 0, totalBytes: item.size, eta: 0 },
          ]);
        },
        onTransferProgress: (progressData) => {
          setActiveTransfers((prev) =>
            prev.map((t) => (t.fileId === progressData.fileId ? { ...t, ...progressData } : t))
          );
        },
        onTransferComplete: ({ fileId }) => {
          setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
        },
        onFileReceived: (fileItem) => {
          setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileItem.fileId));
          setReceivedFiles((prev) => [fileItem, ...prev]);
        },
      },
      { iceServers: iceServersRef.current, cryptoKey: cryptoKeyRef.current }
    );

    transferManagerRef.current = manager;
    // Ensure the manager has the latest derived key (derivation may still be in flight)
    if (cryptoKeyRef.current) manager.setCryptoKey(cryptoKeyRef.current);

    // Socket Room Listeners
    socket.on('room-joined', ({ peers: existingPeers }) => {
      setPeers(existingPeers);
      // Wait for existing peers to send WebRTC offer, or initiate if peer has lower id
      existingPeers.forEach((p) => {
        if (socket.id > p.id) {
          manager.connectToPeer(p.id);
        }
      });
    });

    socket.on('peer-joined', ({ peer }) => {
      setPeers((prev) => [...prev.filter((p) => p.id !== peer.id), peer]);
      if (socket.id > peer.id) {
        manager.connectToPeer(peer.id);
      }
    });

    socket.on('peer-left', ({ peerId }) => {
      setPeers((prev) => prev.filter((p) => p.id !== peerId));
      setRemoteStreams((prev) => prev.filter((r) => r.peerId !== peerId));
      manager.cleanupPeer(peerId);
      if (peers.length <= 1) {
        setIsDirectP2P(false);
      }
    });

    socket.on('sync-text', async ({ text }) => {
      const plain = await decryptString(cryptoKeyRef.current, text);
      setSyncedText(plain);
    });

    socket.on('receive-message', async ({ message }) => {
      const json = await decryptString(cryptoKeyRef.current, message);
      if (!json) return;
      try {
        const obj = JSON.parse(json);
        setMessages((prev) => [...prev, { ...obj, isMe: false }]);
      } catch {
        /* wrong key / PIN mismatch — drop */
      }
    });

    return () => {
      socket.off('room-joined');
      socket.off('peer-joined');
      socket.off('peer-left');
      socket.off('sync-text');
      socket.off('receive-message');
      manager.destroy();
    };
  }, [socket, roomCode]);

  // Join Room Action
  const joinRoom = async (code, pin = '') => {
    if (!socket || !code) return;
    const cleanCode = String(code).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleanCode) return;
    const cleanPin = (pin || '').trim();
    setRoomPin(cleanPin);
    setRoomCode(cleanCode);

    // Clean address bar so refreshing the page starts fresh on Lobby with new code!
    window.history.replaceState({}, '', window.location.pathname);

    const ph = await hashPin(cleanPin);
    pinHashRef.current = ph;

    socket.emit('join-room', {
      roomId: cleanCode,
      deviceMeta: deviceInfo,
      pinHash: ph,
    });
  };

  // Generate 6-digit formatted room code (e.g. 842194)
  const generateNewRoomCode = (pin) => {
    const effectivePin = typeof pin === 'string' ? pin : roomPin; // ignore event objects
    const part1 = Math.floor(100 + Math.random() * 900);
    const part2 = Math.floor(100 + Math.random() * 900);
    const newCode = `${part1}${part2}`;
    joinRoom(newCode, effectivePin);
  };

  // Leave Room Action
  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit('leave-room');
    }
    transferManagerRef.current?.stopLocalMedia();
    setRoomCode(null);
    setRoomPin('');
    setPeers([]);
    setActiveTransfers([]);
    setReceivedFiles([]);
    setSyncedText('');
    setMessages([]);
    setIsDirectP2P(false);
    setConnectionMode('idle');
    setLocalStream(null);
    setRemoteStreams([]);
    setIsScreenSharing(false);

    window.history.replaceState({}, '', window.location.pathname);
  };

  // --- Live Call: camera / screen share ---
  const handleStartCamera = async () => {
    if (!transferManagerRef.current) return;
    if (peers.length === 0) {
      alert('No other device is in the room yet. Connect your other device first.');
      return;
    }
    try {
      const stream = await transferManagerRef.current.startLocalMedia({ screen: false });
      setLocalStream(stream);
      setIsScreenSharing(false);
      setMicEnabled(true);
      setCameraEnabled(true);
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera/microphone. Check browser permissions.');
    }
  };

  const handleStartScreenShare = async () => {
    if (!transferManagerRef.current) return;
    if (peers.length === 0) {
      alert('No other device is in the room yet. Connect your other device first.');
      return;
    }
    try {
      const stream = await transferManagerRef.current.startLocalMedia({ screen: true });
      setLocalStream(stream);
      setIsScreenSharing(true);
    } catch (err) {
      console.error('Screen share error:', err);
    }
  };

  const handleEndCall = () => {
    transferManagerRef.current?.stopLocalMedia();
    setLocalStream(null);
    setIsScreenSharing(false);
  };

  const handleToggleMic = () => {
    const next = !micEnabled;
    transferManagerRef.current?.setAudioEnabled(next);
    setMicEnabled(next);
  };

  const handleToggleCamera = () => {
    const next = !cameraEnabled;
    transferManagerRef.current?.setVideoEnabled(next);
    setCameraEnabled(next);
  };

  // Set / change / clear the room PIN from inside the room. Locks the room on
  // the server (gating new joiners) and re-derives the encryption key live.
  const handleSetPin = async (pin) => {
    const cleanPin = (pin || '').trim();
    setRoomPin(cleanPin);
    const ph = await hashPin(cleanPin);
    pinHashRef.current = ph;
    if (socket && roomCode) {
      socket.emit('set-room-lock', { roomId: roomCode, pinHash: ph });
    }
  };

  // Send Files to all connected peers
  const handleSendFiles = async (files) => {
    if (!transferManagerRef.current) return;
    if (peers.length === 0) {
      alert('No other device is currently in the room! Scan the QR code or share the code on your other device first.');
      return;
    }

    for (const file of files) {
      for (const peer of peers) {
        await transferManagerRef.current.sendFile(file, peer.id, file.customPath || file.webkitRelativePath);
      }
    }
  };

  // Cancel in-flight transfer
  const handleCancelTransfer = (fileId) => {
    transferManagerRef.current?.cancelTransfer(fileId);
    setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
  };

  // Real-time Text synchronization (payload end-to-end encrypted)
  const handleTextChange = async (text) => {
    setSyncedText(text);
    if (socket && roomCode) {
      socket.emit('sync-text', {
        roomId: roomCode,
        text: await encryptString(cryptoKeyRef.current, text),
      });
    }
  };

  // Real-time Text Messaging & Snippet sending (payload end-to-end encrypted)
  const handleSendMessage = async (text) => {
    if (!text || !roomCode) return;
    const msgObj = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      text,
      senderId: socket?.id,
      senderName: deviceInfo?.deviceName || 'Device',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, { ...msgObj, isMe: true }]);

    if (socket) {
      const payload = await encryptString(cryptoKeyRef.current, JSON.stringify(msgObj));
      socket.emit('send-message', {
        roomId: roomCode,
        message: payload,
      });
    }
  };

  // Download all received files as a single ZIP
  const handleDownloadAllZip = async () => {
    if (receivedFiles.length === 0) return;
    const items = receivedFiles.map((f) => ({
      name: f.name,
      path: f.relativePath || f.name,
      blob: f.blob,
    }));
    const zipBlob = await createZipFromFiles(items);
    triggerDownload(zipBlob, `Tarang-${roomCode || 'bundle'}.zip`);
  };

  // Direct Join URL (clean, transparent, no proxy/tunnel masking)
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const baseOrigin = isLocal && networkInfo.primaryIp
    ? `http://${networkInfo.primaryIp}:${window.location.port || 5000}`
    : window.location.origin;

  const joinUrl = `${baseOrigin}/?room=${roomCode || ''}`;

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500 font-sans">
      
      {/* Ambient subtle background orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-zinc-400/10 dark:bg-zinc-800/20 rounded-full blur-3xl animate-glow-1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-500/10 dark:bg-zinc-700/20 rounded-full blur-3xl animate-glow-2" />
      </div>

      {/* Header */}
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        deviceInfo={deviceInfo}
        isConnected={isConnected}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center py-6">
        {!roomCode ? (
          <Lobby
            onJoinRoom={joinRoom}
            onGenerateCode={generateNewRoomCode}
          />
        ) : (
          <RoomView
            roomCode={roomCode}
            peers={peers}
            deviceInfo={deviceInfo}
            onLeaveRoom={handleLeaveRoom}
            onNewRoomCode={generateNewRoomCode}
            onOpenQR={() => setIsQRModalOpen(true)}
            onSendFiles={handleSendFiles}
            onDownloadAllZip={handleDownloadAllZip}
            activeTransfers={activeTransfers}
            receivedFiles={receivedFiles}
            onCancelTransfer={handleCancelTransfer}
            syncedText={syncedText}
            onTextChange={handleTextChange}
            messages={messages}
            onSendMessage={handleSendMessage}
            isDirectP2P={isDirectP2P}
            connectionMode={connectionMode}
            isPinProtected={!!roomPin}
            roomPin={roomPin}
            onSetPin={handleSetPin}
            localStream={localStream}
            remoteStreams={remoteStreams}
            micEnabled={micEnabled}
            cameraEnabled={cameraEnabled}
            isScreenSharing={isScreenSharing}
            onStartCamera={handleStartCamera}
            onStartScreenShare={handleStartScreenShare}
            onEndCall={handleEndCall}
            onToggleMic={handleToggleMic}
            onToggleCamera={handleToggleCamera}
          />
        )}
      </main>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomCode={roomCode}
        joinUrl={joinUrl}
      />

      {/* Locked-room PIN prompt */}
      {lockPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const code = lockPrompt.code;
              setLockPrompt(null);
              joinRoom(code, lockPinInput);
            }}
            className="w-full max-w-sm rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 shadow-xl p-6 space-y-4 animate-in zoom-in-95"
          >
            <div className="text-center space-y-1">
              <div className="text-3xl">🔒</div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                Room {lockPrompt.code} is locked
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {lockPrompt.reason === 'wrong-pin'
                  ? 'Incorrect PIN. Please try again.'
                  : 'Enter the PIN set by the room creator to join.'}
              </p>
            </div>

            <input
              autoFocus
              type="password"
              value={lockPinInput}
              onChange={(e) => setLockPinInput(e.target.value)}
              placeholder="Enter room PIN"
              className="w-full h-11 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 px-3.5 text-sm text-center text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-400 dark:focus:border-zinc-600"
            />

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLockPrompt(null);
                  setLockPinInput('');
                }}
                className="flex-1 h-10 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!lockPinInput.trim()}
                className="flex-1 h-10 rounded-xl text-xs font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                Join Room
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-zinc-400 dark:text-zinc-600 z-10">
        <p>© 2026 तरंग • Instant Peer-to-Peer Transfer</p>
      </footer>
    </div>
  );
}
