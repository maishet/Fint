const appJson = require('./app.json')

const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME

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
