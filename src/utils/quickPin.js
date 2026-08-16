// src/utils/quickPin.js
//
// "Quick Sign-In PIN" - lets a returning user unlock an already-persisted
// Firebase session with a 4-digit PIN instead of retyping their password
// every time they open the app on this device (see QuickPinUnlockScreen.jsx
// + AppRoot.jsx's Gate).
//
// Unified with the App PIN (settings.appPin, set from SettingsPage's
// Security & API card) rather than kept as its own separate stored hash -
// previously these were two nearly-identical "type a 4-digit PIN" setup
// flows for what most people experience as one idea ("my app PIN"), which
// is exactly the redundant-feeling duplication this merge removes. Setting
// a PIN in Settings now does both jobs at once: gates locked modules
// while already inside the app, AND unlocks the app entry point itself.
// This file reads that same value directly from localStorage (rather than
// importing React state) since it's called from QuickPinUnlockScreen.jsx,
// mounted outside SettingsPage entirely.
//
// This never replaces real Firebase authentication - it only ever gates
// whether an ALREADY-valid, Firebase-persisted session is shown or not.
// A first sign-in (or a session after an explicit sign-out) always goes
// through LoginPage's real email/phone + password flow first.
import { verifyPin } from './pinSecurity.js';

const GLOBAL_SETTINGS_KEY = 'nexus_global_settings';

const readAppPinHash = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(GLOBAL_SETTINGS_KEY) || '{}');
        return typeof saved.appPin === 'string' ? saved.appPin : '';
    } catch (e) {
        return '';
    }
};

export const isQuickPinEnabled = () => !!readAppPinHash();

// Real, on-logout cleanup - a stale App PIN left behind would otherwise
// gate the NEXT sign-in on this device (same account signing back in
// later, or a different person on a shared device) behind a PIN that
// session never configured, with no way to know it. This also resets any
// Protected Modules selection made in Settings (they're gated by this
// same PIN) - a deliberate, accepted tradeoff of the merge: the
// alternative (leaving the PIN set) would let a different person signing
// in on this same device inherit the previous account's PIN gate, which
// is the worse of the two outcomes.
export const clearQuickPin = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(GLOBAL_SETTINGS_KEY) || '{}');
        if (!saved.appPin && (!saved.lockedModules || saved.lockedModules.length === 0)) return;
        const next = { ...saved, appPin: '', lockedModules: [] };
        localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('storage'));
    } catch (e) {
        /* malformed settings - nothing safe to clear */
    }
};

export const verifyQuickPin = async (candidatePin) => {
    const storedHash = readAppPinHash();
    if (!storedHash) return false;
    return verifyPin(candidatePin, storedHash);
};
