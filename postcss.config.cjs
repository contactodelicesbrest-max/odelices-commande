// Couleurs en double (valeur fixe + variable) pour les très anciens moteurs web (Android 5.1)
module.exports = {
  plugins: [require("postcss-custom-properties")({ preserve: true })],
};
