package com.foxysama.measuresama;

import android.os.Build;
import android.util.DisplayMetrics;
import android.view.Display;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reports the screen's physical pixel density (DisplayMetrics.xdpi / ydpi), which a WebView
 * cannot see, so the on-screen ruler can draw real millimetres and inches.
 */
@CapacitorPlugin(name = "ScreenMetrics")
public class ScreenMetricsPlugin extends Plugin {

    @PluginMethod
    @SuppressWarnings("deprecation")
    public void getMetrics(PluginCall call) {
        Display display = getActivity().getWindowManager().getDefaultDisplay();
        DisplayMetrics metrics = new DisplayMetrics();
        // Real metrics include the system bars, i.e. the whole panel.
        display.getRealMetrics(metrics);

        JSObject result = new JSObject();
        result.put("widthPixels", metrics.widthPixels);
        result.put("heightPixels", metrics.heightPixels);
        result.put("xdpi", (double) metrics.xdpi);
        result.put("ydpi", (double) metrics.ydpi);
        result.put("density", (double) metrics.density);
        result.put("densityDpi", metrics.densityDpi);
        result.put("manufacturer", Build.MANUFACTURER);
        result.put("model", Build.MODEL);
        call.resolve(result);
    }
}
