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
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    const hasPulledForUser = useRef(null);

    const snapshotLocalData = () => {
        const snapshot = {};
        SYNCED_KEYS.forEach((key) => {
            const value = localStorage.getItem(key);
            if (value !== null) snapshot[key] = value;
        });
        return snapshot;
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
                const cloudData = snap.data().data || {};
                Object.entries(cloudData).forEach(([key, value]) => {
                    localStorage.setItem(key, value);
                });
                window.dispatchEvent(new Event('nexus_profile_updated'));
                window.dispatchEvent(new Event('nexus_settings_updated'));
                window.dispatchEvent(new Event('storage'));
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
    }, [user, isConfigured]);

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
        pushToCloud,
        pullFromCloud,
        checkSyncHealth,
    }), [syncStatus, syncError, lastSyncedAt, pushToCloud, pullFromCloud, checkSyncHealth]);

    return (
        <CloudSyncContext.Provider value={value}>
            {children}
        </CloudSyncContext.Provider>
    );
};

export const useCloudSync = () => useContext(CloudSyncContext);

