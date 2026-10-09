/**
 * DropSync Transfer Manager
 * Handles WebRTC P2P DataChannels with Socket.IO signaling and automatic relay fallback.
 */

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const BUFFER_THRESHOLD = 512 * 1024; // 512 KB buffer threshold for flow control

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class TransferManager {
  constructor(socket, localPeerId, callbacks = {}) {
    this.socket = socket;
    this.localPeerId = localPeerId;
    this.callbacks = callbacks;

    // peerId -> RTCPeerConnection
    this.peerConnections = new Map();
    // peerId -> RTCDataChannel
    this.dataChannels = new Map();
    // peerId -> Set of queued ICE candidates before remote description is set
    this.queuedCandidates = new Map();

    // fileId -> { meta, receivedChunks, totalReceivedBytes, startTime, lastTime, lastBytes }
    this.incomingTransfers = new Map();
    // fileId -> { isCancelled: boolean }
    this.outgoingTransfers = new Map();

    this.setupSocketListeners();
  }

  setupSocketListeners() {
    this.socket.on('signal', async ({ fromPeerId, data }) => {
      await this.handleSignal(fromPeerId, data);
    });

    // Fallback Socket Relay handlers
    this.socket.on('relay-chunk-meta', ({ fromPeerId, fileMeta }) => {
      this.handleIncomingMeta(fileMeta, fromPeerId, 'relay');
    });

    this.socket.on('relay-chunk-data', ({ fromPeerId, fileId, chunkIndex, data }) => {
      // data is ArrayBuffer or Base64/Buffer
      this.handleIncomingChunk(fileId, chunkIndex, data);
    });

    this.socket.on('relay-chunk-complete', ({ fileId }) => {
      this.handleIncomingComplete(fileId);
    });
  }

  // --- WebRTC Connection Management ---

  createPeerConnection(targetPeerId, isInitiator) {
    if (this.peerConnections.has(targetPeerId)) {
      return this.peerConnections.get(targetPeerId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(targetPeerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          targetPeerId,
          data: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        if (this.callbacks.onPeerConnected) {
          this.callbacks.onPeerConnected(targetPeerId);
        }
      } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        this.cleanupPeer(targetPeerId);
      }
    };

    if (isInitiator) {
      const channel = pc.createDataChannel('dropsync-data', { ordered: true });
      this.setupDataChannel(channel, targetPeerId);
      this.dataChannels.set(targetPeerId, channel);

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.socket.emit('signal', {
            targetPeerId,
            data: { type: 'offer', sdp: pc.localDescription },
          });
        })
        .catch((err) => console.error('Error creating offer:', err));
    } else {
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        this.setupDataChannel(channel, targetPeerId);
        this.dataChannels.set(targetPeerId, channel);
      };
    }

    return pc;
  }

  setupDataChannel(channel, peerId) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log(`[P2P] WebRTC DataChannel open with peer: ${peerId}`);
      if (this.callbacks.onChannelOpen) {
        this.callbacks.onChannelOpen(peerId);
      }
    };

    channel.onclose = () => {
      console.log(`[P2P] DataChannel closed with peer: ${peerId}`);
    };

    channel.onerror = (err) => {
      console.warn(`[P2P] DataChannel error with ${peerId}:`, err);
    };

    channel.onmessage = (event) => {
      this.handleChannelMessage(event.data, peerId);
    };
  }

  async handleSignal(fromPeerId, data) {
    let pc = this.peerConnections.get(fromPeerId);

    if (data.type === 'offer') {
      if (!pc) {
        pc = this.createPeerConnection(fromPeerId, false);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

      // Process any queued ICE candidates
      const queued = this.queuedCandidates.get(fromPeerId) || [];
      for (const candidate of queued) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.queuedCandidates.delete(fromPeerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('signal', {
        targetPeerId: fromPeerId,
        data: { type: 'answer', sdp: pc.localDescription },
      });
    } else if (data.type === 'answer') {
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

        const queued = this.queuedCandidates.get(fromPeerId) || [];
        for (const candidate of queued) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.queuedCandidates.delete(fromPeerId);
      }
    } else if (data.type === 'candidate') {
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.warn('Error adding ICE candidate:', e);
        }
      } else {
        if (!this.queuedCandidates.has(fromPeerId)) {
          this.queuedCandidates.set(fromPeerId, []);
        }
        this.queuedCandidates.get(fromPeerId).push(data.candidate);
      }
    }
  }

  connectToPeer(peerId) {
    this.createPeerConnection(peerId, true);
  }

  cleanupPeer(peerId) {
    if (this.dataChannels.has(peerId)) {
      try {
        this.dataChannels.get(peerId).close();
      } catch {}
      this.dataChannels.delete(peerId);
    }
    if (this.peerConnections.has(peerId)) {
      try {
        this.peerConnections.get(peerId).close();
      } catch {}
      this.peerConnections.delete(peerId);
    }
  }

  // --- Incoming Message & Chunk Handling ---

  handleChannelMessage(rawMsg, fromPeerId) {
    if (typeof rawMsg === 'string') {
      try {
        const payload = JSON.parse(rawMsg);
        if (payload.type === 'meta') {
          this.handleIncomingMeta(payload.fileMeta, fromPeerId, 'p2p');
        } else if (payload.type === 'complete') {
          this.handleIncomingComplete(payload.fileId);
        }
      } catch (err) {
        console.error('Failed to parse text message:', err);
      }
    } else if (rawMsg instanceof ArrayBuffer) {
      // Binary header: first 36 bytes = UUID (fileId string), followed by 4 bytes = chunkIndex (Uint32), then binary data
      const view = new DataView(rawMsg);
      const fileIdLength = view.getUint8(0);
      const textDecoder = new TextDecoder();
      const fileId = textDecoder.decode(new Uint8Array(rawMsg, 1, fileIdLength));
      const chunkIndex = view.getUint32(1 + fileIdLength);
      const chunkData = rawMsg.slice(1 + fileIdLength + 4);

      this.handleIncomingChunk(fileId, chunkIndex, chunkData);
    }
  }

  handleIncomingMeta(fileMeta, fromPeerId, method) {
    this.incomingTransfers.set(fileMeta.id, {
      meta: fileMeta,
      fromPeerId,
      method,
      receivedChunks: new Array(fileMeta.totalChunks),
      receivedCount: 0,
      totalReceivedBytes: 0,
      startTime: Date.now(),
      lastTime: Date.now(),
      lastBytes: 0,
      currentSpeed: 0,
    });

    if (this.callbacks.onTransferStart) {
      this.callbacks.onTransferStart({
        fileId: fileMeta.id,
        name: fileMeta.name,
        size: fileMeta.size,
        mimeType: fileMeta.mimeType,
        relativePath: fileMeta.relativePath,
        isSending: false,
      });
    }
  }

  handleIncomingChunk(fileId, chunkIndex, chunkData) {
    const transfer = this.incomingTransfers.get(fileId);
    if (!transfer) return;

    transfer.receivedChunks[chunkIndex] = chunkData;
    transfer.receivedCount += 1;
    transfer.totalReceivedBytes += chunkData.byteLength || chunkData.length || 0;

    const now = Date.now();
    const timeDiff = (now - transfer.lastTime) / 1000;
    if (timeDiff >= 0.5 || transfer.receivedCount === transfer.meta.totalChunks) {
      const bytesDiff = transfer.totalReceivedBytes - transfer.lastBytes;
      transfer.currentSpeed = bytesDiff / (timeDiff || 0.001);
      transfer.lastTime = now;
      transfer.lastBytes = transfer.totalReceivedBytes;

      const progress = Math.min(100, Math.round((transfer.totalReceivedBytes / transfer.meta.size) * 100));
      const remainingBytes = transfer.meta.size - transfer.totalReceivedBytes;
      const eta = transfer.currentSpeed > 0 ? remainingBytes / transfer.currentSpeed : 0;

      if (this.callbacks.onTransferProgress) {
        this.callbacks.onTransferProgress({
          fileId,
          name: transfer.meta.name,
          progress,
          speed: transfer.currentSpeed,
          bytesTransferred: transfer.totalReceivedBytes,
          totalBytes: transfer.meta.size,
          eta,
          isSending: false,
        });
      }
    }

    if (transfer.receivedCount === transfer.meta.totalChunks) {
      this.handleIncomingComplete(fileId);
    }
  }

  handleIncomingComplete(fileId) {
    const transfer = this.incomingTransfers.get(fileId);
    if (!transfer || transfer.completed) return;
    transfer.completed = true;

    const blob = new Blob(transfer.receivedChunks, { type: transfer.meta.mimeType || 'application/octet-stream' });
    let previewUrl = null;
    if (transfer.meta.mimeType?.startsWith('image/')) {
      previewUrl = URL.createObjectURL(blob);
    }

    if (this.callbacks.onFileReceived) {
      this.callbacks.onFileReceived({
        fileId,
        name: transfer.meta.name,
        size: transfer.meta.size,
        mimeType: transfer.meta.mimeType,
        relativePath: transfer.meta.relativePath,
        blob,
        previewUrl,
        receivedAt: Date.now(),
      });
    }

    // Cleanup transfer state after brief delay
    setTimeout(() => {
      this.incomingTransfers.delete(fileId);
    }, 5000);
  }

  // --- Outgoing File Transfer ---

  async sendFile(file, targetPeerId, relativePath = '') {
    const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const fileMeta = {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      relativePath: relativePath || file.webkitRelativePath || file.name,
      totalChunks,
      chunkSize: CHUNK_SIZE,
    };

    this.outgoingTransfers.set(fileId, { isCancelled: false });

    // Determine whether to use direct WebRTC DataChannel or WebSocket relay
    const channel = this.dataChannels.get(targetPeerId);
    const useP2P = channel && channel.readyState === 'open';

    if (this.callbacks.onTransferStart) {
      this.callbacks.onTransferStart({
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        relativePath: fileMeta.relativePath,
        isSending: true,
      });
    }

    // 1. Send metadata header
    if (useP2P) {
      channel.send(JSON.stringify({ type: 'meta', fileMeta }));
    } else {
      this.socket.emit('relay-chunk-meta', {
        targetPeerId,
        fileMeta,
      });
    }

    // 2. Stream chunks with flow control
    let offset = 0;
    let chunkIndex = 0;
    let bytesSent = 0;
    let lastTime = Date.now();
    let lastBytes = 0;
    let currentSpeed = 0;

    const fileBuffer = await file.arrayBuffer();

    while (offset < file.size) {
      if (this.outgoingTransfers.get(fileId)?.isCancelled) {
        console.log(`Transfer ${fileId} cancelled`);
        return;
      }

      const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);

      if (useP2P) {
        // Build binary buffer with header [idLen (1B), idStr (idLen B), chunkIndex (4B), chunkData]
        const encoder = new TextEncoder();
        const idBytes = encoder.encode(fileId);
        const headerLen = 1 + idBytes.length + 4;
        const packet = new Uint8Array(headerLen + chunk.byteLength);
        const view = new DataView(packet.buffer);

        view.setUint8(0, idBytes.length);
        packet.set(idBytes, 1);
        view.setUint32(1 + idBytes.length, chunkIndex);
        packet.set(new Uint8Array(chunk), headerLen);

        // WebRTC flow control to prevent buffer overflow
        if (channel.bufferedAmount > BUFFER_THRESHOLD) {
          await new Promise((resolve) => {
            channel.onbufferedamountlow = () => {
              channel.onbufferedamountlow = null;
              resolve();
            };
          });
        }

        channel.send(packet.buffer);
      } else {
        // Fallback relay via Socket.IO
        this.socket.emit('relay-chunk-data', {
          targetPeerId,
          fileId,
          chunkIndex,
          totalChunks,
          data: chunk,
        });

        // Small yield for socket relay flow
        if (chunkIndex % 8 === 0) {
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      offset += CHUNK_SIZE;
      chunkIndex += 1;
      bytesSent += chunk.byteLength;

      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      if (timeDiff >= 0.5 || bytesSent === file.size) {
        const bytesDiff = bytesSent - lastBytes;
        currentSpeed = bytesDiff / (timeDiff || 0.001);
        lastTime = now;
        lastBytes = bytesSent;

        const progress = Math.min(100, Math.round((bytesSent / file.size) * 100));
        const remainingBytes = file.size - bytesSent;
        const eta = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

        if (this.callbacks.onTransferProgress) {
          this.callbacks.onTransferProgress({
            fileId,
            name: file.name,
            progress,
            speed: currentSpeed,
            bytesTransferred: bytesSent,
            totalBytes: file.size,
            eta,
            isSending: true,
          });
        }
      }
    }

    // 3. Send complete signal
    if (useP2P) {
      channel.send(JSON.stringify({ type: 'complete', fileId }));
    } else {
      this.socket.emit('relay-chunk-complete', {
        targetPeerId,
        fileId,
      });
    }

    if (this.callbacks.onTransferComplete) {
      this.callbacks.onTransferComplete({ fileId, name: file.name, isSending: true });
    }

    setTimeout(() => {
      this.outgoingTransfers.delete(fileId);
    }, 5000);
  }

  cancelTransfer(fileId) {
    const outgoing = this.outgoingTransfers.get(fileId);
    if (outgoing) {
      outgoing.isCancelled = true;
    }
  }

  destroy() {
    for (const [peerId] of this.peerConnections) {
      this.cleanupPeer(peerId);
    }
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.incomingTransfers.clear();
    this.outgoingTransfers.clear();
  }
}
