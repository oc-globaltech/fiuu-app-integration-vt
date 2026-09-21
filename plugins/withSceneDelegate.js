const { withAppDelegate } = require('expo/config-plugins');

// iOS 27 traps at launch unless the app adopts the UIScene life cycle.
// Expo ships EXExpoAppSceneDelegate (wired up in app.json via UIApplicationSceneManifest),
// which creates the window and starts React Native itself — so the app delegate must
// declare the provider conformance and stop doing both.
const CLASS_DECL = 'class AppDelegate: ExpoAppDelegate {';
const CLASS_DECL_DONE = 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {';
const START_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)[\s\S]*?startReactNative\([\s\S]*?#endif\n/;

module.exports = (config) =>
  withAppDelegate(config, (cfg) => {
    let src = cfg.modResults.contents;

    if (src.includes(CLASS_DECL_DONE)) return cfg; // already applied

    if (!src.includes(CLASS_DECL)) {
      throw new Error('withSceneDelegate: AppDelegate class declaration not found — template changed.');
    }
    if (!START_BLOCK.test(src)) {
      throw new Error('withSceneDelegate: startReactNative block not found — template changed.');
    }

    src = src.replace(CLASS_DECL, CLASS_DECL_DONE).replace(START_BLOCK, '');
    cfg.modResults.contents = src;
    return cfg;
  });
