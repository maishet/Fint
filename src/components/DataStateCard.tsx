import { AlertCircle, RefreshCw } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { Paragraph, YStack } from 'tamagui'
import { FintButton, FintCard } from '../ui'

export function DataStateCard({ message, onRetry, title }: { message: string; onRetry?: () => void; title?: string }) {
  const { t } = useTranslation()
  const isError = Boolean(onRetry)
  return (
    <FintCard bg={isError ? '$red2' : '$accent1'} borderColor={isError ? '$red5' : '$accent4'} items="center" py="$5">
      <YStack gap="$3" items="center" maxW={300}>
        {isError ? <YStack width={44} height={44} rounded="$10" bg="$red4" items="center" justify="center"><AlertCircle size={22} color="$red10" /></YStack> : null}
        <YStack gap="$1" items="center">
          {isError ? <Paragraph color="$color12" text="center" fontFamily="$heading" fontSize="$4" fontWeight="800">{title ?? t('states.errorTitle')}</Paragraph> : null}
          <Paragraph color={isError ? '$color10' : '$accent11'} text="center" fontWeight="600">{message}</Paragraph>
        </YStack>
        {onRetry ? <FintButton size="$3" icon={<RefreshCw size={16} />} onPress={onRetry}>{t('actions.retry')}</FintButton> : null}
      </YStack>
    </FintCard>
  )
}
