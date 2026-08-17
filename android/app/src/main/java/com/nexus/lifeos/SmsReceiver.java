package com.nexus.lifeos;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * Manifest-registered receiver for incoming SMS - this is what makes
 * "listening" genuinely work even when the app isn't running or the
 * WebView/JS bridge isn't alive (SMS_RECEIVED is one of the protected
 * system broadcasts still exempt from Android 8+'s implicit-broadcast
 * background restrictions, so a manifest <receiver> for it keeps working
 * without the app needing a running foreground/background service).
 *
 * On every incoming SMS: reassembles multi-part messages, runs
 * BankSmsParser against the sender+body, and if it looks like a genuine
 * bank transaction, persists it to PendingTransactionStore (durable,
 * survives the app not running) AND fires a same-app explicit-package
 * broadcast (setPackage - never leaves this app, no extra permission or
 * Gradle dependency needed beyond the Android SDK itself) so
 * SmsFinancePlugin can relay it to JS immediately if the app happens to
 * be open right now. Every other SMS (the overwhelming majority - OTPs,
 * personal messages, marketing) is read only long enough to fail
 * BankSmsParser's own amount+keyword check and is then never touched,
 * logged, or stored anywhere.
 */
public class SmsReceiver extends BroadcastReceiver {

    static final String ACTION_SMS_TRANSACTION_DETECTED = "com.nexus.lifeos.SMS_TRANSACTION_DETECTED";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;

        String sender = messages[0].getOriginatingAddress();
        StringBuilder bodyBuilder = new StringBuilder();
        for (SmsMessage part : messages) {
            if (part != null && part.getMessageBody() != null) {
                bodyBuilder.append(part.getMessageBody());
            }
        }
        String body = bodyBuilder.toString();

        BankSmsParser.ParsedTransaction parsed = BankSmsParser.parse(sender, body);
        if (parsed == null) return; // Not a recognizable bank transaction SMS - ignored entirely.

        long now = System.currentTimeMillis();
        PendingTransactionStore.enqueue(context.getApplicationContext(), parsed.type, parsed.amount, parsed.description, now);

        Intent localIntent = new Intent(ACTION_SMS_TRANSACTION_DETECTED);
        localIntent.setPackage(context.getPackageName());
        localIntent.putExtra("type", parsed.type);
        localIntent.putExtra("amount", parsed.amount);
        localIntent.putExtra("description", parsed.description);
        localIntent.putExtra("timestampMs", now);
        context.getApplicationContext().sendBroadcast(localIntent);
    }
}
