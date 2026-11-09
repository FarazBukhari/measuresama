package com.foxysama.measuresama;

import android.content.res.Configuration;
import android.os.Bundle;
import android.webkit.WebView;
import com.foxysama.measuresama.ar.ArMeasurePlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // The app's ground colours (design-system MASTER): light and dark.
    private static final int GROUND_LIGHT = 0xFFF4F4F1;
    private static final int GROUND_DARK = 0xFF0F0F0F;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // App-local plugins must be registered before the bridge starts.
        registerPlugin(ScreenMetricsPlugin.class);
        registerPlugin(ArMeasurePlugin.class);
        super.onCreate(savedInstanceState);
        applyWebViewBackground();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // uiMode is in configChanges, so a light/dark switch lands here instead of a restart.
        applyWebViewBackground();
    }

    /**
     * The WebView shows its background until the page paints. capacitor.config.ts can only set one
     * colour, so follow the phone's light/dark setting here, like the splash screen does, and dark
     * mode never flashes light.
     */
    private void applyWebViewBackground() {
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;
        int night = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        webView.setBackgroundColor(night == Configuration.UI_MODE_NIGHT_YES ? GROUND_DARK : GROUND_LIGHT);
    }
}
