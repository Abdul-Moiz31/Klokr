import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from "crypto";

// Symmetric encryption for at-rest secrets (BYOK provider keys). AES-256-GCM.
// The key is derived from AI_KEY_ENCRYPTION_SECRET (any string) via SHA-256 so
// it's always exactly 32 bytes. Generate the secret with: openssl rand -hex 32.

function getKey(): Buffer | null {
  const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

export function encryptSecret(plaintext: string): string | null {
  const key = getKey();
  if (!key) return null;
  const iv = randomBytes(12); // 96-bit nonce for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:ciphertext, all base64.
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string | null {
  const key = getKey();
  if (!key) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64!, "base64");
    const tag = Buffer.from(tagB64!, "base64");
    const data = Buffer.from(dataB64!, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null; // tampered or wrong key
  }
}

export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

// Constant-time string comparison for static shared secrets (admin password,
// cron bearer tokens) — a plain `!==` leaks a few nanoseconds of timing
// signal per matching byte, a real if slow side channel against a secret
// that never rotates. Always compares the full length of both inputs and
// never throws on a length mismatch (timingSafeEqual requires equal-length
// buffers).
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so a wrong-length guess doesn't return faster
    // than a wrong-content one of the right length.
    timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
