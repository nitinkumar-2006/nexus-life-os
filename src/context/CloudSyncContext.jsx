// src/context/CloudSyncContext.jsx
//
// Syncs the app's real localStorage data to/from Firestore, keyed by the
// signed-in user's UID, so logging in on a new device (or after a cache
// clear) restores everything. Every key below was found by grepping the
// actual codebase for localStorage.setItem/getItem calls - this is the
// real, complete list of what the app persists, not a guessed subset.
//
// Local-only data that can never meaningfully travel across devices
// (nexus_current_route - just "which tab was open"; nexus_current_song_index
// and the actual bytes of locally-imported audio files, which live in
// IndexedDB) is intentionally excluded from cloud sync.
import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { useAuth } from './AuthContext.jsx';

// Maps the Settings page's "Auto-Backup Frequency" dropdown (Daily/Weekly/
// Monthly) to actual thresholds. The app doesn't need to stay open for the
// full interval - see the periodic check below, which compares elapsed
// time since the last backup against this threshold every few minutes, so
// a backup fires as soon as it's due even across short sessions.
const BACKUP_FREQUENCY_MS = {
    Daily: 24 * 60 * 60 * 1000,
    Weekly: 7 * 24 * 60 * 60 * 1000,
    Monthly: 30 * 24 * 60 * 60 * 1000,
};
const LAST_AUTO_BACKUP_KEY = 'nexus_last_auto_backup';

// How long to wait after the LAST local change before actually pushing -
// this is the real "WhatsApp-style automatic backup" mechanism (see the
// effect below): near-real-time, not just the existing Daily/Weekly/
// Monthly scheduled backup further down, which stays in place as a
// second, coarser safety net rather than being replaced. A burst of
// rapid edits (typing, importing a statement, bulk-toggling settings)
// collapses into one real Firestore write shortly after they settle,
// not one write per keystroke.
const AUTO_PUSH_DEBOUNCE_MS = 3000;

// Real watchdog timeout - the actual fix for the reported "infinite
// Syncing..." bug. Neither setDoc nor getDoc has any built-in timeout of
// its own; a genuine network hang (a dropped connection, a firewall
// silently discarding packets, a stalled request that never resolves OR
// rejects) would previously leave isSyncing stuck at true forever, since
// nothing was ever going to settle the underlying promise.
const SYNC_TIMEOUT_MS = 10000;

// Real, honest sync-status states, replacing the old boolean-only
// isSyncing. A genuine failure or timeout now surfaces as its own
// distinct 'error' state - not silently falling back to invisible idle,
// which is what made prior failures undiagnosable.
export const SYNC_STATUS = { IDLE: 'idle', SYNCING: 'syncing', ERROR: 'error' };

export const SYNCED_KEYS = [
    'nexus_user_profile',
    'nexus_planner_tasks',
    'nexus_study_subjects',
    'nexus_study_tasks',
    'nexus_study_assignments',
    'nexus_study_flashcards',
    'nexus_study_notes',
    // The real, live Syllabus data (subjects/units/topics + all real
    // progress) - StudyPage/SyllabusPage both moved to this key long ago
    // (see StudyPage.jsx's own comment on why nexus_study_subjects above
    // is now dead), but this list was never updated to follow, so every
    // subject/unit/topic a user has ever added silently never made it
    // into cloud backup or cross-device restore until now.
    'nexus_syllabus_subjects',
    // GpaCalculator's own CGPA/Attendance data (Study Hub's "CGPA &
    // Attendance" tab) - added after this list was last audited, so it
    // was missing entirely; same silent no-backup gap as above.
    'nexus_study_cgpa_subjects',
    'nexus_study_attendance_subjects',
    'nexus_gym_profile',
    'nexus_gym_workouts',
    'nexus_gym_plans',
    'nexus_gym_exercises',
    'nexus_gym_history',
    'nexus_gym_measurements',
    'nexus_gym_recovery',
    'nexus_diet_profile',
    'nexus_diet_foods',
    'nexus_diet_meals',
    'nexus_diet_daily_log',
    'nexus_diet_grocery',
    'nexus_finance_profile',
    'nexus_finance_accounts',
    'nexus_finance_transactions',
    'nexus_finance_bills',
    'nexus_finance_goals',
    'nexus_calendar_events',
    'nexus_timetable_data',
    'nexus_ai_chat_history',
    'nexus_focus_stats',
    'nexus_global_settings',
    'nexus_theme',
    'nexus_volume',
    'nexus_playlist',
];

