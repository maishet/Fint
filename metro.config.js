const { getSentryExpoConfig } = require('@sentry/react-native/metro')

const config = getSentryExpoConfig(__dirname)

// Metro no resuelve nada dentro de las carpetas nativas. Sin esto indexa `android/` completo (con la salida de
// gradle: miles de archivos y el APK) y cada build nativo lo deja al 100% de CPU sin responder.
const nativeDirs = /[\\/](android|ios)[\\/].*/
const projectNativeDirs = new RegExp(
  `^${__dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${nativeDirs.source}`
)
const blockList = config.resolver.blockList
const projectWorktrees = new RegExp(`^${__dirname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\\\/]\\.worktrees[\\\\/].*`)
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  projectNativeDirs,
  projectWorktrees,
]

module.exports = config
