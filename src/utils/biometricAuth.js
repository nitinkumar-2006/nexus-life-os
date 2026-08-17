// src/utils/biometricAuth.js
//
// Biometric lock, with two real implementations picked automatically by
// platform:
//
// - Native (Capacitor.isNativePlatform() true, i.e. the actual Android
//   app shell): routes to nativeBiometric.js, which calls the installed
//   @aparajita/capacitor-biometric-auth plugin - a real native
//   BiometricPrompt, the same system dialog Android's own Settings uses.
// - Web (the Netlify deployment, or the app running in a desktop
//   browser): unchanged WebAuthn implementation below, using the
//   platform's own navigator.credentials API. This genuinely works
//   inside a Capacitor Android WebView too via the system biometric
//   prompt, but a real native plugin is more reliable there, so native
//   platforms now use that path instead.
//
// Every exported function has the same signature and contract regardless
// of which path runs underneath, so BiometricLockScreen.jsx,
// ProtectedModuleGate.jsx, and SettingsPage.jsx never need to know which
// implementation is active.
import { Capacitor } from '@capacitor/core';
import { isNativeBiometricAvailable, registerNativeBiometric, verifyNativeBiometric } from './nativeBiometric.js';

const BIOMETRIC_ENABLED_KEY = 'nexus_biometric_lock_enabled';
const BIOMETRIC_CREDENTIAL_KEY = 'nexus_biometric_credential_id';

// Genuine platform-support check. On native, biometric hardware support
// is effectively universal on modern Android devices - actual enrollment
// is checked (async) when registerBiometric() is called, same as the web
// path never checks real enrollment here either, only API availability.
export const isBiometricSupported = () => {
    if (isNativeBiometricAvailable()) return true;
    return typeof window !== 'undefined' &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        typeof navigator !== 'undefined' &&
        !!navigator.credentials;
};

export const isBiometricLockEnabled = () => localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';

const randomChallenge = () => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return bytes;
};

const bufferToBase64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));
const base64ToBuffer = (base64) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

// Real registration. On native this just confirms biometry is actually
// enrolled and usable (there's no separate "create a credential" step at
// the OS level like WebAuthn has - authenticate() below always challenges
// whatever is currently enrolled). On web, genuinely prompts the system
// biometric UI and persists the real credential ID this device just
// created so a later unlock attempt can reference the exact same one.
export const registerBiometric = async (userEmail) => {
    if (Capacitor.isNativePlatform()) {
        await registerNativeBiometric();
        localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
        return true;
    }

    if (!isBiometricSupported()) throw new Error('Biometric authentication is not supported on this device.');

    const publicKey = {
        challenge: randomChallenge(),
        rp: { name: 'Nexus Life OS' },
        user: {
            id: randomChallenge(),
            name: userEmail || 'nexus-user',
            displayName: userEmail || 'Nexus User',
        },
        // ES256 - the real, standard, near-universally-supported
        // algorithm for WebAuthn platform authenticators.
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
            // 'platform' genuinely restricts this to the device's own
            // built-in authenticator (fingerprint/face) rather than a
            // real external security key - the actual "biometric"
            // part of this feature.
            authenticatorAttachment: 'platform',
            userVerification: 'required',
        },
        timeout: 60000,
    };

    const credential = await navigator.credentials.create({ publicKey });
    if (!credential) throw new Error('Biometric registration was cancelled.');

    const credentialId = bufferToBase64(credential.rawId);
    localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    return true;
};

// Real verification. On native this genuinely prompts the OS
// BiometricPrompt via nativeBiometric.js. On web, prompts the system
// biometric UI again and only resolves true if the device's own
// authenticator confirms the same real credential registered above.
export const verifyBiometric = async () => {
    if (Capacitor.isNativePlatform()) return verifyNativeBiometric();

    const storedId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
    if (!storedId || !isBiometricSupported()) return false;

    const publicKey = {
        challenge: randomChallenge(),
        allowCredentials: [{ id: base64ToBuffer(storedId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
    };

    try {
        const assertion = await navigator.credentials.get({ publicKey });
        return !!assertion;
    } catch (e) {
        // A real cancellation or failed match - not a supported/error
        // distinction the caller needs, since either way the lock
        // genuinely stays shut.
        return false;
    }
};

export const disableBiometricLock = () => {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
};