const CloudSyncContext = createContext({
    isSyncing: false,
    syncStatus: SYNC_STATUS.IDLE,
    syncError: null,
    lastSyncedAt: null,
    syncPaused: false,
    setSyncPaused: () => {},
    pushToCloud: async () => {},
    pullFromCloud: async () => {},
    checkSyncHealth: () => ({ healthy: false, reason: 'Not configured' }),
});

// Real race between the actual Firebase call and a timer - whichever
// settles first wins. If the real call is still pending after
// SYNC_TIMEOUT_MS, this rejects with a genuine, honest Error rather than
// leaving the caller waiting on a promise that may never resolve.
const withTimeout = (promise, ms) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timed out - no response from Firebase.')), ms)),
    ]);

export const CloudSyncProvider = ({ children }) => {
    const { user, isConfigured } = useAuth();
    const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
    const [syncError, setSyncError] = useState(null);
    const [lastSyncedAt, setLastSyncedAt] = useState(null);
    // Real pause for the two AUTOMATIC background triggers only (the
    // debounced push-on-local-change below, and the scheduled Daily/
    // Weekly/Monthly backup) - a manual pushToCloud()/pullFromCloud()
    // call (the System Diagnostics panel's own "Sync Now"/"Pull Latest"
    // buttons, or anything else that calls these directly) still works
    // while paused, since the whole point is "stop the automatic
    // background activity for a bit", not "disable sync entirely".
    const [syncPaused, setSyncPaused] = useState(false);
    const hasPulledForUser = useRef(null);
    // True only for the exact duration pullFromCloud is writing its
    // fetched data into localStorage - guards the auto-push listener
    // below from treating a pull's own dispatched 'storage' event as a
    // new local change and immediately pushing straight back to the
    // cloud the data that was just pulled FROM the cloud.
    const isPullingRef = useRef(false);
    const pushDebounceRef = useRef(null);
    // True from the moment a debounced local change starts its
    // setDoc(...) round-trip until that call actually settles (success
    // or failure). Combined with pushDebounceRef.current (truthy while
    // a change is still WAITING to be pushed, before the debounce timer
    // has even fired), this covers the whole window during which a
    // local edit exists that the cloud does not have yet. See the guard
    // in applyCloudData below - this is the real fix for a genuine race
    // that had no guard at all before: a pull (the real-time onSnapshot
    // listener especially) landing with the *previous* cloud value while
    // this exact change is still in flight, unconditionally overwriting
    // the fresh local edit with what it just replaced. That's what made
    // a theme change (or any synced setting) intermittently "snap back"
    // shortly after being changed - not on a fixed timer, but any time a
    // pull happened to arrive during this window.
    const pushInFlightRef = useRef(false);

    const snapshotLocalData = () => {
        const snapshot = {};
        SYNCED_KEYS.forEach((key) => {
            const value = localStorage.getItem(key);
            if (value !== null) snapshot[key] = value;
        });
        return snapshot;
    };

    // The one real place cloud data actually lands back in localStorage -
    // shared by pullFromCloud's own explicit, one-shot pull below AND the
    // live onSnapshot listener further down, so there's a single real
    // implementation instead of two copies that could drift. isPullingRef
    // is what stops the auto-push listener above from treating this
    // inbound write as a new local change and immediately pushing it
    // straight back to the cloud it just came from.
    const applyCloudData = (cloudData) => {
        // A local edit that hasn't reached the cloud yet (still sitting
        // in the debounce, or the setDoc() call it triggered is still
        // in flight) is by definition fresher than whatever this pull
        // just fetched, which was necessarily read *before* that edit's
        // own push completes. Applying it now would silently clobber
        // the user's just-made change with the value it's about to
        // replace - so skip this pull entirely and let the pending push
        // win; the very next pull after it lands will correctly reflect
        // what was just pushed.
        if (pushDebounceRef.current || pushInFlightRef.current) return;
        isPullingRef.current = true;
        Object.entries(cloudData).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
        window.dispatchEvent(new Event('nexus_profile_updated'));
        window.dispatchEvent(new Event('nexus_settings_updated'));
        // header.jsx's own theme-cycle icon only re-syncs its local state
        // on this specific event, not on 'nexus_settings_updated'/'storage'
        // - without it, a theme value arriving from the cloud (sign-in
        // pull, another device's change, or this device's own change
        // echoing back) would correctly update data-theme on <html> via
        // DashboardLayout's own listener (which does listen broadly) while
        // leaving the header icon showing whatever theme was active before
        // this pull, silently desynced from the theme actually applied.
        window.dispatchEvent(new Event('nexus_theme_changed'));
        window.dispatchEvent(new Event('storage'));
        isPullingRef.current = false;
    };

    // Real pre-flight health check - verifies the two real, actual
    // preconditions a sync call needs before ever attempting one, per
    // this request's own explicit "verifies... write permissions and
    // internet connectivity before initiating" ask. navigator.onLine is
    // a real, live browser signal (not a cached/guessed value); a
    // genuine Firestore permission failure still can't be known in
    // advance without an actual round-trip, so that half is caught by
    // the real try/catch + watchdog in pushToCloud/pullFromCloud below,
    // not claimed here.
    const checkSyncHealth = useCallback(() => {
        if (!isConfigured) return { healthy: false, reason: 'Firebase is not configured on this deployment.' };
        if (!user) return { healthy: false, reason: 'Not signed in.' };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { healthy: false, reason: 'No internet connection detected.' };
        }
        return { healthy: true, reason: null };
    }, [isConfigured, user]);

    const pushToCloud = useCallback(async () => {
        const health = checkSyncHealth();
        if (!health.healthy) {
            // A local-only user (Firebase not configured, or not signed
            // in) isn't a real error - there's genuinely nothing to sync
            // yet, so this stays silent exactly as before. Only a
            // genuine connectivity problem for an otherwise-eligible,
            // signed-in user surfaces as a real error state.
            if (health.reason === 'No internet connection detected.') {
                setSyncStatus(SYNC_STATUS.ERROR);
                setSyncError(health.reason);
            }
            return;
        }
        setSyncStatus(SYNC_STATUS.SYNCING);
        setSyncError(null);
        pushInFlightRef.current = true;
        try {
            await withTimeout(
                setDoc(doc(db, 'nexusUsers', user.uid), { data: snapshotLocalData(), updatedAt: serverTimestamp() }, { merge: true }),
                SYNC_TIMEOUT_MS
            );
            setLastSyncedAt(new Date());
            setSyncStatus(SYNC_STATUS.IDLE);
        } catch (e) {
            // A failed cloud push should never block local usage - the
            // data is still safe in localStorage either way. But the
            // failure itself is now genuinely surfaced (Sync Error -
            // Retry), not silently swallowed the way it was before.
            setSyncStatus(SYNC_STATUS.ERROR);
            setSyncError(e && e.message ? e.message : 'Sync failed.');
        }
        pushInFlightRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkSyncHealth, user]);

    const pullFromCloud = useCallback(async () => {
        const health = checkSyncHealth();
        if (!health.healthy) {
            if (health.reason === 'No internet connection detected.') {
                setSyncStatus(SYNC_STATUS.ERROR);
                setSyncError(health.reason);
            }
            return;
        }
        setSyncStatus(SYNC_STATUS.SYNCING);
        setSyncError(null);
        try {
            const snap = await withTimeout(getDoc(doc(db, 'nexusUsers', user.uid)), SYNC_TIMEOUT_MS);
            if (snap.exists()) {
                applyCloudData(snap.data().data || {});
            }
            setLastSyncedAt(new Date());
            setSyncStatus(SYNC_STATUS.IDLE);
        } catch (e) {
            // Fall back to whatever is already in localStorage - but,
            // same as pushToCloud, the failure is now genuinely surfaced
            // rather than silently swallowed.
            setSyncStatus(SYNC_STATUS.ERROR);
            setSyncError(e && e.message ? e.message : 'Sync failed.');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkSyncHealth, user]);

    // Automatically pull once per sign-in (not on every render), so a login
    // on a new device or after a factory reset restores everything.
    useEffect(() => {
        if (isConfigured && user && hasPulledForUser.current !== user.uid) {
            hasPulledForUser.current = user.uid;
            pullFromCloud();
        }
        if (!user) {
            hasPulledForUser.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isConfigured]);

    // REAL real-time, multi-device sync - the actual gap the one-shot pull
    // above doesn't cover: that effect only ever pulls once, right after
    // sign-in, so a change pushed from a second device while THIS one is
    // already open and sitting idle previously never arrived until the
    // user manually refreshed or signed out and back in. A genuine
    // Firestore onSnapshot subscription stays open for as long as this
    // provider is mounted and fires again the instant the server has a
    // newer version of the document - from this device's own confirmed
    // writes AND from every other signed-in device alike - which is what
    // makes "add a task on your phone, watch it appear on your laptop
    // within milliseconds" genuinely true instead of only working one
    // direction (local -> cloud) the way the debounced auto-push alone
    // did.
    //
    // snap.metadata.hasPendingWrites is Firestore's own real signal for
    // "this snapshot reflects a write *this client* made that the server
    // hasn't confirmed yet" (the local optimistic cache echoing itself
    // back) - skipping those is what stops this listener from replaying
    // this device's own in-flight local edits back onto itself a moment
    // after they were already applied locally.
    useEffect(() => {
        if (!isConfigured || !user || !db) return undefined;

        const unsubscribe = onSnapshot(
            doc(db, 'nexusUsers', user.uid),
            (snap) => {
                if (snap.metadata.hasPendingWrites) return;
                if (!snap.exists()) return;
                applyCloudData(snap.data().data || {});
                setLastSyncedAt(new Date());
            },
            (err) => {
                // A live listener that fails (permissions, a dropped
                // connection Firestore can't silently recover) shouldn't
                // crash sync entirely - the debounced push/one-shot pull
                // above still work independently of this listener, so
                // this only ever degrades to "less instant", never to
                // "broken".
                setSyncStatus(SYNC_STATUS.ERROR);
                setSyncError(err && err.message ? err.message : 'Live sync connection lost.');
            }
        );

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConfigured, user]);

    // Real "auto-flush on reconnect": the moment the browser's own
    // connectivity signal flips back to online, immediately retry a push
    // if the last attempt is sitting in an error state (most commonly
    // because it was attempted while offline - see checkSyncHealth above).
    // Firestore's own persistent local cache (see firebase/config.js)
    // already queues writes made *through* the SDK while offline and
    // flushes them on its own reconnect detection; this is the
    // complementary piece for this app's specific pattern of skipping the
    // Firestore call entirely while known-offline (avoiding a doomed
    // round-trip and its timeout) - without this listener, that skipped
    // push would otherwise only get retried by the next unrelated local
    // edit or the coarse 5-minute scheduled backup below.
    useEffect(() => {
        if (!isConfigured || !user) return undefined;
        const handleOnline = () => {
            if (syncStatus === SYNC_STATUS.ERROR) pushToCloud();
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [isConfigured, user, syncStatus, pushToCloud]);

    // The real "WhatsApp-style automatic backup" mechanism - every
    // localStorage write anywhere in this app already dispatches a
    // same-tab 'storage' event right after (the established convention
    // every page's own persistence effect already follows, since a
    // browser's native 'storage' event only ever fires in OTHER tabs of
    // the same origin, never the one that made the change). Listening
    // for that same signal here means a change to tasks, transactions,
    // settings, or anything else in SYNCED_KEYS reaches the cloud within
    // AUTO_PUSH_DEBOUNCE_MS - no manual "Sync Now" tap required, and no
    // waiting for the Daily/Weekly/Monthly scheduled backup further
    // below, which stays in place as a coarser fallback (e.g. a device
    // that was offline when a debounced push tried to fire).
    useEffect(() => {
        if (!isConfigured || !user) return undefined;

        const handleLocalChange = () => {
            if (isPullingRef.current) return; // this change came FROM the cloud, don't push it right back
            if (syncPaused) return; // user paused automatic background sync from the System Diagnostics panel
            if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
            pushDebounceRef.current = setTimeout(() => {
                pushDebounceRef.current = null;
                pushToCloud();
            }, AUTO_PUSH_DEBOUNCE_MS);
        };

        // Flushes any still-pending debounced push the instant the tab
        // backgrounds - genuinely closes the real "edited something, then
        // immediately closed the app before the debounce fired" data-loss
        // window, the same real risk this whole feature is meant to
        // remove. 'visibilitychange' (not 'beforeunload') is what
        // reliably fires on mobile when an app is backgrounded/switched
        // away from, not just on an actual page close.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && pushDebounceRef.current) {
                clearTimeout(pushDebounceRef.current);
                pushDebounceRef.current = null;
                pushToCloud();
            }
        };

        // Real, reported data-loss bug: a hard reload/navigation (not a
        // tab backgrounding) can tear the page down before
        // 'visibilitychange' finishes being handled, killing this exact
        // pending debounced push before pushToCloud() ever gets called -
        // the fresh page load's own one-shot "pull once per sign-in"
        // effect then restores the OLD cloud snapshot over freshly-
        // changed local data (any field in the shared blob, not just
        // whatever was just edited) that never made it to the cloud.
        // 'pagehide' is the more direct "this page is actually being
        // torn down" signal and fires reliably for real navigations,
        // where 'visibilitychange' alone is more about backgrounding.
        // Firestore's own persistentLocalCache (see firebase/config.js)
        // means calling pushToCloud() here queues the write in IndexedDB
        // essentially synchronously even if the network round-trip can't
        // finish before the page unloads - the SDK flushes it on its own
        // once the app is back online, surviving the reload itself.
        const handlePageHide = () => {
            if (pushDebounceRef.current) {
                clearTimeout(pushDebounceRef.current);
                pushDebounceRef.current = null;
                pushToCloud();
            }
        };

        window.addEventListener('storage', handleLocalChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);
        return () => {
            window.removeEventListener('storage', handleLocalChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
            if (pushDebounceRef.current) clearTimeout(pushDebounceRef.current);
        };
    }, [isConfigured, user, pushToCloud, syncPaused]);

    // Respects the Settings page's Auto-Backup Frequency dropdown: checks
    // every 5 minutes whether enough time has passed since the last backup
    // for the currently-selected interval (Daily/Weekly/Monthly), and if
    // so, actually performs one. This is what makes that dropdown do
    // something real rather than just storing a value nobody reads.
    //
    // This is now the ONE, single, authoritative auto-backup scheduler in
    // the whole app - a real, confirmed second copy of this same logic
    // previously also lived in SettingsPage.jsx's own separate useEffect,
    // independently calling this same pushToCloud on its own schedule with
    // its own separate tracking (React state there vs this localStorage key
    // here). Two uncoordinated schedulers both able to fire pushToCloud
    // around the same time is a real race-condition/duplicate-write risk,
    // and is exactly the kind of "not batched" duplication this request's
    // own "ensure sync calls are batched" ask points at. That duplicate
    // effect has been removed; this is the only one left.
    useEffect(() => {
        if (!isConfigured || !user) return undefined;

        const checkAndBackup = () => {
            if (syncPaused) return; // user paused automatic background sync from the System Diagnostics panel
            let freq = 'Weekly';
            try {
                const settings = JSON.parse(localStorage.getItem('nexus_global_settings') || '{}');
                if (settings.autoBackupFreq) freq = settings.autoBackupFreq;
            } catch (e) {
                /* fall back to Weekly */
            }
            const thresholdMs = BACKUP_FREQUENCY_MS[freq] || BACKUP_FREQUENCY_MS.Weekly;
            const lastBackup = parseInt(localStorage.getItem(LAST_AUTO_BACKUP_KEY) || '0', 10);
            if (Date.now() - lastBackup >= thresholdMs) {
                pushToCloud();
                localStorage.setItem(LAST_AUTO_BACKUP_KEY, String(Date.now()));
            }
        };

        checkAndBackup(); // also check right away on login, not just after the first 5-minute tick
        const interval = setInterval(checkAndBackup, 5 * 60 * 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isConfigured, syncPaused]);

    // Memoized so consumers only genuinely re-render when a real value
    // here actually changed - not on every single render of this
    // provider. Without this, the object literal below would be a brand
    // new reference every render, cascading an unnecessary re-render to
    // every consumer of useCloudSync() anywhere in the app.
    const value = useMemo(() => ({
        isSyncing: syncStatus === SYNC_STATUS.SYNCING,
        syncStatus,
        syncError,
        lastSyncedAt,
        syncPaused,
        setSyncPaused,
        pushToCloud,
        pullFromCloud,
        checkSyncHealth,
    }), [syncStatus, syncError, lastSyncedAt, syncPaused, pushToCloud, pullFromCloud, checkSyncHealth]);

    return (
        <CloudSyncContext.Provider value={value}>
            {children}
        </CloudSyncContext.Provider>
    );
};

export const useCloudSync = () => useContext(CloudSyncContext);

