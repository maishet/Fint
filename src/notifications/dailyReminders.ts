import { Platform } from 'react-native'
import i18n from '../i18n'
import { configureNotificationChannels, loadNotifications } from './pushNotifications'

const REMINDER_ID = 'fint-daily-reminder'

export const REMINDER_HOUR = 20
export const REMINDER_MINUTE = 0

async function hasNotificationPermission() {
  const Notifications = await loadNotifications()
  if (!Notifications) return false
  const permissions = await Notifications.getPermissionsAsync()
  return permissions.granted
}

export async function scheduleDailyReminder(hour: number = REMINDER_HOUR, minute: number = REMINDER_MINUTE) {
  const Notifications = await loadNotifications()
  if (!Notifications) return false
  if (!(await hasNotificationPermission())) return false
  await configureNotificationChannels(Notifications)
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined)
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: i18n.t('notifications.dailyReminder.title'),
      body: i18n.t('notifications.dailyReminder.body'),
      data: { type: 'daily-reminder' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: 'daily-reminders' } : {}),
    },
  })
  return true
}

export async function cancelDailyReminder() {
  const Notifications = await loadNotifications()
  if (!Notifications) return
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined)
}

export async function isDailyReminderSchedulable() {
  return hasNotificationPermission()
}
