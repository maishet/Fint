const { AndroidConfig, withAndroidColorsNight } = require('expo/config-plugins')

/**
 * El fondo de la ventana (`backgroundColor` de app.json, lo aplica expo-system-ui) es uno solo. Este plugin le da
 * su versión oscura, como la pantalla nativa de arranque: con el sistema en oscuro, entre el arranque y la
 * pantalla de carga se ve la losa oscura y no la clara.
 */
module.exports = function withNightWindowBackground(config, { color }) {
  return withAndroidColorsNight(config, (config) => {
    config.modResults = AndroidConfig.Colors.setColorItem(
      AndroidConfig.Resources.buildResourceItem({ name: 'activityBackground', value: color }),
      config.modResults
    )
    return config
  })
}
