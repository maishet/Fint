import { Inbox, WifiOff } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { View, YStack } from 'tamagui'
import { fontFace } from '../theme/typography'
import { FintButton, FText } from '../ui'

/**
 * Estado de una sección sin datos o con error (marca D): tarjeta `surface` de radio 24 con el ícono en un cuadro
 * `canvas`, el título 17/800 y el mensaje. Con `onRetry`, el ícono es "sin conexión" y abajo va "Reintentar" en tinta.
 */
export function DataStateCard({ message, onRetry, title }: { message: string; onRetry?: () => void; title?: string }) {
  const { t } = useTranslation()
  const isError = Boolean(onRetry)
  return (
    <YStack bg="$surface" rounded={24} px={20} py={22} items="center" gap={8}>
      <View width={52} height={52} rounded={18} bg="$canvas" items="center" justify="center">
        {isError ? <WifiOff size={22} color="$ink" strokeWidth={2} /> : <Inbox size={22} color="$inkMuted" strokeWidth={2} />}
      </View>
      {isError ? (
        <FText style={{ fontFamily: fontFace.display[700], fontSize: 17, lineHeight: 22, textAlign: 'center', marginTop: 4 }}>
          {title ?? t('states.errorTitle')}
        </FText>
      ) : null}
      <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 }}>
        {message}
      </FText>
      {onRetry ? (
        <FintButton variant="ink" size="row" minH={44} mt={8} onPress={onRetry}>
          {t('actions.retry')}
        </FintButton>
      ) : null}
    </YStack>
  )
}
