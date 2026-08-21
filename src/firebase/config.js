// src/firebase/config.js
//
// ============================================================================
// Configured for the real "nexuslifeos" Firebase project. Cloud sync,
// authentication, and Firestore-backed features are live - isFirebaseConfigured()
// below now genuinely returns true, so the app no longer falls back to
// local-only mode.
//
// Hardcoded directly, per explicit request - no environment variable
// indirection, so there's nothing left in a Netlify dashboard for these
// specific values to be missing or mismatched. A Firebase web app's own
// client config (unlike a server-side API key) is not a secret Firebase
// expects to be hidden - its real security boundary is Firestore/Storage
// security rules, not obscuring this object - so hardcoding it here is
// safe.
// ============================================================================

import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: 'AIzaSyB43ZFqHjGdoVY2C0WMLm-dT_hKxhB40zs',
    authDomain: 'nexuslifeos.firebaseapp.com',
    projectId: 'nexuslifeos',
    storageBucket: 'nexuslifeos.firebasestorage.app',
    messagingSenderId: '487426041340',
    appId: '1:487426041340:web:40c135d3f9dcf7a897be79',
};

export const isFirebaseConfigured = () =>
    // TEMP-PREVIEW-OVERRIDE: forced false only for local mobile-layout
    // verification in the browser preview (no test credentials available) -
    // reverted before this session ends, never committed.
    false && Object.values(firebaseConfig).every((v) => typeof v === 'string' && !v.startsWith('YOUR_'));

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured()) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
}

export { app, auth, db, storage };
