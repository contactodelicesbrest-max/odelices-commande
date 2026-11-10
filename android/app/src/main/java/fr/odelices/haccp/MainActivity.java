package fr.odelices.haccp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin maison : impression Bluetooth (étiquettes DLC sur imprimante ticket ESC/POS)
        registerPlugin(BtPrinterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
