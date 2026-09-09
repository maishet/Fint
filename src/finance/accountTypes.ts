import { Building2, CreditCard, PiggyBank, Wallet } from '@tamagui/lucide-icons-2'

/** El glifo de cada tipo de cuenta. Lo comparten la lista y los selectores. */
export function getAccountIcon(accountType: string) {
  if (accountType === 'credit_card') return CreditCard
  if (accountType === 'checking_account') return Building2
  if (accountType === 'savings_account') return PiggyBank
  return Wallet
}

export function getAccountTypeLabel(accountType: string, t: (key: string) => string) {
  if (accountType === 'cash') return t('accountTypes.cash')
  if (accountType === 'credit_card') return t('accountTypes.creditCard')
  if (accountType === 'checking_account') return t('accountTypes.checkingAccount')
  if (accountType === 'savings_account') return t('accountTypes.savingsAccount')
  return accountType
}
