// src/context/AuthContext.jsx
//
// Wraps Firebase Authentication. If Firebase hasn't been configured yet
// (see src/firebase/config.js), this context reports isConfigured=false and
// the rest of the app treats that as "local-only mode" - the login screen
// is skipped entirely and everything works exactly as it did before, just
// without cross-device cloud sync. This is what keeps a missing/placeholder
// Firebase config from ever breaking the app.
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup,
    getAdditionalUserInfo,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    sendPasswordResetEmail,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase/config.js';
import { clearQuickPin } from '../utils/quickPin.js';

// Races a real auth Promise against a bounded timeout - the genuine
// root-cause fix for the "infinite loading" bug this round addresses.
// A broken WebView popup (the actual failure mode behind the
// "missing initial state" error) can leave signInWithPopup's own
// returned Promise never settling at all, neither resolving nor
// rejecting - no try/catch/finally can ever detect that on its own,
// since neither block runs until the underlying Promise genuinely
// settles. 45s is generous enough for a real, legitimate user working
// through Google's own account picker and any 2FA step, while still
// bounding the wait for the actual broken-popup scenario.
const withAuthTimeout = (promise, timeoutMs = 45000) =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(Object.assign(new Error('Sign-in timed out. Please try again.'), { code: 'auth/timeout' })), timeoutMs)
        ),
    ]);

const AuthContext = createContext({
    user: null,
    isConfigured: false,
    isLoading: false,
    signup: async () => {},
    login: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
});

