// src/utils/quickPin.js
//
// "Quick Sign-In PIN" - lets a returning user unlock an already-persisted
// Firebase session with a 4-digit PIN instead of retyping their password
// every time they open the app on this device. This is deliberately a
// SEPARATE stored hash from the "OS Lock PIN" in SettingsPage (settings.
// appPin) - that PIN's real job is gating individual locked modules/API
// fields while already inside the app; this one's job is the app-entry
// gate itself (see QuickPinUnlockScreen.jsx + AppRoot.jsx). Conflating the
// two would mean changing one for its own real purpose silently changes
// the other's behavior too.
//
// This never replaces real Firebase authentication - it only ever gates
// whether an ALREADY-valid, Firebase-persisted session is shown or not.
// A first sign-in (or a session after an explicit sign-out) always goes
// through LoginPage's real email/phone + password flow first.
import { hashPin, verifyPin, isValidPinInput } from './pinSecurity.js';

const QUICK_PIN_HASH_KEY = 'nexus_quickpin_hash';

export const isQuickPinEnabled = () => !!localStorage.getItem(QUICK_PIN_HASH_KEY);

export const saveQuickPin = async (pin) => {
    if (!isValidPinInput(pin) || pin === '') throw new Error('PIN must be exactly 4 digits.');
    const hash = await hashPin(pin);
    localStorage.setItem(QUICK_PIN_HASH_KEY, hash);
};

export const clearQuickPin = () => {
    localStorage.removeItem(QUICK_PIN_HASH_KEY);
};

export const verifyQuickPin = async (candidatePin) => {
    const storedHash = localStorage.getItem(QUICK_PIN_HASH_KEY);
    if (!storedHash) return false;
    return verifyPin(candidatePin, storedHash);
};
