package com.nexus.lifeos;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * JS-facing bridge for the SMS finance module. checkPermissions() and
 * requestPermissions() are NOT overridden here - Capacitor's own Plugin
 * base class already implements both correctly from the @Permission
 * annotation below (resolves { sms: "granted" | "denied" | "prompt" }),
 * so re-implementing them here would just be a second, easier-to-drift
 * copy of logic Capacitor already gets right.
 *
 * getPendingTransactions() is this plugin's one real custom method - it
 * drains whatever SmsReceiver has queued in PendingTransactionStore
 * (SharedPreferences) since the last drain, which is how the JS side
 * picks up transactions that arrived while the app wasn't running.
 *
 * While the plugin is alive (app open), it also relays SmsReceiver's own
 * same-app broadcast straight through as a genuine live JS event
 * ("smsTransactionDetected") via notifyListeners - real-time updates when
 * the app is in foreground, not just a poll-on-open.
 */
@CapacitorPlugin(
    name = "SmsFinance",
    permissions = {
        @Permission(strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS }, alias = "sms")
    }
)
public class SmsFinancePlugin extends Plugin {

    private BroadcastReceiver liveReceiver;

    @Override
    public void load() {
        super.load();
        liveReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                JSObject data = new JSObject();
                data.put("type", intent.getStringExtra("type"));
                data.put("amount", intent.getDoubleExtra("amount", 0));
                data.put("description", intent.getStringExtra("description"));
                data.put("timestampMs", intent.getLongExtra("timestampMs", 0));
                notifyListeners("smsTransactionDetected", data);
            }
        };
        IntentFilter filter = new IntentFilter(SmsReceiver.ACTION_SMS_TRANSACTION_DETECTED);
        // Android 13+ (API 33) requires dynamically-registered receivers to
        // explicitly declare export status. RECEIVER_NOT_EXPORTED is
        // correct here (not just a compliance formality) - SmsReceiver
        // already scopes this broadcast to the app's own package via
        // setPackage, so no other app should ever be able to deliver to
        // this receiver regardless.
        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(liveReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(liveReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (liveReceiver != null) {
            try {
                getContext().unregisterReceiver(liveReceiver);
            } catch (IllegalArgumentException alreadyUnregistered) {
                // Harmless - already torn down.
            }
        }
    }

    @PluginMethod
    public void getPendingTransactions(PluginCall call) {
        String json = PendingTransactionStore.drain(getContext());
        JSObject result = new JSObject();
        try {
            result.put("transactions", new JSArray(json));
        } catch (Exception e) {
            result.put("transactions", new JSArray());
        }
        call.resolve(result);
    }
}
