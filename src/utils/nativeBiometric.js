// src/utils/nativeBiometric.js
//
// Real native fingerprint/face bridge for the Android app shell, via the
// installed @aparajita/capacitor-biometric-auth plugin (backed by
// androidx.biometric's real BiometricPrompt - the same system dialog
// Android's own Settings > Biometrics uses, not a custom UI). Native-only
// by construction, same pattern as nativeCalendarBridge.js/
// smsFinanceBridge.js: Capacitor.isNativePlatform() is false in every
// browser context (the Netlify web deployment included), so
// isNativeBiometricAvailable() is what biometricAuth.js gates on before
// ever calling into this file - the web build keeps using its existing,
// already-working WebAuthn implementation untouched.
import { Capacitor } from '@capacitor/core';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

export const isNativeBiometricAvailable = () => Capacitor.isNativePlatform();

// Whether this device actually has biometry enrolled and usable by apps
// right now - distinct from isNativeBiometricAvailable(), which only
// answers "are we running inside the native app shell at all".
export const checkNativeBiometryEnrolled = async () => {
    if (!isNativeBiometricAvailable()) return false;
    try {
        const result = await BiometricAuth.checkBiometry();
        return !!result.isAvailable;
    } catch (e) {
        return false;
    }
};

// Registration is a no-op on the native path: unlike WebAuthn, the OS
// biometric prompt has no separate "enroll a credential with this app"
// step - fingerprints/face are already enrolled at the OS level, and
// authenticate() below either can use them or can't. This just confirms
// biometry is actually usable before Settings flips the toggle on, so a
// device with no enrolled biometry can't end up with a lock it can never
// pass.
export const registerNativeBiometric = async () => {
    const enrolled = await checkNativeBiometryEnrolled();
    if (!enrolled) throw new Error('No fingerprint or face is enrolled on this device.');
    return true;
};

// Always resolves true/false, never throws - matches the existing
// verifyBiometric() contract in biometricAuth.js so BiometricLockScreen.jsx
// and ProtectedModuleGate.jsx don't need to know which implementation is
// actually running underneath.
export const verifyNativeBiometric = async (reason) => {
    if (!isNativeBiometricAvailable()) return false;
    try {
        await BiometricAuth.authenticate({
            reason: reason || 'Unlock Nexus Life OS',
            cancelTitle: 'Cancel',
            androidTitle: 'Nexus Life OS',
            androidSubtitle: reason || 'Verify your identity to continue',
            allowDeviceCredential: false,
        });
        return true;
    } catch (e) {
        // Cancellation, no match, lockout, etc. - whatever the reason,
        // the lock correctly stays shut, same as the existing WebAuthn
        // path's catch-all.
        return false;
    }
};
