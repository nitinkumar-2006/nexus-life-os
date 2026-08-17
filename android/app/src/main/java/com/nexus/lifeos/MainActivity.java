package com.nexus.lifeos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
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
