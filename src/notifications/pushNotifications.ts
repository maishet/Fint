import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Localization from 'expo-localization'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { Router } from 'expo-router'
import { financeApi } from '../api/finance'
import i18n, { getAppLocale } from '../i18n'

const installationKey = 'fint-push-installation-id'
const installationRegisteredKey = 'fint-push-installation-registered'

export type PushPermissionState = 'unsupported' | 'granted' | 'denied' | 'undetermined'
type NotificationsModule = typeof import('expo-notifications')

let notificationsModulePromise: Promise<NotificationsModule | null> | null = null

export async function getInstallationId() {
  if (Platform.OS === 'web') return null
  const existing = await SecureStore.getItemAsync(installationKey)
  if (existing) return existing
  const id = crypto.randomUUID()
  await SecureStore.setItemAsync(installationKey, id)
  return id
}

export async function getPushPermissionState(): Promise<PushPermissionState> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'unsupported'
  const Notifications = await loadNotifications()
  if (!Notifications) return 'unsupported'
  const permissions = await Notifications.getPermissionsAsync()
  if (permissions.granted) return await SecureStore.getItemAsync(installationRegisteredKey) === 'true' ? 'granted' : 'undetermined'
  return permissions.status === 'denied' ? 'denied' : 'undetermined'
}

export async function requestAndRegisterPushInstallation() {
  const state = await getPushPermissionState()
  if (state === 'unsupported') return state
  const Notifications = await loadNotifications()
  if (!Notifications) return 'unsupported'
  const permissions = await Notifications.getPermissionsAsync()
  if (!permissions.granted) {
    const requested = await Notifications.requestPermissionsAsync()
    if (!requested.granted) return requested.status === 'denied' ? 'denied' : 'undetermined'
  }
  return await registerPushInstallation() ? 'granted' : 'unsupported'
}

export async function registerPushInstallation() {
  if (Platform.OS === 'web' || !Device.isDevice) return null
  const Notifications = await loadNotifications()
  if (!Notifications) return null
  await configureNotificationChannels(Notifications)
  const permissions = await Notifications.getPermissionsAsync()
  if (!permissions.granted) return null
  const installationId = await getInstallationId()
  if (!installationId) return null
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId
  if (!projectId) return null
  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  await financeApi.upsertPushInstallation(installationId, {
    expoPushToken: token.data,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    locale: getAppLocale(i18n.resolvedLanguage),
    timezone: Localization.getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Lima',
  })
  await SecureStore.setItemAsync(installationRegisteredKey, 'true')
  return installationId
}

export async function unregisterPushInstallation() {
  const installationId = await getInstallationId()
  if (!installationId) return
  await financeApi.deletePushInstallation(installationId)
  await SecureStore.deleteItemAsync(installationRegisteredKey)
}

export function attachNotificationResponseListener(router: Router) {
  let isMounted = true
  let subscription: { remove: () => void } | null = null
  const handle = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
    const url = response?.notification.request.content.data?.url
    if (url === '/pending-movements') router.push('/pending-movements')
    else if (typeof url === 'string' && url.startsWith('/debts')) router.push('/(tabs)/debts')
  }
  loadNotifications().then((Notifications) => {
    if (!Notifications || !isMounted) return
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined)
    subscription = Notifications.addNotificationResponseReceivedListener(handle)
  }).catch(() => undefined)
  return () => {
    isMounted = false
    subscription?.remove()
  }
}

async function configureNotificationChannels(Notifications: NotificationsModule) {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync('payment-reminders', { name: 'Recordatorios de pagos', importance: Notifications.AndroidImportance.HIGH, sound: 'default' })
  await Notifications.setNotificationChannelAsync('pending-movements', { name: 'Movimientos pendientes', importance: Notifications.AndroidImportance.HIGH, sound: 'default' })
}

async function loadNotifications() {
  if (Platform.OS === 'web' || Constants.appOwnership === 'expo') return null
  notificationsModulePromise ??= import('expo-notifications').then((Notifications) => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    })
    return Notifications
  }).catch(() => null)
  return notificationsModulePromise
}
