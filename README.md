# तरंग 🌊

> **Waves of data between screens.**
> Instant, peer-to-peer file, folder, photo, and text messaging between devices with zero cloud storage.

Live Deployment: **[https://shubhamlab.onrender.com/]**

Built with **React 19**, **Tailwind CSS v4**, **WebRTC DataChannels**, and **Socket.io**.

---

## ✨ Features

- ⚡ **Direct Peer-to-Peer Speed (WebRTC)**: Files transfer directly from device to device without uploading to third-party servers. Unlimited file size, zero storage limits.
- 💬 **Real-time Messaging & Notes**:
  - Instant text and snippet stream with one-click copy on every message.
  - Automatic URL link detection.
  - Live synchronized collaborative notepad.
- 📁 **Files & Folders**:
  - Drag and drop single or multiple files.
  - Upload entire directory trees preserving relative folder hierarchy.
  - One-click **"Download All as ZIP"** bundle.
- 🖼️ **Photo Gallery & Lightbox**:
  - High-res thumbnail previews and full-screen lightbox viewer.
- 🎥 **Live Video & Screen Share (WebRTC)**:
  - Start a camera call or share your screen with the paired device over the same P2P connection, with mute / camera toggles.
- 📶 **Connection Transparency**:
  - A live badge shows whether you're on a **Direct P2P** link (fastest) or the **Relay** fallback.
- 📱 **QR Code Mobile Pairing**:
  - Scan with your phone's camera to pair in seconds without typing codes.
- 🎨 **Minimalist Design**:
  - Clean monochrome typography, dark/light theme, and distraction-free interface.

---

## 🔌 WebRTC / TURN configuration

The client fetches ICE servers from `GET /api/ice`. By default it serves Google STUN
plus free public TURN relays — enough for demos. For reliable direct connections in
production (especially on mobile / symmetric-NAT networks), set your own TURN
credentials as environment variables on the host (e.g. Render → Environment):

```
TURN_URL=turn:your-turn-host:3478,turns:your-turn-host:5349
TURN_USERNAME=your-username
TURN_CREDENTIAL=your-credential
```

Free managed TURN is available from Metered, Twilio, or self-hosted coturn.

---

## 🏃 Quick Start

### 1. Development Mode
```bash
npm run dev
```

### 2. Production Build
```bash
npm run build
npm start
```

---

## 🚢 Production Deployment

Deployed 24/7 on Render:
- URL: **[https://tarang-huvy.onrender.com](https://tarang-huvy.onrender.com)**
