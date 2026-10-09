import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';

import Header from './components/Header';
import Lobby from './components/Lobby';
import RoomView from './components/RoomView';
import QRCodeModal from './components/QRCodeModal';

import { getDeviceInfo } from './utils/device';
import { TransferManager } from './utils/transferManager';
import { createZipFromFiles, triggerDownload } from './utils/zip';
import { playSuccessChime, playPeerJoinChime } from './utils/sound';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('quickdrop_theme') || 'dark';
  });

  const [deviceInfo, setDeviceInfo] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [peers, setPeers] = useState([]);
  const [isDirectP2P, setIsDirectP2P] = useState(false);

  const [activeTransfers, setActiveTransfers] = useState([]);
  const [receivedFiles, setReceivedFiles] = useState([]);
  const [syncedText, setSyncedText] = useState('');
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [networkInfo, setNetworkInfo] = useState({ primaryIp: window.location.hostname, port: window.location.port || 3000 });

  const transferManagerRef = useRef(null);

  // Initialize theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('quickdrop_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [tunnelUrl, setTunnelUrl] = useState(null);

  // Fetch LAN IP info and tunnel URL for mobile QR pairing
  useEffect(() => {
    const info = getDeviceInfo();
    setDeviceInfo(info);

    fetch('/api/info')
      .then((res) => res.json())
      .then((data) => {
        if (data?.primaryIp) {
          setNetworkInfo(data);
        }
        if (data?.tunnelUrl) {
          setTunnelUrl(data.tunnelUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Initialize Socket.io
  useEffect(() => {
    const newSocket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to signaling server:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('tunnel-updated', ({ tunnelUrl: newTunnel }) => {
      console.log('[Socket] Tunnel URL updated:', newTunnel);
      setTunnelUrl(newTunnel);
    });

    setSocket(newSocket);

    return () => {
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
    const manager = new TransferManager(socket, socket.id, {
      onPeerConnected: (peerId) => {
        console.log('P2P connected with peer:', peerId);
        setIsDirectP2P(true);
      },
      onChannelOpen: () => {
        setIsDirectP2P(true);
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
      onTransferComplete: ({ fileId, name, isSending }) => {
        setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
        playSuccessChime();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 },
        });
      },
      onFileReceived: (fileItem) => {
        setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileItem.fileId));
        setReceivedFiles((prev) => [fileItem, ...prev]);
        playSuccessChime();
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.7 },
        });
      },
    });

    transferManagerRef.current = manager;

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
      playPeerJoinChime();
      if (socket.id > peer.id) {
        manager.connectToPeer(peer.id);
      }
    });

    socket.on('peer-left', ({ peerId }) => {
      setPeers((prev) => prev.filter((p) => p.id !== peerId));
      manager.cleanupPeer(peerId);
      if (peers.length <= 1) {
        setIsDirectP2P(false);
      }
    });

    socket.on('sync-text', ({ text }) => {
      setSyncedText(text);
    });

    return () => {
      socket.off('room-joined');
      socket.off('peer-joined');
      socket.off('peer-left');
      socket.off('sync-text');
      manager.destroy();
    };
  }, [socket, roomCode]);

  // Join Room Action
  const joinRoom = (code) => {
    if (!socket || !code) return;
    const cleanCode = String(code).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (!cleanCode) return;
    setRoomCode(cleanCode);

    // Clean address bar so refreshing the page starts fresh on Lobby with new code!
    window.history.replaceState({}, '', window.location.pathname);

    socket.emit('join-room', {
      roomId: cleanCode,
      deviceMeta: deviceInfo,
    });
  };

  // Generate 6-digit formatted room code (e.g. 842194)
  const generateNewRoomCode = () => {
    const part1 = Math.floor(100 + Math.random() * 900);
    const part2 = Math.floor(100 + Math.random() * 900);
    const newCode = `${part1}${part2}`;
    joinRoom(newCode);
  };

  // Leave Room Action
  const handleLeaveRoom = () => {
    if (socket && roomCode) {
      socket.emit('leave-room');
    }
    setRoomCode(null);
    setPeers([]);
    setActiveTransfers([]);
    setReceivedFiles([]);
    setSyncedText('');
    setIsDirectP2P(false);

    window.history.replaceState({}, '', window.location.pathname);
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

  // Real-time Text synchronization
  const handleTextChange = (text) => {
    setSyncedText(text);
    if (socket && roomCode) {
      socket.emit('sync-text', { roomId: roomCode, text });
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
    triggerDownload(zipBlob, `QuickDrop-${roomCode || 'bundle'}.zip`);
  };

  // Formulate mobile QR join URLs:
  // When accessed via a deployed domain (like https://tarang-huvy.onrender.com), use window.location.origin!
  const isCloudDeployment = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  const joinUrl = isCloudDeployment
    ? `${window.location.origin}/?room=${roomCode || ''}`
    : (tunnelUrl 
        ? `${tunnelUrl}/?room=${roomCode || ''}`
        : `http://${networkInfo.primaryIp || 'localhost'}:${networkInfo.port || 3000}/?room=${roomCode || ''}`);

  const localWifiUrl = isCloudDeployment
    ? `${window.location.origin}/?room=${roomCode || ''}`
    : `http://${networkInfo.primaryIp || 'localhost'}:${networkInfo.port || 3000}/?room=${roomCode || ''}`;

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500 font-sans">
      
      {/* Ambient background pulsing orbs (inspired by QuickSync mohitlab.vercel.app) */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl animate-glow-1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl animate-glow-2" />
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
            isDirectP2P={isDirectP2P}
          />
        )}
      </main>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        roomCode={roomCode}
        joinUrl={joinUrl}
        tunnelUrl={tunnelUrl}
        localWifiUrl={localWifiUrl}
      />

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-zinc-400 dark:text-zinc-500 z-10">
        <p>© 2026 QuickDrop • Peer-to-Peer Direct Transfer • Zero Cloud Storage</p>
      </footer>
    </div>
  );
}
