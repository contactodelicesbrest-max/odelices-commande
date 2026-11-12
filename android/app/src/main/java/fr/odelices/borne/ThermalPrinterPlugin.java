package fr.odelices.borne;

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
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Impression ESC/POS sur imprimante thermique, en Bluetooth (SPP) ou en réseau (TCP port 9100).
 * Les données du ticket sont préparées côté JavaScript et envoyées ici en base64.
 */
@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = { @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class ThermalPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    // Une seule impression à la fois : les tickets passent dans l'ordre
    private final ExecutorService queue = Executors.newSingleThreadExecutor();

    private boolean needsBtPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED;
    }

    private BluetoothAdapter adapter() {
        BluetoothManager bm = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return bm != null ? bm.getAdapter() : null;
    }

    @PluginMethod
    public void listPaired(PluginCall call) {
        if (needsBtPermission()) {
            requestPermissionForAlias("bluetooth", call, "listPairedPerm");
            return;
        }
        doListPaired(call);
    }

    @PermissionCallback
    private void listPairedPerm(PluginCall call) {
        if (needsBtPermission()) call.reject("Autorisation Bluetooth refusée. Activez-la dans Paramètres > Applications > O'Délices Borne > Autorisations.");
        else doListPaired(call);
    }

    @SuppressLint("MissingPermission")
    private void doListPaired(PluginCall call) {
        BluetoothAdapter a = adapter();
        if (a == null) { call.reject("Cette tablette n'a pas de Bluetooth"); return; }
        if (!a.isEnabled()) { call.reject("Le Bluetooth est désactivé. Activez-le dans les paramètres Android."); return; }
        JSArray list = new JSArray();
        Set<BluetoothDevice> devices = a.getBondedDevices();
        if (devices != null) {
            for (BluetoothDevice d : devices) {
                JSObject o = new JSObject();
                o.put("name", d.getName() != null ? d.getName() : d.getAddress());
                o.put("address", d.getAddress());
                list.put(o);
            }
        }
        JSObject r = new JSObject();
        r.put("devices", list);
        call.resolve(r);
    }

    @PluginMethod
    public void printBluetooth(PluginCall call) {
        if (needsBtPermission()) {
            requestPermissionForAlias("bluetooth", call, "printBluetoothPerm");
            return;
        }
        doPrintBluetooth(call);
    }

    @PermissionCallback
    private void printBluetoothPerm(PluginCall call) {
        if (needsBtPermission()) call.reject("Autorisation Bluetooth refusée");
        else doPrintBluetooth(call);
    }

    private void doPrintBluetooth(PluginCall call) {
        final String address = call.getString("address");
        final String data = call.getString("data");
        if (address == null || data == null) { call.reject("Paramètres manquants"); return; }
        final byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        queue.execute(() -> {
            String err = null;
            for (int attempt = 0; attempt < 3; attempt++) {
                err = sendBluetooth(address, bytes);
                if (err == null) break;
                try { Thread.sleep(700); } catch (InterruptedException ignored) { }
            }
            if (err == null) call.resolve();
            else call.reject(err);
        });
    }

    @SuppressLint("MissingPermission")
    private String sendBluetooth(String address, byte[] bytes) {
        BluetoothAdapter a = adapter();
        if (a == null) return "Pas de Bluetooth sur cette tablette";
        if (!a.isEnabled()) return "Bluetooth désactivé";
        BluetoothSocket socket = null;
        try {
            BluetoothDevice device = a.getRemoteDevice(address);
            try { a.cancelDiscovery(); } catch (Exception ignored) { }
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
            } catch (Exception first) {
                try { if (socket != null) socket.close(); } catch (Exception ignored) { }
                // Repli pour certaines imprimantes chinoises qui refusent la connexion standard
                try {
                    socket = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (Exception second) {
                    try { if (socket != null) socket.close(); } catch (Exception ignored) { }
                    Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                    socket = (BluetoothSocket) m.invoke(device, 1);
                    socket.connect();
                }
            }
            OutputStream out = socket.getOutputStream();
            int chunk = 512;
            for (int i = 0; i < bytes.length; i += chunk) {
                out.write(bytes, i, Math.min(chunk, bytes.length - i));
                out.flush();
                Thread.sleep(20);
            }
            // laisse le temps à l'imprimante de vider son tampon avant de fermer
            Thread.sleep(Math.min(2500, 300 + bytes.length / 4));
            return null;
        } catch (Exception e) {
            return "Imprimante Bluetooth injoignable (allumée ? papier ? à portée ?)";
        } finally {
            try { if (socket != null) socket.close(); } catch (Exception ignored) { }
        }
    }

    @PluginMethod
    public void printNetwork(PluginCall call) {
        final String host = call.getString("host");
        final int port = call.getInt("port", 9100);
        final String data = call.getString("data");
        if (host == null || data == null) { call.reject("Paramètres manquants"); return; }
        final byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        queue.execute(() -> {
            String err = null;
            for (int attempt = 0; attempt < 2; attempt++) {
                try (Socket s = new Socket()) {
                    s.connect(new InetSocketAddress(host, port), 4000);
                    s.setSoTimeout(5000);
                    OutputStream out = s.getOutputStream();
                    out.write(bytes);
                    out.flush();
                    Thread.sleep(200);
                    err = null;
                    break;
                } catch (Exception e) {
                    err = "Imprimante réseau injoignable (" + host + ":" + port + ")";
                    try { Thread.sleep(500); } catch (InterruptedException ignored) { }
                }
            }
            if (err == null) call.resolve();
            else call.reject(err);
        });
    }
}
