import { CheckCircle2 } from '@tamagui/lucide-icons-2'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, YStack } from 'tamagui'
import { requestAndRegisterPushInstallation } from '../src/notifications/pushNotifications'

export default function GmailConnectedScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>()
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    requestAndRegisterPushInstallation().catch(() => undefined)
    const timeout = setTimeout(() => router.replace('/gmail-settings'), 700)
    return () => clearTimeout(timeout)
  }, [router])

  return <YStack flex={1} bg="$background" items="center" justify="center" gap="$3" p="$6"><CheckCircle2 size={48} color="$green10" /><Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="800">{t('gmail.connected')}</Paragraph><Paragraph color="$color10">{email}</Paragraph><Spinner color="$primary" /></YStack>
}
