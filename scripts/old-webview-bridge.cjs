// Rend le "pont" Capacitor (écran <-> Android : imprimante, sauvegarde...) lisible
// par les très anciens moteurs web (Android 5.1 jamais mis à jour).
// Le fichier produit remplace celui de Capacitor dans l'APK.
const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const root = path.join(__dirname, "..");
const src = path.join(root, "node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js");
const out = path.join(root, "android/app/src/main/assets/native-bridge.js");

const code = fs.readFileSync(src, "utf8");
const res = babel.transformSync(code, {
  babelrc: false,
  configFile: false,
  sourceType: "script",
  presets: [["@babel/preset-env", { targets: { chrome: "37" }, modules: false }]],
});
const regenerator = fs.readFileSync(require.resolve("regenerator-runtime/runtime.js"), "utf8");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, "/* native-bridge Capacitor converti pour anciens WebView */\n" + regenerator + "\n" + res.code);
console.log("native-bridge.js converti →", path.relative(root, out));
