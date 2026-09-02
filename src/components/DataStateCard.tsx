import { AlertCircle, Inbox, RefreshCw } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { Paragraph, YStack } from 'tamagui'
import { FintButton, FintCard } from '../ui'

export function DataStateCard({ message, onRetry, title }: { message: string; onRetry?: () => void; title?: string }) {
  const { t } = useTranslation()
  const isError = Boolean(onRetry)
  return (
    <FintCard bg={isError ? '$red2' : '$card'} borderColor={isError ? '$red5' : '$borderColor'} items="center" py="$5">
      <YStack gap="$3" items="center" maxW={300}>
        <YStack
          width={44}
          height={44}
          rounded="$10"
          bg={isError ? '$red4' : '$secondary'}
          items="center"
          justify="center"
        >
          {isError ? <AlertCircle size={22} color="$red10" /> : <Inbox size={22} color="$color10" />}
        </YStack>
        <YStack gap="$1" items="center">
          {isError ? <Paragraph color="$color12" text="center" fontFamily="$heading" fontSize="$4" fontWeight="600">{title ?? t('states.errorTitle')}</Paragraph> : null}
          <Paragraph color="$color10" text="center" fontWeight={isError ? '400' : '600'}>{message}</Paragraph>
        </YStack>
        {onRetry ? <FintButton size="$3" icon={<RefreshCw size={16} />} onPress={onRetry}>{t('actions.retry')}</FintButton> : null}
      </YStack>
    </FintCard>
  )
}
