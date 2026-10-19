const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/**
 * `"orientation": "landscape"` becomes android:screenOrientation="landscape", which allows only one
 * landscape side. The game should turn with the phone, so the main activity uses sensorLandscape
 * (both landscape sides, never portrait).
 */
module.exports = function withSensorLandscape(config) {
  return withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity.$['android:screenOrientation'] = 'sensorLandscape';
    return cfg;
  });
};
