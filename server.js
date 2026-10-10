import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 50 * 1024 * 1024, // 50MB buffer for fallback relay chunks
});

// Helper: Get local Wi-Fi / Ethernet IPv4 addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Skip internal (127.0.0.1) and non-ipv4
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push({
          interface: name,
          ip: net.address,
        });
      }
    }
  }
  return addresses;
}

// Endpoint to provide local network info
app.get('/api/info', (req, res) => {
  const ips = getLocalIpAddresses();
  const primaryIp = ips.find(i => /wi-fi|wlan|wireless/i.test(i.interface))?.ip 
    || ips.find(i => i.ip.startsWith('192.168.') || i.ip.startsWith('10.'))?.ip 
    || ips[0]?.ip 
    || 'localhost';

  res.json({
    primaryIp,
    interfaces: ips,
    port: process.env.PORT || 5000,
  });
});

// Helper to normalize room code (strips dashes, spaces, case-insensitive)
const normalizeRoomId = (id) => (id ? String(id).replace(/[^A-Za-z0-9]/g, '').toUpperCase() : '');

// Rooms data structure: roomId -> Map(socketId -> peerMeta)
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let userMeta = null;

  socket.on('join-room', ({ roomId, deviceMeta }) => {
    if (!roomId) return;
    
    currentRoom = normalizeRoomId(roomId);
    if (!currentRoom) return;

    userMeta = {
      id: socket.id,
      ...deviceMeta,
      joinedAt: Date.now(),
    };

    socket.join(currentRoom);

    if (!rooms.has(currentRoom)) {
      rooms.set(currentRoom, new Map());
    }

    const roomPeers = rooms.get(currentRoom);
    
    // Send existing peers in room to the newly joined peer
    const existingPeers = Array.from(roomPeers.values());
    socket.emit('room-joined', {
      roomId: currentRoom,
      yourId: socket.id,
      peers: existingPeers,
    });

    // Add current user to room
    roomPeers.set(socket.id, userMeta);

    // Notify other peers in the room
    socket.to(currentRoom).emit('peer-joined', {
      peer: userMeta,
    });

    console.log(`[Socket] ${socket.id} (${userMeta?.deviceName || 'Unknown'}) joined room: ${currentRoom} (Total peers: ${roomPeers.size})`);
  });

  // WebRTC Signaling: offer, answer, ice-candidate
  socket.on('signal', ({ targetPeerId, data }) => {
    if (targetPeerId) {
      io.to(targetPeerId).emit('signal', {
        fromPeerId: socket.id,
        data,
      });
    }
  });

  // Real-time Text / Note sharing (like QuickSync)
  socket.on('sync-text', ({ roomId, text }) => {
    const targetRoom = normalizeRoomId(roomId) || currentRoom;
    if (targetRoom) {
      socket.to(targetRoom).emit('sync-text', {
        fromPeerId: socket.id,
        text,
        updatedAt: Date.now(),
      });
    }
  });

  // Real-time Text Messaging & Snippet Feed
  socket.on('send-message', ({ roomId, message }) => {
    const targetRoom = normalizeRoomId(roomId) || currentRoom;
    if (targetRoom) {
      socket.to(targetRoom).emit('receive-message', {
        fromPeerId: socket.id,
        message,
      });
    }
  });

  // Fallback WebSocket Relay Transfer for files/chunks (guarantees transfer even when WebRTC NAT fails)
  socket.on('relay-chunk-meta', ({ targetPeerId, fileMeta }) => {
    if (targetPeerId) {
      io.to(targetPeerId).emit('relay-chunk-meta', {
        fromPeerId: socket.id,
        fileMeta,
      });
    } else if (currentRoom) {
      socket.to(currentRoom).emit('relay-chunk-meta', {
        fromPeerId: socket.id,
        fileMeta,
      });
    }
  });

  socket.on('relay-chunk-data', ({ targetPeerId, fileId, chunkIndex, totalChunks, data }) => {
    if (targetPeerId) {
      io.to(targetPeerId).emit('relay-chunk-data', {
        fromPeerId: socket.id,
        fileId,
        chunkIndex,
        totalChunks,
        data,
      });
    } else if (currentRoom) {
      socket.to(currentRoom).emit('relay-chunk-data', {
        fromPeerId: socket.id,
        fileId,
        chunkIndex,
        totalChunks,
        data,
      });
    }
  });

  socket.on('relay-chunk-complete', ({ targetPeerId, fileId }) => {
    if (targetPeerId) {
      io.to(targetPeerId).emit('relay-chunk-complete', {
        fromPeerId: socket.id,
        fileId,
      });
    } else if (currentRoom) {
      socket.to(currentRoom).emit('relay-chunk-complete', {
        fromPeerId: socket.id,
        fileId,
      });
    }
  });

  // Keep-alive heartbeat ping from client
  socket.on('ping-server', () => {
    socket.emit('pong-server', { timestamp: Date.now() });
  });

  // Handle Disconnect
  const leaveRoom = () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomPeers = rooms.get(currentRoom);
      roomPeers.delete(socket.id);

      socket.to(currentRoom).emit('peer-left', {
        peerId: socket.id,
      });

      console.log(`[Socket] ${socket.id} left room ${currentRoom}. Remaining: ${roomPeers.size}`);

      if (roomPeers.size === 0) {
        rooms.delete(currentRoom);
      }
    }
  };

  socket.on('leave-room', leaveRoom);
  socket.on('disconnect', leaveRoom);
});

// Serve frontend build in production
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// For SPA routing
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Tarang Server is running. In dev mode, open http://localhost:3000');
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`\n🚀 Tarang Server is running!`);
  console.log(`   - Local:    http://localhost:${PORT}`);
  ips.forEach((net) => {
    console.log(`   - Network (${net.interface}): http://${net.ip}:${PORT}`);
  });
  console.log(``);
});
