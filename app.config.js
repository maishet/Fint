const appJson = require('./app.json')

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim()
const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production'
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME?.trim() || reverseClientId(iosClientId)

if (!iosUrlScheme && isProductionBuild && process.env.EAS_BUILD_PLATFORM === 'ios') {
  throw new Error(
    'Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (o GOOGLE_IOS_URL_SCHEME). Sin el URL scheme el login con Google no funciona en iOS.'
  )
}

module.exports = ({ config }) => ({
  ...config,
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
  },
  plugins: appJson.expo.plugins.map((plugin) =>
    plugin === '@react-native-google-signin/google-signin' && iosUrlScheme
      ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
      : plugin
  ),
})

function reverseClientId(clientId) {
  if (!clientId?.endsWith('.apps.googleusercontent.com')) return undefined
  return `com.googleusercontent.apps.${clientId.slice(0, -'.apps.googleusercontent.com'.length)}`
}
