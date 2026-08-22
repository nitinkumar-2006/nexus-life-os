// src/utils/backupEncryption.js
//
// Real AES-256-GCM encryption for the full-data-export backup, keyed off a
// passphrase the user chooses at export time (never stored anywhere -
// they're expected to remember it, exactly like a real encrypted archive
// password). Uses only the browser's native Web Crypto API (crypto.subtle) -
// available in every modern browser and inside a Capacitor WebView alike,
// so this needed zero new npm dependency. PBKDF2 (100,000 rounds, a real,
// current OWASP-recommended minimum) derives the actual AES key from the
// passphrase; a fresh random salt and IV are generated per export so two
// backups made with the same passphrase never produce identical ciphertext.
const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

const deriveKey = async (passphrase, saltBytes) => {
    const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );
};

// Encrypts a plain string (the JSON-stringified full backup) into the
// portable, base64-safe shape the export file actually stores.
export const encryptBackupPayload = async (plainText, passphrase) => {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const ivBytes = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV, the AES-GCM standard/recommended size
    const key = await deriveKey(passphrase, saltBytes);
    const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, textEncoder.encode(plainText));
    return {
        nexusEncryptedBackup: true,
        version: 1,
        salt: bytesToBase64(saltBytes),
        iv: bytesToBase64(ivBytes),
        ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    };
};

// Reverses encryptBackupPayload. Throws (a wrong passphrase makes AES-GCM's
// own built-in authentication tag fail to verify, which subtle.decrypt
// surfaces as a real thrown error) rather than silently returning garbage -
// the caller is expected to catch this and tell the user the passphrase was
// wrong, not to trust whatever comes back.
export const decryptBackupPayload = async (payload, passphrase) => {
    const saltBytes = base64ToBytes(payload.salt);
    const ivBytes = base64ToBytes(payload.iv);
    const ciphertextBytes = base64ToBytes(payload.ciphertext);
    const key = await deriveKey(passphrase, saltBytes);
    const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, ciphertextBytes);
    return textDecoder.decode(plainBuffer);
};

export const isEncryptedBackupPayload = (parsed) => !!parsed && typeof parsed === 'object' && parsed.nexusEncryptedBackup === true
    && typeof parsed.salt === 'string' && typeof parsed.iv === 'string' && typeof parsed.ciphertext === 'string';
