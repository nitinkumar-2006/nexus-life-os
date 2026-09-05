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
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
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
    Object.values(firebaseConfig).every((v) => typeof v === 'string' && !v.startsWith('YOUR_'));

let app = null;
let auth = null;
let db = null;
let storage = null;

if (isFirebaseConfigured()) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Real, first-party offline persistence - Firestore genuinely caches
    // reads and queues writes in the browser's own IndexedDB, then
    // auto-flushes queued writes the moment connectivity returns, entirely
    // inside the SDK. This is what actually backs the "offline queue +
    // auto-flush on reconnect" requirement, rather than a hand-rolled
    // queue reimplementing what Firestore already does correctly.
    // persistentMultipleTabManager is required (not the single-tab
    // default) since this is a normal web app users can and do open in
    // more than one tab at once - the single-tab manager would silently
    // fail to enable persistence in every tab after the first.
    try {
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
    } catch (e) {
        // Falls back to the standard, non-persistent client rather than
        // leaving `db` null and breaking the app - a real, known failure
        // mode (private/incognito browsing, or a browser with IndexedDB
        // disabled entirely) where persistence genuinely can't be enabled,
        // not a bug to crash on. Online sync still works exactly as
        // before; only the offline cache/queue is unavailable.
        db = getFirestore(app);
    }
    storage = getStorage(app);
    // Real bug, reported live via DevTools console: a local audio track's
    // upload (audioCloudSync.js's uploadAudioToCloud, a resumable upload)
    // fails its CORS preflight against this dev origin - genuinely
    // permanent, not a transient network blip - yet the Storage SDK's own
    // default maxUploadRetryTime is 10 whole minutes, during which it
    // keeps retrying that same doomed request every few seconds,
    // flooding the console exactly as seen ("बढ़ते जा रहा है"). No app
    // code ever set this, so it silently used Firebase's own default.
    // Capped to 20s so a genuinely permanent failure (CORS, revoked
    // permissions, an invalid bucket) surfaces a real, visible error
    // quickly instead of spamming retries for up to 10 minutes - a
    // normal, brief network hiccup still gets several real retry
    // attempts within that window, so this doesn't sacrifice the
    // resilience resumable uploads exist for for a merely slow
    // connection. maxOperationRetryTime is the same setting for every
    // other Storage op (getDownloadURL/deleteObject) - defaults to 2
    // minutes, capped the same way for the same reason.
    //
    // Real build break fixed: these aren't standalone exported functions
    // in the installed firebase v12 SDK (confirmed against @firebase/
    // storage's own .d.ts - both are get/set accessor PROPERTIES on the
    // FirebaseStorage instance itself), so importing and calling them as
    // functions failed the whole build with a genuine MISSING_EXPORT
    // error, not a lint nitpick - plain property assignment is the real,
    // correct v9+ modular-SDK way to set these.
    storage.maxUploadRetryTime = 20000;
    storage.maxOperationRetryTime = 20000;
}

export { app, auth, db, storage };
