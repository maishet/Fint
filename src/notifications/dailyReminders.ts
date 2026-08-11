import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import i18n from '../i18n'
import { configureNotificationChannels, loadNotifications } from './pushNotifications'

const reminderNotificationIdKey = 'fint-daily-reminder-notification-id'

export const REMINDER_HOUR = 20
export const REMINDER_MINUTE = 0

async function hasNotificationPermission() {
  const Notifications = await loadNotifications()
  if (!Notifications) return false
  const permissions = await Notifications.getPermissionsAsync()
  return permissions.granted
}

export async function scheduleDailyReminder() {
  if (Platform.OS === 'web') return false
  const Notifications = await loadNotifications()
  if (!Notifications) return false
  if (!(await hasNotificationPermission())) return false
  await configureNotificationChannels(Notifications)
  await cancelDailyReminder()
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: i18n.t('notifications.dailyReminder.title'),
      body: i18n.t('notifications.dailyReminder.body'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      ...(Platform.OS === 'android' ? { channelId: 'daily-reminders' } : {}),
    },
  })
  await SecureStore.setItemAsync(reminderNotificationIdKey, identifier)
  return true
}

export async function cancelDailyReminder() {
  if (Platform.OS === 'web') return
  const Notifications = await loadNotifications()
  if (!Notifications) return
  const existing = await SecureStore.getItemAsync(reminderNotificationIdKey)
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing).catch(() => undefined)
    await SecureStore.deleteItemAsync(reminderNotificationIdKey).catch(() => undefined)
  }
}

export async function isDailyReminderSchedulable() {
  if (Platform.OS === 'web') return false
  return hasNotificationPermission()
}
