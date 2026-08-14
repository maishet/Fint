import { WifiOff } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Paragraph, XStack } from 'tamagui'
import { useIsOnline } from '../providers/networkStatus'

/**
 * Franja global de conectividad. Se monta al pie de la navegación (bajo el tab
 * bar) para no solapar los headers nativos ni bloquear los toques. Sólo ocupa
 * espacio cuando la app está sin conexión.
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const isOnline = useIsOnline()

  if (isOnline) return null

  return (
    <XStack
      bg="$color12"
      items="center"
      justify="center"
      gap="$2"
      px="$4"
      pt="$2.5"
      pb={insets.bottom + 8}
    >
      <WifiOff size={15} color="$color1" />
      <Paragraph color="$color1" fontSize="$2" fontWeight="700">
        {t('network.offlineBanner')}
      </Paragraph>
    </XStack>
  )
}
