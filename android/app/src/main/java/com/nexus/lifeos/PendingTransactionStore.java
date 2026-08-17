package com.nexus.lifeos;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Durable queue for SMS-parsed transactions, written by SmsReceiver
 * (which can run without the app's WebView/JS bridge alive - e.g. the app
 * is fully closed when a bank SMS arrives) and drained by
 * SmsFinancePlugin.getPendingTransactions() the next time the JS side
 * asks. Plain SharedPreferences (not a database) is deliberately enough
 * here - this is a small, short-lived queue that gets drained on every
 * app open/Finance page visit, not a permanent transaction store (Nexus's
 * own JS-side `transactions` state, persisted separately, is that).
 */
final class PendingTransactionStore {

    private static final String PREFS_NAME = "nexus_sms_finance_queue";
    private static final String KEY_QUEUE = "pending_transactions";

    private PendingTransactionStore() {}

    static synchronized void enqueue(Context context, String type, double amount, String description, long timestampMs) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSONArray queue = readQueue(prefs);

        JSONObject item = new JSONObject();
        try {
            item.put("type", type);
            item.put("amount", amount);
            item.put("description", description);
            item.put("timestampMs", timestampMs);
        } catch (JSONException e) {
            return; // Malformed item - drop rather than corrupt the queue.
        }
        queue.put(item);

        prefs.edit().putString(KEY_QUEUE, queue.toString()).apply();
    }

    /** Returns the queue as a JSON array string and atomically clears it. */
    static synchronized String drain(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSONArray queue = readQueue(prefs);
        prefs.edit().remove(KEY_QUEUE).apply();
        return queue.toString();
    }

    private static JSONArray readQueue(SharedPreferences prefs) {
        String raw = prefs.getString(KEY_QUEUE, "[]");
        try {
            return new JSONArray(raw);
        } catch (JSONException e) {
            return new JSONArray();
        }
    }
}
