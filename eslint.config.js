// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist is export output; src/game-html is the generated, minified game bundle.
    ignores: ["dist/*", "src/game-html/game-html.js"],
  }
]);
