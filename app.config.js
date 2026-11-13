const fs = require('fs')
const path = require('path')
const appJson = require('./app.json')
const androidProguardRules = fs.readFileSync(path.join(__dirname, 'android-proguard-rules.pro'), 'utf8')

const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim()
const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production'
const isEasBuild = process.env.EAS_BUILD === 'true'
const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME?.trim() || reverseClientId(iosClientId)

if (!iosUrlScheme && isProductionBuild && process.env.EAS_BUILD_PLATFORM === 'ios') {
  throw new Error(
    'Falta EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID (o GOOGLE_IOS_URL_SCHEME). Sin el URL scheme el login con Google no funciona en iOS.'
  )
}

const buildConfig = ({ config }) => ({
  ...config,
  ...appJson.expo,
  android: {
    ...appJson.expo.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
    config: {
      ...appJson.expo.android.config,
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY || '' },
    },
  },
  plugins: appJson.expo.plugins.map((plugin) => {
    if (plugin === '@react-native-google-signin/google-signin' && iosUrlScheme) {
      return ['@react-native-google-signin/google-signin', { iosUrlScheme }]
    }
    if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
      const [name, options] = plugin
      return [name, { ...options, android: { ...options.android, extraProguardRules: androidProguardRules } }]
    }
    if (Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo') {
      const [name, options] = plugin
      return [
        name,
        {
          ...options,
          experimental_android: { ...options.experimental_android, includeProguardMapping: isEasBuild },
        },
      ]
    }
    return plugin
  }),
})

module.exports = (ctx) => {
  const expoConfig = buildConfig(ctx)
  // Solo desarrollo local con Xcode 27 (ver plugins/withXcode27Compat.js). No afecta builds de EAS.
  if (process.env.FINT_XCODE27_COMPAT === '1') {
    expoConfig.plugins = [...expoConfig.plugins, './plugins/withXcode27Compat']
  }
  return expoConfig
}

function reverseClientId(clientId) {
  if (!clientId?.endsWith('.apps.googleusercontent.com')) return undefined
  return `com.googleusercontent.apps.${clientId.slice(0, -'.apps.googleusercontent.com'.length)}`
}
