const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins')

module.exports = function withAndroidFreeOrientation(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(config.modResults)
    delete mainActivity.$['android:screenOrientation']
    return config
  })
}
