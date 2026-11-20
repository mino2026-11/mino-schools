/**
 * MINO-SMS Web Cryptography Engine
 * AES-GCM-256 encryption and PBKDF2 key derivation.
 * The 6-digit PIN is NEVER stored in plaintext or database.
 */

const PBKDF2_ITERATIONS = 100000;
const CANARY_PLAINTEXT = 'MINO_OFFLINE_ENCRYPTED_VAULT_CANARY_V1';

// Convert ArrayBuffer to Hex String
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Convert Hex String to Uint8Array
export function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generate a cryptographically secure random salt (16 bytes)
 */
export function generateSalt(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a 12-byte IV for AES-GCM
 */
export function generateIV(): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Derive an AES-GCM-256 CryptoKey from a 6-digit PIN using PBKDF2
 */
export async function deriveKeyFromPin(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const pinKeyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    pinKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Unextractable key for defense in depth
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string or object using AES-GCM-256
 */
export async function encryptData(key: CryptoKey, data: any): Promise<{ cipherHex: string; ivHex: string }> {
  const enc = new TextEncoder();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = generateIV();

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer
    },
    key,
    enc.encode(plaintext)
  );

  return {
    cipherHex: bufferToHex(ciphertextBuffer),
    ivHex: bufferToHex(iv.buffer as ArrayBuffer)
  };
}

/**
 * Decrypt AES-GCM-256 ciphertext back to plaintext/object
 */
export async function decryptData<T = any>(key: CryptoKey, cipherHex: string, ivHex: string): Promise<T> {
  const iv = hexToBuffer(ivHex);
  const cipherBytes = hexToBuffer(cipherHex);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer as ArrayBuffer
    },
    key,
    cipherBytes.buffer as ArrayBuffer
  );

  const dec = new TextDecoder();
  const text = dec.decode(decryptedBuffer);

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

/**
 * Create a vault canary block during initial PIN setup
 */
export async function setupVaultCanary(key: CryptoKey, salt: Uint8Array) {
  const { cipherHex, ivHex } = await encryptData(key, CANARY_PLAINTEXT);
  return {
    saltHex: bufferToHex(salt.buffer as ArrayBuffer),
    canaryCipherHex: cipherHex,
    canaryIvHex: ivHex
  };
}

/**
 * Verify whether an entered PIN matches the vault canary
 */
export async function verifyPinAndDeriveKey(
  pin: string,
  saltHex: string,
  canaryCipherHex: string,
  canaryIvHex: string
): Promise<{ success: boolean; key?: CryptoKey; error?: string }> {
  try {
    const salt = hexToBuffer(saltHex);
    const key = await deriveKeyFromPin(pin, salt);
    const decrypted = await decryptData<string>(key, canaryCipherHex, canaryIvHex);

    if (decrypted === CANARY_PLAINTEXT) {
      return { success: true, key };
    }
    return { success: false, error: 'Incorrect PIN' };
  } catch (err) {
    return { success: false, error: 'Cryptographic decryption verification failed' };
  }
}

/**
 * Generate a SHA-256 tamper-evident digital receipt verification hash
 */
export async function generateReceiptHash(receiptData: {
  receiptNo: string;
  studentId: string;
  amountMinor: number;
  timestamp: string;
  schoolId: string;
}): Promise<string> {
  const enc = new TextEncoder();
  const payload = `${receiptData.schoolId}:${receiptData.receiptNo}:${receiptData.studentId}:${receiptData.amountMinor}:${receiptData.timestamp}`;
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', enc.encode(payload));
  return bufferToHex(hashBuffer);
}
