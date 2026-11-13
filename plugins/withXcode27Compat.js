/**
 * Compatibilidad de desarrollo con Xcode 27 / iOS 27 SDK (Expo SDK 55).
 *
 * Solo se activa con FINT_XCODE27_COMPAT=1 (ver app.config.js), para no alterar los builds de EAS.
 *
 * 1. El SDK de iOS 27 exige el ciclo de vida por scenes (UIScene). Expo 55 todavia usa
 *    AppDelegate + window, asi que se agrega un SceneDelegate que crea la ventana y arranca
 *    React Native, y se declara UIApplicationSceneManifest en el Info.plist.
 * 2. Xcode 27 rechaza targets de despliegue < 15.0 y expo-router necesita iOS 16, por lo que
 *    se sube el minimo a 16.0 en la app y en todos los pods.
 *
 * Quitar este plugin cuando se actualice a un SDK de Expo con soporte nativo de scenes.
 */
const fs = require('fs')
const path = require('path')
const { IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } = require('expo/config-plugins')

const MIN_IOS = '16.0'

const SCENE_DELEGATE = `import UIKit
import React

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    appDelegate.reactNativeFactory?.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: nil)

    if let url = connectionOptions.urlContexts.first?.url {
      _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`

const WINDOW_BLOCK = /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\s*\n/

const POST_INSTALL_SNIPPET = `
    # Xcode 27: minimo iOS ${MIN_IOS} en todos los pods (ver plugins/withXcode27Compat.js)
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
      end
    end
`

module.exports = function withXcode27Compat(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    }
    return c
  })

  config = withDangerousMod(config, [
    'ios',
    (c) => {
      const { platformProjectRoot, projectName } = c.modRequest

      fs.writeFileSync(path.join(platformProjectRoot, projectName, 'SceneDelegate.swift'), SCENE_DELEGATE)

      const appDelegatePath = path.join(platformProjectRoot, projectName, 'AppDelegate.swift')
      let appDelegate = fs.readFileSync(appDelegatePath, 'utf8')
      if (WINDOW_BLOCK.test(appDelegate)) {
        appDelegate = appDelegate.replace(WINDOW_BLOCK, '')
        fs.writeFileSync(appDelegatePath, appDelegate)
      }

      const podfilePath = path.join(platformProjectRoot, 'Podfile')
      let podfile = fs.readFileSync(podfilePath, 'utf8')
      podfile = podfile.replace(/(platform :ios, [^\n]*?\|\| )'[\d.]+'/, `$1'${MIN_IOS}'`)
      if (!podfile.includes('withXcode27Compat')) {
        podfile = podfile.replace(/(\n\s*)(:ccache_enabled => [^\n]*\n\s*\)\n)/, `$1$2${POST_INSTALL_SNIPPET}`)
      }
      fs.writeFileSync(podfilePath, podfile)
      return c
    },
  ])

  config = withXcodeProject(config, (c) => {
    const { projectName } = c.modRequest
    const project = c.modResults

    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/SceneDelegate.swift`,
      groupName: projectName,
      project,
    })

    const configs = project.pbxXCBuildConfigurationSection()
    for (const key of Object.keys(configs)) {
      const settings = configs[key].buildSettings
      if (settings && settings.IPHONEOS_DEPLOYMENT_TARGET) {
        settings.IPHONEOS_DEPLOYMENT_TARGET = MIN_IOS
      }
    }
    return c
  })

  return config
}
