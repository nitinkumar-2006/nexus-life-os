package com.nexus.lifeos;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Real, reported bug: the system navigation bar (the 3-button/
        // gesture bar at the true bottom of the screen) still renders
        // WHITE on a real device even though styles.xml's AppTheme
        // already sets android:navigationBarColor/windowLightNavigationBar
        // to this app's own dark color (see that file's own comment for
        // the FIRST fix this bug got). Root cause this time is a newer,
        // separate one: this app's compileSdk/targetSdk is 36 (Android
        // 16), and starting at targetSdk 35 (Android 15) Google made
        // edge-to-edge display mandatory - those legacy
        // navigationBarColor/statusBarColor style attributes are
        // documented as having NO EFFECT at all once an app targets that
        // SDK level, regardless of what they're set to. EdgeToEdge.enable()
        // (androidx.activity, already a dependency here) is the actual,
        // current mechanism - forcing SystemBarStyle.dark() with this
        // app's own #0F0F17 for BOTH bars means the real color comes from
        // here now, not from styles.xml, and stays correct on every
        // Android version this app supports (minSdk 24) since this call
        // is itself the forward-compatible replacement, not an SDK-35-only
        // path. Must run before super.onCreate(), same as
        // registerPlugin() below - that's what actually applies to the
        // window this Activity is about to create.
        EdgeToEdge.enable(this, SystemBarStyle.dark(0xFF0F0F17), SystemBarStyle.dark(0xFF0F0F17));

        // SmsFinancePlugin is a local plugin (lives directly in this app
        // module, not an installed npm package), so it isn't picked up by
        // Capacitor's own plugin auto-discovery the way
        // @capacitor/geolocation and @ebarooni/capacitor-calendar are -
        // registerPlugin() is how Capacitor's own docs say to wire a
        // plugin like this in. Must run before super.onCreate(): that's
        // what actually builds the Bridge from the plugin list
        // registerPlugin() appends to underneath.
        registerPlugin(SmsFinancePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
