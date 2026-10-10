const { withXcodeProject, withInfoPlist } = require('@expo/config-plugins');

// THE APP IS NOT CALLED SELODA (Ruth, 10 October 2026, on Apple's first-upload
// email, which referred to "the 'Seloda.app' bundle": "that's not correct.
// change it seloda.app is wrong").
//
// She is right, and it is a misspelling rather than an abbreviation. It comes
// from @expo/config-plugins/build/ios/utils/Xcodeproj.js:
//
//     name.replace(/[\W_]+/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
//
// The steps are in the wrong order. Without the `u` flag `\W` matches "í", so
// the FIRST replace deletes the character outright; the NFD normalise and the
// combining-mark strip that follow - which exist precisely to turn "í" into "i"
// - then have nothing left to work on. Reverse the two and "Selodía" sanitises
// to "Selodia", which is plainly what that line was written to produce.
//
// So PRODUCT_NAME became "Seloda", and PRODUCT_NAME is:
//   - the .app bundle's filename, which Apple quotes back in review email;
//   - the default for CFBundleName, which iOS shows in Settings and which the
//     App Store can show in lists.
//
// CFBundleDisplayName was always correct ("Selodía", accent and all) so the
// home screen never showed this. That is why it survived: the one place anybody
// looks was right, and every other place was wrong.
//
// WHY "Selodia" AND NOT "Selodía" FOR PRODUCT_NAME. It names a file and an
// Xcode build setting, and non-ASCII in either is a class of problem nobody
// needs. "Selodia" is also exactly how the company is spelled on the Companies
// House record, so it is a real name rather than an improvisation. The accented
// form stays everywhere a person reads it.
//
// IT THROWS RATHER THAN SILENTLY DOING NOTHING, for the same reason
// with-health-rationale does: a plugin that cannot find its anchor and shrugs
// produces a build that looks fine and is wrong in a place nobody checks.

const PRODUCT_NAME = 'Selodia';
const DISPLAY_NAME = 'Selodía';

const withProductName = (config) => {
  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    let set = 0;
    for (const key of Object.keys(configurations)) {
      const item = configurations[key];
      if (!item || typeof item !== 'object' || !item.buildSettings) continue;
      if (typeof item.buildSettings.PRODUCT_NAME === 'undefined') continue;
      item.buildSettings.PRODUCT_NAME = `"${PRODUCT_NAME}"`;
      set += 1;
    }
    if (set === 0) {
      throw new Error(
        'with-product-name: no build configuration had a PRODUCT_NAME to set. ' +
          'Expo has changed how the iOS project is generated, and the bundle would ' +
          'have shipped as Seloda.app again.'
      );
    }
    return cfg;
  });

  // CFBundleName defaults to $(PRODUCT_NAME) and is shown to people - in
  // Settings, and sometimes in App Store lists. It takes the accented form,
  // because it is read rather than used as a filename. CFBundleDisplayName is
  // set here too rather than relied on, so the two cannot drift.
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.CFBundleName = DISPLAY_NAME;
    cfg.modResults.CFBundleDisplayName = DISPLAY_NAME;
    return cfg;
  });

  return config;
};

module.exports = withProductName;
