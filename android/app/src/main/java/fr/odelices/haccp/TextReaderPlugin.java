package fr.odelices.haccp;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * Lecture du texte d'une photo d'étiquette avec Google ML Kit (sur le téléphone, sans internet).
 * Renvoie le texte complet et chaque ligne avec sa hauteur (pour deviner le nom du produit,
 * généralement écrit en plus gros).
 */
@CapacitorPlugin(name = "TextReader")
public class TextReaderPlugin extends Plugin {

    private TextRecognizer recognizer;

    private TextRecognizer recognizer() {
        if (recognizer == null) recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        return recognizer;
    }

    @PluginMethod
    public void recognize(final PluginCall call) {
        String data = call.getString("data");
        if (data == null) {
            call.reject("Image manquante.");
            return;
        }
        try {
            int comma = data.indexOf(',');
            if (data.startsWith("data:") && comma > 0) data = data.substring(comma + 1);
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Bitmap bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp == null) {
                call.reject("Image illisible.");
                return;
            }
            InputImage image = InputImage.fromBitmap(bmp, 0);
            recognizer().process(image)
                .addOnSuccessListener(result -> {
                    JSArray lines = new JSArray();
                    for (Text.TextBlock block : result.getTextBlocks()) {
                        for (Text.Line line : block.getLines()) {
                            JSObject o = new JSObject();
                            o.put("text", line.getText());
                            Rect r = line.getBoundingBox();
                            o.put("top", r != null ? r.top : 0);
                            o.put("left", r != null ? r.left : 0);
                            o.put("height", r != null ? r.height() : 0);
                            lines.put(o);
                        }
                    }
                    JSObject ret = new JSObject();
                    ret.put("text", result.getText());
                    ret.put("lines", lines);
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> call.reject("Lecture impossible : " + e.getMessage()));
        } catch (Exception e) {
            call.reject("Lecture impossible : " + e.getMessage());
        }
    }
}
