const { withSettingsGradle } = require('expo/config-plugins');

module.exports = function withSafeAndroidProjectName(config) {
  return withSettingsGradle(config, (androidConfig) => {
    androidConfig.modResults.contents = androidConfig.modResults.contents.replace(
      /rootProject\.name\s*=\s*(['"]).*?\1/,
      "rootProject.name = 'Dish'",
    );
    return androidConfig;
  });
};
