// src/utils/pinSecurity.js
//
// Hashes the OS Lock PIN with SHA-256 (Web Crypto API) before it's ever
// persisted, rather than storing the 4 raw digits in localStorage as plain
// text. A 4-digit PIN's keyspace (10,000 combinations) means this doesn't
// provide strong protection against a determined attacker with local
// access trying every combination against the stored hash - but it does
// mean the PIN itself is never sitting in localStorage as human-readable
// plain text, which is the meaningful, honest security property this
// actually delivers.
const encodeText = (text) => new TextEncoder().encode(text);

const bufferToHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

export const hashPin = async (pin) => {
    const digest = await crypto.subtle.digest('SHA-256', encodeText(pin));
    return bufferToHex(digest);
};

// A stored value is only ever a real hash or an empty string - never the
// raw PIN - so "is a lock configured" is just "is there a stored value".
export const isPinConfigured = (storedHash) => !!storedHash;

// The one place "does this candidate PIN match" is ever checked, so
// whatever eventually consumes this (a lock screen, a settings change
// confirmation) doesn't need its own hashing/comparison logic duplicated.
export const verifyPin = async (candidatePin, storedHash) => {
    if (!storedHash) return false;
    const candidateHash = await hashPin(candidatePin);
    return candidateHash === storedHash;
};

// A PIN is only ever valid as exactly 4 digits, or completely empty
// (which means "no lock configured") - anything else (wrong length,
// non-digit characters) is invalid and should never reach hashPin/storage.
export const isValidPinInput = (value) => value === '' || /^\d{4}$/.test(value);
