/**
 * तरंग end-to-end encryption helpers (Web Crypto, AES-GCM).
 *
 * Used for the paths that pass THROUGH the server — chat, the live notepad, and
 * the Socket.IO file-relay fallback — so the server only ever sees ciphertext.
 * (Direct WebRTC DataChannels and media are already encrypted by DTLS/SRTP, so
 * they don't go through here.)
 *
 * The symmetric key is derived from the room code (+ optional PIN) with PBKDF2.
 * The key material never leaves the browser and is never sent to the server.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const SALT = enc.encode('tarang-e2e-v1');
const IV_LENGTH = 12;

// One-way hash of the room PIN, sent to the server as an access token so the
// server can gate joins WITHOUT ever learning the actual PIN.
export async function hashPin(pin) {
  if (!pin || !globalThis.crypto?.subtle) return '';
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(`tarang-pin::${pin}`));
  return bufToB64(buf);
}

export async function deriveRoomKey(roomCode, pin = '') {  if (!roomCode || !globalThis.crypto?.subtle) return null;
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(`${roomCode}::${pin || ''}`),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: SALT, iterations: 120000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// --- Text payloads (chat messages, synced notepad) ---

export async function encryptString(key, plaintext) {
  if (!key) return { e: false, c: plaintext ?? '' };
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext ?? ''));
  return { e: true, iv: bufToB64(iv), c: bufToB64(ct) };
}

export async function decryptString(key, payload) {
  if (payload == null) return '';
  // Tolerate plaintext (e.g. key not ready on sender)
  if (typeof payload === 'string') return payload;
  if (!payload.e) return payload.c ?? '';
  if (!key) return '';
  try {
    const iv = new Uint8Array(b64ToBuf(payload.iv));
    const ct = b64ToBuf(payload.c);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return dec.decode(pt);
  } catch {
    return ''; // wrong key / PIN mismatch — ignore rather than crash
  }
}

// --- Binary payloads (relay file chunks) — IV is prepended to the ciphertext ---

export async function encryptBytes(key, arrayBuffer) {
  if (!key) return arrayBuffer;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer);
  const out = new Uint8Array(IV_LENGTH + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), IV_LENGTH);
  return out.buffer;
}

export async function decryptBytes(key, arrayBuffer) {
  if (!key) return arrayBuffer;
  try {
    const buf = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer;
    const iv = new Uint8Array(buf, 0, IV_LENGTH);
    const ct = buf.slice(IV_LENGTH);
    return await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  } catch {
    return new ArrayBuffer(0);
  }
}

function bufToB64(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
