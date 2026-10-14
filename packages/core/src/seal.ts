/**
 * End-to-end encryption for group events.
 * The group key lives only in the invite link (after the # sign) and on member devices.
 * The server stores sealed events and a hash of an access token. It cannot read the events.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array<ArrayBuffer> {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

export interface GroupSecret {
  /** Public group id, 22 characters. */
  gid: string;
  /** Raw 32-byte key, base64url. Never sent to the server. */
  key: string;
}

export function newGroupSecret(): GroupSecret {
  return {
    gid: toB64u(crypto.getRandomValues(new Uint8Array(16))),
    key: toB64u(crypto.getRandomValues(new Uint8Array(32))),
  };
}

async function hkdf(keyB64: string, info: string, usage: "encrypt" | "token") {
  const base = await crypto.subtle.importKey("raw", fromB64u(keyB64), "HKDF", false, [
    "deriveKey",
    "deriveBits",
  ]);
  const params = { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) };
  if (usage === "token") return new Uint8Array(await crypto.subtle.deriveBits(params, base, 256));
  return crypto.subtle.deriveKey(params, base, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Access token that proves a device holds the group key. The server stores only its hash. */
export async function accessToken(secret: GroupSecret): Promise<string> {
  return toB64u((await hkdf(secret.key, `rata/access/${secret.gid}`, "token")) as Uint8Array);
}

export async function sha256B64u(s: string): Promise<string> {
  return toB64u(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))));
}

const keyCache = new Map<string, Promise<CryptoKey>>();
function aesKey(secret: GroupSecret): Promise<CryptoKey> {
  const id = `${secret.gid}.${secret.key}`;
  let k = keyCache.get(id);
  if (!k) {
    k = hkdf(secret.key, `rata/events/${secret.gid}`, "encrypt") as Promise<CryptoKey>;
    keyCache.set(id, k);
  }
  return k;
}

/** Seal any JSON value. Output: base64url(iv || ciphertext). */
export async function seal(secret: GroupSecret, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(secret),
      enc.encode(JSON.stringify(value)),
    ),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return toB64u(out);
}

export async function open<T = unknown>(secret: GroupSecret, sealed: string): Promise<T> {
  const raw = fromB64u(sealed);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12) },
    await aesKey(secret),
    raw.slice(12),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

/** Invite link fragment: "<gid>.<key>". */
export function encodeInvite(secret: GroupSecret): string {
  return `${secret.gid}.${secret.key}`;
}

export function decodeInvite(fragment: string): GroupSecret | null {
  const m = /([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})/.exec(fragment);
  return m?.[1] && m[2] ? { gid: m[1], key: m[2] } : null;
}
