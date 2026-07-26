import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, CreditCard, Landmark, PiggyBank, Save, Wallet } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { ApiRequestError } from '../src/api/client'
import { financeApi } from '../src/api/finance'
import { normalizeAccount } from '../src/api/mappers'
import type { AccountType } from '../src/api/types'
import { DataStateCard } from '../src/components/DataStateCard'
import { Screen } from '../src/components/Screen'
import { currencyOptions } from '../src/finance/currencies'
import { FintButton, FintInput, FintSheetSelect } from '../src/ui'

const accountDetailsSchema = z.object({
  name: z.string().trim().min(2),
  accountType: z.enum(['cash', 'credit_card', 'checking_account', 'savings_account']),
  currency: z.string().length(3),
})

export default function AccountFormScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>()
  const isEditing = Boolean(accountId)
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: financeApi.listAccounts, retry: false, enabled: isEditing })
  const account = (accountsQuery.data ?? []).map(normalizeAccount).find((item) => item.id === accountId)
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('cash')
  const [currency, setCurrency] = useState('PEN')
  const [openingBalance, setOpeningBalance] = useState('')
  const [initializedAccountId, setInitializedAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const accountTypes = [
    { value: 'cash' as const, label: t('accountTypes.cash'), icon: Wallet },
    { value: 'checking_account' as const, label: t('accountTypes.checkingAccount'), icon: Building2 },
    { value: 'savings_account' as const, label: t('accountTypes.savingsAccount'), icon: PiggyBank },
    { value: 'credit_card' as const, label: t('accountTypes.creditCard'), icon: CreditCard },
  ]

  useEffect(() => {
    if (!account || initializedAccountId === account.id) return
    setName(account.name)
    setAccountType(isAccountType(account.accountType) ? account.accountType : 'cash')
    setCurrency(account.currency)
    setInitializedAccountId(account.id)
  }, [account, initializedAccountId])

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null)
      const details = accountDetailsSchema.parse({ name, accountType, currency })
      if (accountId) return financeApi.updateAccount(accountId, details)
      const balance = z.number().finite().parse(Number(openingBalance || 0))
      return financeApi.createAccount({ ...details, openingBalance: balance })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ])
      toast.show(t(isEditing ? 'accounts.updatedToast' : 'accounts.createdToast'), {
        message: t(isEditing ? 'accounts.updatedMessage' : 'accounts.createdMessage'),
        preset: 'success',
        duration: 3500,
      })
      router.back()
    },
    onError: (error) => setErrorMessage(error instanceof ApiRequestError && error.code === 'account_name_exists' ? t('accounts.duplicateName') : error instanceof z.ZodError ? t('states.invalidForm') : error instanceof Error ? error.message : t('states.error')),
  })

  const isLoading = isEditing && accountsQuery.isLoading
  const notFound = isEditing && !accountsQuery.isLoading && !accountsQuery.error && !account

  return (
    <>
      <Stack.Screen options={{ title: t(isEditing ? 'accounts.editTitle' : 'accounts.newTitle') }} />
      <Screen>
        {isLoading ? <DataStateCard message={t('states.loading')} /> : null}
        {accountsQuery.error ? <DataStateCard message={accountsQuery.error instanceof Error ? accountsQuery.error.message : t('states.error')} /> : null}
        {notFound ? <DataStateCard message={t('states.accountNotFound')} /> : null}

        {!isLoading && !accountsQuery.error && !notFound ? (
          <YStack gap="$5" pb="$5">
            <FormField label={t('forms.name')}>
              <FintInput width="100%" placeholder={t('accounts.namePlaceholder')} value={name} onChangeText={setName} autoCapitalize="words" />
            </FormField>

            <FormField label={t('forms.accountType')}>
              <XStack width="100%" gap="$2" flexWrap="wrap">
                {accountTypes.map((option) => {
                  const isSelected = option.value === accountType
                  const Icon = option.icon
                  return (
                    <XStack
                      key={option.value}
                      width="48.5%"
                      minH={52}
                      items="center"
                      gap="$2"
                      px="$3"
                      py="$2"
                      rounded={14}
                      bg={isSelected ? '$primary' : '$muted'}
                      borderColor={isSelected ? '$primary' : '$input'}
                      borderWidth={1}
                      pressStyle={{ opacity: 0.8 }}
                      cursor="pointer"
                      role="button"
                      onPress={() => setAccountType(option.value)}
                      aria-label={option.label}
                    >
                      <Icon size={17} color={isSelected ? '$primaryForeground' : '$color10'} />
                      <Paragraph color={isSelected ? '$primaryForeground' : '$color12'} fontSize="$1" fontWeight="700" flex={1} numberOfLines={2}>{option.label}</Paragraph>
                    </XStack>
                  )
                })}
              </XStack>
            </FormField>

            {!isEditing ? (
              <FormField label={t('formLabels.openingBalanceOptional')}>
                <FintInput width="100%" placeholder="0.00" value={openingBalance} onChangeText={setOpeningBalance} keyboardType="decimal-pad" />
              </FormField>
            ) : null}

            <FormField label={t('forms.currency')}><FintSheetSelect width="100%" label={t('forms.currency')} showLabel={false} value={currency} options={currencyOptions} placeholder={t('forms.select')} searchable searchPlaceholder={t('accounts.searchCurrency')} onValueChange={setCurrency} /></FormField>

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}

            <FintButton
              width="100%"
              height={50}
              disabled={mutation.isPending}
              icon={mutation.isPending ? <Spinner size="small" color="$primaryForeground" /> : isEditing ? <Save size={18} /> : <Landmark size={18} />}
              onPress={() => mutation.mutate()}
            >
              {mutation.isPending ? t(isEditing ? 'accounts.updating' : 'accounts.creating') : t(isEditing ? 'accounts.update' : 'accounts.create')}
            </FintButton>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return <YStack width="100%" gap="$2"><Paragraph color="$color10" fontSize="$2" fontWeight="600">{label}</Paragraph>{children}</YStack>
}

function isAccountType(value?: string): value is AccountType {
  return value === 'cash' || value === 'credit_card' || value === 'checking_account' || value === 'savings_account'
}