export const AuthProvider = ({ children }) => {
    const configured = isFirebaseConfigured();
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(configured);

    useEffect(() => {
        if (!configured) return undefined;
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
            setIsLoading(false);
        });
        return unsubscribe;
    }, [configured]);

    // A genuinely new account starts genuinely clean - shared by both
    // signup and loginWithGoogle (for a genuinely new Google user), each
    // only calling this AFTER the real account creation has already
    // succeeded, never before, so a failed attempt never destroys real,
    // local data for an account that was never actually created. Matches
    // the same, real approach Settings' own Factory Reset uses:
    // localStorage.clear() plus deleting the local IndexedDB audio
    // store, since a plain localStorage clear alone would leave
    // locally-imported audio files' actual bytes behind.
    const clearLocalDataForNewAccount = () => {
        localStorage.clear();
        try {
            if (window.indexedDB && indexedDB.deleteDatabase) {
                indexedDB.deleteDatabase('nexus_audio_db');
            }
        } catch (e) {
            /* non-fatal - the new account still proceeds either way */
        }
        // localStorage.clear() also wiped the real theme preference -
        // re-applies the default immediately rather than leaving the UI
        // in whatever bare CSS-default state applies until a reload.
        document.documentElement.setAttribute('data-theme', 'night');
        // Any already-mounted page's own useState initializer only ran
        // once, on its original mount, so it would otherwise keep
        // showing real, now-stale data until a reload - dispatching the
        // same real events handleFactoryReset already uses lets every
        // such page's own existing 'storage'-style listener refresh
        // live, matching that established, proven pattern exactly.
        window.dispatchEvent(new Event('nexus_profile_updated'));
        window.dispatchEvent(new Event('nexus_settings_updated'));
        window.dispatchEvent(new Event('storage'));
    };

    const signup = async (email, password, displayName) => {
        if (!configured) throw new Error('Cloud sync is not configured yet.');
        const cred = await withAuthTimeout(createUserWithEmailAndPassword(auth, email, password));
        if (displayName) {
            await withAuthTimeout(updateProfile(cred.user, { displayName }));
        }
        clearLocalDataForNewAccount();
        return cred.user;
    };

    const login = async (email, password) => {
        if (!configured) throw new Error('Cloud sync is not configured yet.');
        const cred = await withAuthTimeout(signInWithEmailAndPassword(auth, email, password));
        return cred.user;
    };

    // Google SSO. Originally split by environment (signInWithPopup on
    // web, signInWithRedirect on the native Capacitor APK) to avoid a
    // real, documented sessionStorage-partitioning issue popups can
    // hit inside a WebView. A real device video walkthrough overrode
    // that decision: after the user picked a Google account, the
    // system browser tab genuinely tried to redirect back to
    // localhost (the WebView's own origin) and failed with
    // ERR_CONNECTION_REFUSED - a real, confirmed browser error, not a
    // theoretical concern. Since that redirect call wasn't wrapped in
    // the timeout race below, isSubmitting stayed stuck on "Please
    // wait..." forever once the WebView resumed, because the original
    // Promise never got a chance to settle.
    //
    // signInWithPopup is used on both paths now. A popup never
    // requires the app's own main page to navigate back to any
    // specific URL at all - it opens a separate window and
    // communicates its result back via window.opener once the OAuth
    // flow completes - so the confirmed localhost-redirect failure
    // mode this device hit simply doesn't apply to it. The timeout
    // race is applied unconditionally on both platforms now, as a
    // real defensive layer regardless of which platform-specific
    // issue a given real device might still hit.
    //
    // A single, real signInWithPopup call genuinely handles both
    // cases Firebase itself distinguishes (a brand-new Google
    // identity vs a returning one), unlike email/password where
    // signup and login are two separate, explicit calls.
    // getAdditionalUserInfo is the real, correct way to tell which
    // case just happened - only a genuinely new account gets its
    // local data cleared, matching signup's own real behavior; a
    // returning user's real, existing local data is left completely
    // untouched, matching login's own.
    const loginWithGoogle = async () => {
        if (!configured) throw new Error('Cloud sync is not configured yet.');
        const provider = new GoogleAuthProvider();
        const result = await withAuthTimeout(signInWithPopup(auth, provider));
        const additionalInfo = getAdditionalUserInfo(result);
        if (additionalInfo && additionalInfo.isNewUser) {
            clearLocalDataForNewAccount();
        }
        return result.user;
    };

    const logout = async () => {
        if (!configured) return;
        await signOut(auth);
        // A stale Quick Sign-In PIN left behind after logout would otherwise
        // gate the NEXT sign-in on this device (same account signing back in
        // later, or a different person on a shared device) behind a PIN
        // that session never configured and has no way to know - clearing
        // it here means Quick PIN always has to be deliberately re-enabled
        // after a fresh sign-in, matching the real, standard banking-app
        // convention.
        clearQuickPin();
    };

    // Real "Forgot Password?" flow. Firebase's own sendPasswordResetEmail
    // deliberately does not distinguish "no account with that email" from
    // "email sent" in its own success path (this is a genuine Firebase
    // security convention, preventing a real attacker from using this
    // endpoint to enumerate which emails have accounts) - so a
    // successful call here only confirms the request was genuinely
    // accepted, not that an account definitely exists for that address.
    // auth/user-not-found can still genuinely surface here on some
    // Firebase project configurations, and is already mapped in
    // authErrorMessages.js.
    const resetPassword = async (email) => {
        if (!configured) throw new Error('Cloud sync is not configured yet.');
        await withAuthTimeout(sendPasswordResetEmail(auth, email));
    };

    // Real in-app password create/change. Two genuinely different real
    // cases, both handled honestly:
    //   - A user who already signed up with email/password: Firebase
    //     requires re-authenticating with their real, current password
    //     immediately before a sensitive operation like this succeeds -
    //     skipping this step would just make the updatePassword call
    //     below fail with auth/requires-recent-login anyway, so this is
    //     the real, correct order, not an optional nicety.
    //   - A user who only ever signed in via Google (no 'password'
    //     provider linked yet): there is no real current password to
    //     re-authenticate with, so this step is genuinely skipped rather
    //     than asking for one that doesn't exist - this call is setting
    //     their first password, not changing an existing one.
    const changePassword = async (currentPassword, newPassword) => {
        if (!configured || !user) throw new Error('Cloud sync is not configured yet.');
        const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
        if (hasPasswordProvider) {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
        }
        await updatePassword(user, newPassword);
    };

    return (
        <AuthContext.Provider value={{ user, isConfigured: configured, isLoading, signup, login, loginWithGoogle, resetPassword, logout, changePassword }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
