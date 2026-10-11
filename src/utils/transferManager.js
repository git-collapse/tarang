/**
 * DropSync Transfer Manager
 * Handles WebRTC P2P DataChannels with Socket.IO signaling and automatic relay fallback.
 */

import { encryptString, decryptString, encryptBytes, decryptBytes } from './crypto';

const CHUNK_SIZE = 64 * 1024; // 64 KB chunks
const BUFFER_THRESHOLD = 512 * 1024; // 512 KB buffer threshold for flow control

// STUN finds your public address; TURN relays media when direct P2P is blocked
// (symmetric NAT, strict firewalls). The TURN entries below are the free public
// Open Relay Project servers — fine for demos. For production reliability set
// TURN_URL / TURN_USERNAME / TURN_CREDENTIAL on the server and the client will
// fetch them from /api/ice (see App.jsx) and pass them in here.
export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export class TransferManager {
  constructor(socket, localPeerId, callbacks = {}, options = {}) {
    this.socket = socket;
    this.localPeerId = localPeerId;
    this.callbacks = callbacks;
    this.iceServers = options.iceServers?.length ? options.iceServers : DEFAULT_ICE_SERVERS;

    // peerId -> RTCPeerConnection
    this.peerConnections = new Map();
    // peerId -> RTCDataChannel
    this.dataChannels = new Map();
    // peerId -> array of queued ICE candidates before remote description is set
    this.queuedCandidates = new Map();
    // Perfect-negotiation bookkeeping (supports mid-call renegotiation for media)
    this.makingOffer = new Map();   // peerId -> bool
    this.politeFlags = new Map();   // peerId -> bool

    // Shared local media stream (camera / screen share) added to every peer
    this.localStream = null;
    this.lastMode = null;

    // AES-GCM key for encrypting server-relayed payloads (null = plaintext)
    this.cryptoKey = options.cryptoKey || null;

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

    // Fallback Socket Relay handlers (payloads are E2E-encrypted via this.cryptoKey)
    this.socket.on('relay-chunk-meta', async ({ fromPeerId, fileMeta }) => {
      try {
        const json = await decryptString(this.cryptoKey, fileMeta);
        this.handleIncomingMeta(JSON.parse(json), fromPeerId, 'relay');
      } catch (err) {
        console.warn('[relay] bad meta payload:', err);
      }
    });

    this.socket.on('relay-chunk-data', async ({ fileId, chunkIndex, data }) => {
      const plain = await decryptBytes(this.cryptoKey, data);
      this.handleIncomingChunk(fileId, chunkIndex, plain);
    });

    this.socket.on('relay-chunk-complete', ({ fileId }) => {
      this.handleIncomingComplete(fileId);
    });
  }

  setCryptoKey(key) {
    this.cryptoKey = key || null;
  }

  // --- WebRTC Connection Management ---

  createPeerConnection(targetPeerId, isInitiator) {
    if (this.peerConnections.has(targetPeerId)) {
      return this.peerConnections.get(targetPeerId);
    }

    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(targetPeerId, pc);
    this.makingOffer.set(targetPeerId, false);
    // The side that did NOT initiate is "polite": on a signaling collision it
    // yields, the impolite side wins. This keeps renegotiation glare-safe.
    this.politeFlags.set(targetPeerId, !isInitiator);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          targetPeerId,
          data: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Fires on initial connect AND whenever tracks are added/removed (media).
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer.set(targetPeerId, true);
        await pc.setLocalDescription();
        this.socket.emit('signal', {
          targetPeerId,
          data: { type: 'description', description: pc.localDescription },
        });
      } catch (err) {
        console.error('[P2P] negotiation error:', err);
      } finally {
        this.makingOffer.set(targetPeerId, false);
      }
    };

    // Remote camera / screen-share stream arrives here
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream && this.callbacks.onRemoteStream) {
        this.callbacks.onRemoteStream(targetPeerId, stream);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        if (this.callbacks.onPeerConnected) {
          this.callbacks.onPeerConnected(targetPeerId);
        }
      } else if (['disconnected', 'failed', 'closed'].includes(state)) {
        if (this.callbacks.onPeerDisconnected) {
          this.callbacks.onPeerDisconnected(targetPeerId);
        }
        this.cleanupPeer(targetPeerId);
      }
      this.updateMode();
    };

    // If a call is already in progress, share our media with the new peer too.
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
      this.applyBitrateCaps(pc, this.isScreenShare).catch(() => {});
    }

    if (isInitiator) {
      // Creating the channel triggers onnegotiationneeded, which sends the offer.
      const channel = pc.createDataChannel('tarang-data', { ordered: true });
      this.setupDataChannel(channel, targetPeerId);
      this.dataChannels.set(targetPeerId, channel);
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
      this.updateMode();
    };

    channel.onclose = () => {
      console.log(`[P2P] DataChannel closed with peer: ${peerId}`);
      this.updateMode();
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
    if (!pc) {
      // We're being contacted first, so we're the receiver (polite side).
      pc = this.createPeerConnection(fromPeerId, false);
    }
    const polite = this.politeFlags.get(fromPeerId);

    try {
      if (data.type === 'description') {
        const description = data.description;
        const offerCollision =
          description.type === 'offer' &&
          (this.makingOffer.get(fromPeerId) || pc.signalingState !== 'stable');

        // Impolite peer ignores a colliding offer; polite peer rolls back and accepts.
        if (!polite && offerCollision) {
          return;
        }

        await pc.setRemoteDescription(description);

        // Flush any ICE candidates that arrived before the remote description.
        const queued = this.queuedCandidates.get(fromPeerId) || [];
        for (const candidate of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            console.warn('Error adding queued ICE candidate:', e);
          }
        }
        this.queuedCandidates.delete(fromPeerId);

        if (description.type === 'offer') {
          await pc.setLocalDescription();
          this.socket.emit('signal', {
            targetPeerId: fromPeerId,
            data: { type: 'description', description: pc.localDescription },
          });
        }
      } else if (data.type === 'candidate') {
        if (pc.remoteDescription && pc.remoteDescription.type) {
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
    } catch (err) {
      console.error('[P2P] handleSignal error:', err);
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
    this.queuedCandidates.delete(peerId);
    this.makingOffer.delete(peerId);
    this.politeFlags.delete(peerId);
    this.updateMode();
  }

  // --- Connection mode (direct P2P vs relay fallback) for the UI badge ---

  updateMode() {
    let anyOpen = false;
    for (const [, channel] of this.dataChannels) {
      if (channel.readyState === 'open') {
        anyOpen = true;
        break;
      }
    }

    let anyFailed = false;
    for (const [, pc] of this.peerConnections) {
      if (['failed', 'disconnected'].includes(pc.connectionState)) {
        anyFailed = true;
        break;
      }
    }

    // Direct if a DataChannel is open; relay if the connection died but peers
    // remain (files still flow through the Socket.IO relay); else connecting.
    let mode;
    if (anyOpen) {
      mode = 'direct';
    } else if (this.peerConnections.size === 0) {
      mode = 'idle';
    } else if (anyFailed) {
      mode = 'relay';
    } else {
      mode = 'connecting';
    }

    if (mode !== this.lastMode) {
      this.lastMode = mode;
      if (this.callbacks.onConnectionModeChange) {
        this.callbacks.onConnectionModeChange(mode);
      }
    }
  }

  // --- Live media: camera / screen share over the same peer connections ---

  async startLocalMedia({ screen = false, video = true, audio = true } = {}) {
    let stream;
    if (screen) {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
    } else {
      stream = await navigator.mediaDevices.getUserMedia({
        video: video
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 24, max: 30 } }
          : false,
        audio,
      });
    }

    this.localStream = stream;
    this.isScreenShare = screen;

    // Hint the encoder: screen content favours sharpness, camera favours motion.
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.contentHint = screen ? 'detail' : 'motion';
    }

    // Add every track to every peer connection -> triggers renegotiation.
    for (const [, pc] of this.peerConnections) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
      await this.applyBitrateCaps(pc, screen);
    }

    // When the user stops a screen share from the browser's own UI, tear down.
    if (screen && videoTrack) {
      videoTrack.onended = () => this.stopLocalMedia();
    }

    if (this.callbacks.onLocalStream) {
      this.callbacks.onLocalStream(stream);
    }
    return stream;
  }

  // Cap bitrate / framerate so weak uplinks stay smooth instead of stuttering.
  async applyBitrateCaps(pc, screen) {
    for (const sender of pc.getSenders()) {
      if (sender.track?.kind !== 'video') continue;
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = screen ? 2500000 : 1200000; // 2.5 / 1.2 Mbps
        params.encodings[0].maxFramerate = screen ? 15 : 24;
        params.degradationPreference = screen ? 'maintain-resolution' : 'maintain-framerate';
        await sender.setParameters(params);
      } catch (err) {
        console.warn('[media] could not apply bitrate caps:', err);
      }
    }
  }

  stopLocalMedia() {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
    }
    for (const [, pc] of this.peerConnections) {
      for (const sender of pc.getSenders()) {
        if (sender.track) {
          try {
            pc.removeTrack(sender); // triggers renegotiation on the far side
          } catch {}
        }
      }
    }
    this.localStream = null;
    this.isScreenShare = false;
    if (this.callbacks.onCallEnded) {
      this.callbacks.onCallEnded();
    }
  }

  setAudioEnabled(enabled) {
    this.localStream?.getAudioTracks().forEach((t) => (t.enabled = enabled));
  }

  setVideoEnabled(enabled) {
    this.localStream?.getVideoTracks().forEach((t) => (t.enabled = enabled));
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
        fileMeta: await encryptString(this.cryptoKey, JSON.stringify(fileMeta)),
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
        // Fallback relay via Socket.IO (E2E-encrypted so the server can't read it)
        this.socket.emit('relay-chunk-data', {
          targetPeerId,
          fileId,
          chunkIndex,
          totalChunks,
          data: await encryptBytes(this.cryptoKey, chunk),
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
    this.stopLocalMedia();
    for (const [peerId] of this.peerConnections) {
      this.cleanupPeer(peerId);
    }
    this.peerConnections.clear();
    this.dataChannels.clear();
    this.incomingTransfers.clear();
    this.outgoingTransfers.clear();
  }
}
