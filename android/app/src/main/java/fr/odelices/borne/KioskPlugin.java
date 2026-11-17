package fr.odelices.borne;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import java.io.File;
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

    /**
     * Efface toutes les données de l'appli (menu, réglages, commandes, fichiers exportés),
     * puis ouvre la fenêtre Android de désinstallation.
     */
    @PluginMethod
    public void wipeAndUninstall(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try { getActivity().stopLockTask(); } catch (Exception ignored) { }
            try {
                getContext().getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE).edit().clear().commit();
                WebStorage.getInstance().deleteAllData();
                CookieManager.getInstance().removeAllCookies(null);
                deleteRecursive(getContext().getCacheDir());
                deleteRecursive(getContext().getFilesDir());
                File ext = getContext().getExternalCacheDir();
                if (ext != null) deleteRecursive(ext);
            } catch (Exception ignored) { }
            try {
                Intent intent = new Intent(Intent.ACTION_DELETE, Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Ouvrez Paramètres > Applications > O'Délices Borne > Désinstaller");
            }
        });
    }

    private static void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        File[] children = f.listFiles();
        if (children != null) for (File c : children) {
            if (c.isDirectory()) deleteRecursive(c);
            c.delete();
        }
    }
}
