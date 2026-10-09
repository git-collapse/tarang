# QuickDrop 🚀

An instant, direct device-to-device file, folder, image, and text sharing application inspired by **QuickSync (mohitlab.vercel.app)**.

Built with **React 19**, **Tailwind CSS v4**, **WebRTC DataChannels**, and **Socket.io**.

---

## ✨ Features

- ⚡ **Direct Peer-to-Peer Speed (WebRTC)**: Files transfer directly from device to device without uploading to intermediate servers. Unlimited file size, maximum Wi-Fi/LAN speed.
- 🌐 **Automatic Fallback Relay**: When strict NAT/firewalls block WebRTC, seamless Socket.io chunk streaming guarantees transfer reliability.
- 📁 **Files & Folders Support**:
  - Drag and drop single or multiple files.
  - Upload entire directory trees preserving relative folder hierarchy.
  - One-click **"Download All as ZIP"** using JSZip.
- 🖼️ **Image Gallery & Lightbox**:
  - Thumbnail previews for shared photos.
  - Full-screen lightbox viewer.
- 📝 **QuickSync Real-time Text**:
  - Synced clipboard notes area updating live on all devices as you type.
- 📱 **QR Code Mobile Pairing**:
  - Scan the on-screen QR code from your phone's camera to immediately pair without typing room codes.
  - Automatically detects your local Wi-Fi IP (e.g. `192.168.0.x:3000`).
- 🎨 **Sleek Glassmorphic UI**:
  - Dark / Light mode toggle.
  - Ambient glowing gradient background.
  - Satisfying confetti burst & procedural Web Audio chimes upon transfer completion.

---

## 🏃 Quick Start

### 1. Development Mode
```bash
npm run dev
```
Starts both backend signaling server (`http://localhost:5000`) and Vite dev server (`http://localhost:3000`).

### 2. Cross-Device Testing (Laptop to Phone / PC to PC)
1. Ensure both devices are on the same Wi-Fi network.
2. Open `http://localhost:3000` on your laptop.
3. Click **"Generate New Code"**.
4. Click **"Scan QR"** and scan the QR code with your mobile phone's camera (or open `http://<your-ip>:3000/?room=CODE`).
5. Start dropping files, folders, images, or typing text!

---

## 🚢 Production Deployment

### Build
```bash
npm run build
```

### Start
```bash
npm start
```
Starts the production server on port 5000 (or `$PORT`) which serves both the frontend static build and the Socket.IO signaling server.
