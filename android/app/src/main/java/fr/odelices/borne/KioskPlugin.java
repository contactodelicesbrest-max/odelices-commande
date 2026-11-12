package fr.odelices.borne;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Mode borne : épinglage de l'application (le client ne peut plus en sortir)
@CapacitorPlugin(name = "Kiosk")
public class KioskPlugin extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startLockTask();
                call.resolve();
            } catch (Exception e) {
                call.reject("Impossible d'activer le mode borne : " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().stopLockTask();
                call.resolve();
            } catch (Exception e) {
                call.reject("Impossible de désactiver le mode borne : " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        boolean active;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            active = am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        } else {
            active = am.isInLockTaskMode();
        }
        JSObject r = new JSObject();
        r.put("active", active);
        call.resolve(r);
    }
}
