package com.foxysama.measuresama;

import android.os.Bundle;
import com.foxysama.measuresama.ar.ArMeasurePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(ScreenMetricsPlugin.class);
        registerPlugin(ArMeasurePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
