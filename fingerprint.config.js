/** @type {import('@expo/fingerprint').Config} */
module.exports = {
  fileHookTransform: (source, chunk) => {
    if (source.type !== 'contents' || source.id !== 'expoConfig' || chunk == null) return chunk
    const config = JSON.parse(chunk.toString())
    for (const plugin of config.plugins ?? []) {
      if (Array.isArray(plugin) && plugin[0] === '@sentry/react-native/expo') {
        delete plugin[1]?.experimental_android?.includeProguardMapping
      }
    }
    return JSON.stringify(config)
  },
}
