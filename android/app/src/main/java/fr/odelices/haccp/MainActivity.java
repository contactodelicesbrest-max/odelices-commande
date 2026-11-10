package fr.odelices.haccp;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin maison : impression Bluetooth (étiquettes DLC sur imprimante ticket ESC/POS)
        registerPlugin(BtPrinterPlugin.class);
        // Plugin maison : lecture du texte des étiquettes (ML Kit, sur le téléphone)
        registerPlugin(TextReaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
