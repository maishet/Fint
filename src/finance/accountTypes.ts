import { Banknote, Building2, CreditCard, Landmark, PiggyBank, Wallet } from '@tamagui/lucide-icons-2'

/** El glifo de cada tipo en el formulario de cuenta, donde corriente y ahorros tienen que distinguirse. */
export function getAccountIcon(accountType: string) {
  if (accountType === 'credit_card') return CreditCard
  if (accountType === 'checking_account') return Building2
  if (accountType === 'savings_account') return PiggyBank
  return Wallet
}

/**
 * El ícono de la cuenta en las filas (marca D): el de la pantalla Cuentas, que comparten los selectores de cuenta.
 * Las cuentas no tienen emoji en la API, así que llevan el ícono de su tipo y no la inicial.
 */
export function getAccountRowIcon(accountType: string | null | undefined) {
  if (accountType === 'cash') return Banknote
  if (accountType === 'credit_card') return CreditCard
  if (accountType === 'checking_account' || accountType === 'savings_account') return Landmark
  return Wallet
}

export function getAccountTypeLabel(accountType: string, t: (key: string) => string) {
  if (accountType === 'cash') return t('accountTypes.cash')
  if (accountType === 'credit_card') return t('accountTypes.creditCard')
  if (accountType === 'checking_account') return t('accountTypes.checkingAccount')
  if (accountType === 'savings_account') return t('accountTypes.savingsAccount')
  return accountType
}
