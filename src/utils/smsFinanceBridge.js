// src/utils/smsFinanceBridge.js
//
// JS-side bridge for the native Android SMS finance listener
// (android/app/src/main/java/com/nexus/lifeos/{SmsReceiver,
// SmsFinancePlugin, BankSmsParser}.java). Native-only by construction:
// isSmsFinanceBridgeAvailable() is false in every browser context
// (including the Netlify web deployment), since there is no such native
// plugin to call there at all.
//
// IMPORTANT - read before enabling this in any Play Store build:
// READ_SMS/RECEIVE_SMS are part of Google Play's restricted permissions
// policy. Play Console requires the app to be the user's default SMS/
// Assistant/Dialer handler to keep these declared, which a finance app
// realistically can't qualify for. This module is intended for a
// personal/sideloaded APK, not Play Store distribution - see the same
// note in AndroidManifest.xml.
import { Capacitor, registerPlugin } from '@capacitor/core';

const SmsFinance = registerPlugin('SmsFinance');

export const isSmsFinanceBridgeAvailable = () => Capacitor.isNativePlatform();

// Resolves to the granted state for the single "sms" permission alias
// (covers RECEIVE_SMS + READ_SMS together - see the plugin's own
// @Permission annotation) - 'granted' | 'denied' | 'prompt' |
// 'prompt-with-rationale', matching Capacitor's standard PermissionState
// values, or 'unavailable' outside the native app.
export const checkSmsFinancePermission = async () => {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    const result = await SmsFinance.checkPermissions();
    return result.sms;
};

// The actual runtime-permission trigger - genuinely opens Android's
// system SMS permission dialog the first time it's called (or resolves
// immediately with the already-granted state on every call after that).
export const requestSmsFinancePermission = async () => {
    if (!Capacitor.isNativePlatform()) return 'unavailable';
    const result = await SmsFinance.requestPermissions();
    return result.sms;
};

// Deliberately the SAME row shape StatementImportModal's own onImport
// already produces ({title, type, amount, category, date} - no id/account,
// since FinancePage.jsx's existing handleStatementImport assigns both of
// those itself, plus does the one real piece of shared logic that
// actually matters here: computing the net account-balance change across
// a whole batch in one pass). Reusing that exact, already-correct handler
// for SMS-sourced rows too - rather than writing a second, parallel merge
// function - is what guarantees an SMS-detected transaction affects the
// user's real balance identically to a manually-typed or statement-
// imported one.
const mapToImportRow = (raw) => ({
    title: raw.description || 'Bank SMS Transaction',
    type: raw.type,
    amount: raw.amount,
    category: 'Others',
    date: new Date(raw.timestampMs).toISOString().split('T')[0],
});

// Drains every transaction SmsReceiver has queued since the last drain
// (including ones that arrived while the app wasn't running - see
// PendingTransactionStore.java) and maps them into
// handleStatementImport's own row shape. Call this on Finance page
// mount/app resume, mirroring CalendarPage.jsx's device-calendar
// pull-on-demand pattern.
export const pullPendingSmsTransactions = async () => {
    if (!Capacitor.isNativePlatform()) return [];
    const permission = await checkSmsFinancePermission();
    if (permission !== 'granted') return [];
    const { transactions } = await SmsFinance.getPendingTransactions();
    return (transactions || []).map(mapToImportRow);
};

// Genuine real-time path: while the app is in foreground, SmsFinancePlugin
// relays each newly-detected transaction the instant SmsReceiver parses
// it (no polling). Returns an unsubscribe function, same convention as
// every other Capacitor addListener call.
export const onSmsTransactionDetected = (callback) => {
    if (!Capacitor.isNativePlatform()) return () => {};
    const handle = SmsFinance.addListener('smsTransactionDetected', (raw) => {
        callback(mapToImportRow(raw));
    });
    return () => { handle.remove(); };
};
