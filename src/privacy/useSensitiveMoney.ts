import { useTranslation } from 'react-i18next'
import { getAppLocale } from '../i18n'
import { useSensitiveAmounts } from './SensitiveAmountsProvider'

const hiddenAmount = '••••••'

export function useSensitiveMoney() {
  const { i18n, t } = useTranslation()
  const { amountsVisible, isHydrated } = useSensitiveAmounts()
  const shouldShowAmounts = isHydrated && amountsVisible

  const formatSensitiveAmount = (value = 0, currency = 'PEN') => {
    if (!shouldShowAmounts) return hiddenAmount
    return new Intl.NumberFormat(getAppLocale(i18n.resolvedLanguage), { currency, currencyDisplay: 'code', style: 'currency' }).format(value)
  }

  const formatSensitiveAmountOnly = (value = 0) => {
    if (!shouldShowAmounts) return hiddenAmount
    return new Intl.NumberFormat(getAppLocale(i18n.resolvedLanguage), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  }

  const formatSignedAmount = (value = 0, currency = 'PEN', direction: 'income' | 'expense' | 'neutral' = 'neutral') => {
    const formatted = formatSensitiveAmount(value, currency)
    if (!shouldShowAmounts || direction === 'neutral') return formatted
    return `${direction === 'income' ? '+' : '−'}${formatted}`
  }

  const sensitiveAmountAccessibilityLabel = shouldShowAmounts ? undefined : t('privacy.amounts.hiddenLabel')

  return { amountsVisible: shouldShowAmounts, formatSensitiveAmount, formatSensitiveAmountOnly, formatSignedAmount, sensitiveAmountAccessibilityLabel }
}
