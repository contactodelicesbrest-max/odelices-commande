package fr.odelices.haccp;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

/**
 * Impression Bluetooth "classique" (profil série SPP), utilisée par la plupart des
 * imprimantes de tickets thermiques (ESC/POS). Les octets à imprimer sont préparés
 * côté JavaScript et envoyés ici en base64.
 */
@CapacitorPlugin(
    name = "BtPrinter",
    permissions = { @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bt") }
)
public class BtPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private boolean needsPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bt") != PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return bm != null ? bm.getAdapter() : null;
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bt", call, "permCallback");
            return;
        }
        doListPaired(call);
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (needsPermission()) {
            requestPermissionForAlias("bt", call, "permCallback");
            return;
        }
        doPrint(call);
    }

    @PermissionCallback
    private void permCallback(PluginCall call) {
        if (needsPermission()) {
            call.reject("Autorisation Bluetooth refusée. Autorise « Appareils à proximité » pour l'appli dans les paramètres Android.");
            return;
        }
        if ("print".equals(call.getMethodName())) doPrint(call);
        else doListPaired(call);
    }

    @SuppressLint("MissingPermission")
    private void doListPaired(PluginCall call) {
        BluetoothAdapter ad = adapter();
        if (ad == null) {
            call.reject("Ce téléphone n'a pas de Bluetooth.");
            return;
        }
        if (!ad.isEnabled()) {
            call.reject("Le Bluetooth est désactivé. Active-le puis réessaie.");
            return;
        }
        JSArray list = new JSArray();
        Set<BluetoothDevice> devices = ad.getBondedDevices();
        if (devices != null) {
            for (BluetoothDevice d : devices) {
                JSObject o = new JSObject();
                o.put("name", d.getName() != null ? d.getName() : "(sans nom)");
                o.put("address", d.getAddress());
                list.put(o);
            }
        }
        JSObject ret = new JSObject();
        ret.put("devices", list);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    private void doPrint(final PluginCall call) {
        final String address = call.getString("address");
        final String data = call.getString("data");
        if (address == null || data == null) {
            call.reject("Imprimante ou données manquantes.");
            return;
        }
        final BluetoothAdapter ad = adapter();
        if (ad == null || !ad.isEnabled()) {
            call.reject("Le Bluetooth est désactivé. Active-le puis réessaie.");
            return;
        }
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                BluetoothDevice device = ad.getRemoteDevice(address);
                ad.cancelDiscovery();
                socket = connect(device);
                OutputStream out = socket.getOutputStream();
                // Envoi par petits morceaux : certaines imprimantes ont un petit tampon.
                int chunk = 512;
                for (int i = 0; i < bytes.length; i += chunk) {
                    out.write(bytes, i, Math.min(chunk, bytes.length - i));
                    out.flush();
                    Thread.sleep(20);
                }
                Thread.sleep(600); // laisser le temps d'imprimer avant de couper la connexion
                call.resolve();
            } catch (Exception e) {
                call.reject("Impression impossible : " + e.getMessage()
                    + ". Vérifie que l'imprimante est allumée, appairée, et qu'aucun autre appareil (tablette Uber Eats) n'y est connecté.");
            } finally {
                if (socket != null) {
                    try { socket.close(); } catch (Exception ignored) { }
                }
            }
        }).start();
    }

    @SuppressLint("MissingPermission")
    private BluetoothSocket connect(BluetoothDevice device) throws Exception {
        Exception last = null;
        try {
            BluetoothSocket s = device.createRfcommSocketToServiceRecord(SPP_UUID);
            s.connect();
            return s;
        } catch (Exception e) { last = e; }
        try {
            BluetoothSocket s = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            s.connect();
            return s;
        } catch (Exception e) { last = e; }
        try {
            // Repli connu pour certaines imprimantes chinoises : canal RFCOMM 1 direct
            Method m = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket s = (BluetoothSocket) m.invoke(device, 1);
            s.connect();
            return s;
        } catch (Exception e) { last = e; }
        throw last;
    }
}
