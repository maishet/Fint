import { Eye, EyeOff } from '@tamagui/lucide-icons-2'
import { useTranslation } from 'react-i18next'
import { YStack } from 'tamagui'
import { haptics } from '../ui/haptics'
import { useSensitiveAmounts } from './SensitiveAmountsProvider'

export function SensitiveAmountToggle({ color = '$primary', inverse = false }: { color?: string; inverse?: boolean }) {
  const { t } = useTranslation()
  const { amountsVisible, isHydrated, toggleAmountsVisibility } = useSensitiveAmounts()
  const Icon = amountsVisible ? EyeOff : Eye
  const label = amountsVisible ? t('privacy.amounts.hide') : t('privacy.amounts.show')
  return (
    <YStack
      width={44}
      height={44}
      rounded="$10"
      bg={inverse ? 'rgba(255,255,255,0.12)' : '$secondary'}
      borderColor={inverse ? 'rgba(255,255,255,0.18)' : '$borderColor'}
      borderWidth={1}
      items="center"
      justify="center"
      opacity={isHydrated ? 1 : 0.7}
      pressStyle={{ scale: 0.96, opacity: 0.84 }}
      role="button"
      aria-label={label}
      accessibilityHint={t('privacy.amounts.toggleHint')}
      onPress={() => {
        haptics.select()
        toggleAmountsVisibility()
      }}
    >
      <Icon size={21} color={color as never} />
    </YStack>
  )
}
