import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Coins, CreditCard, Landmark, PiggyBank, Save, Wallet } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, Spinner, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { ApiRequestError } from '../src/api/client'
import { financeApi } from '../src/api/finance'
import type { AccountType } from '../src/api/types'
import { DataStateCard } from '../src/components/DataStateCard'
import { FormTextField, MovementAmountField, MovementPickerTrigger } from '../src/components/MovementFormControls'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { currencyOptions } from '../src/finance/currencies'
import { getValidationMessage, parseDecimalInput, useSubmitValidation } from '../src/forms'
import { FintButton, FintCard, FintFormField, FintSheetSelect } from '../src/ui'

export default function AccountFormScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>()
  const isEditing = Boolean(accountId)
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useToastController()
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: ['accounts', 'detail', accountId], queryFn: ({ signal }) => financeApi.getAccount(accountId!, signal), retry: false, enabled: isEditing })
  const account = accountsQuery.data
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('cash')
  const [currency, setCurrency] = useState('PEN')
  const [openingBalance, setOpeningBalance] = useState('')
  const [initializedAccountId, setInitializedAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const validation = useSubmitValidation<'accountType' | 'currency' | 'name' | 'openingBalance'>()
  const requiredMessage = getValidationMessage(t, i18n.resolvedLanguage, 'required')
  const amountMessage = getValidationMessage(t, i18n.resolvedLanguage, 'amount')
  const accountDetailsSchema = z.object({
    name: z.string().trim().min(2, getValidationMessage(t, i18n.resolvedLanguage, 'minTwo')),
    accountType: z.enum(['cash', 'credit_card', 'checking_account', 'savings_account'], { error: requiredMessage }),
    currency: z.string().length(3, requiredMessage),
    openingBalance: z.number({ error: amountMessage }).finite(amountMessage),
  })
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
    mutationFn: async (payload: z.infer<typeof accountDetailsSchema>) => {
      const details = { name: payload.name, accountType: payload.accountType, currency: payload.currency }
      if (accountId) return financeApi.updateAccount(accountId, details)
      return financeApi.createAccount({ ...details, openingBalance: payload.openingBalance })
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
    onError: (error) => setErrorMessage(error instanceof ApiRequestError && error.code === 'account_name_exists' ? t('accounts.duplicateName') : error instanceof Error ? error.message : t('states.error')),
  })

  const submit = () => {
    setErrorMessage(null)
    const payload = validation.validate(accountDetailsSchema, {
      name,
      accountType,
      currency,
      openingBalance: openingBalance.trim() ? parseDecimalInput(openingBalance) : 0,
    })
    if (payload) mutation.mutate(payload)
  }

  const isLoading = isEditing && accountsQuery.isLoading
  const notFound = isEditing && !accountsQuery.isLoading && !accountsQuery.error && !account

  return (
    <>
      <Stack.Screen options={{ title: t(isEditing ? 'accounts.editTitle' : 'accounts.newTitle') }} />
      <Screen>
        {isLoading ? <SkeletonForm label={t('states.loading')} fieldCount={1} showAmount={false} showChoiceGrid showNote={false} /> : null}
        {accountsQuery.error ? <DataStateCard message={accountsQuery.error instanceof Error ? accountsQuery.error.message : t('states.error')} /> : null}
        {notFound ? <DataStateCard message={t('states.accountNotFound')} /> : null}

        {!isLoading && !accountsQuery.error && !notFound ? (
          <YStack gap="$5" pb="$5">
            <FormTextField label={t('forms.name')} required error={validation.errors.name} icon={<Landmark size={21} color="$primary" />} placeholder={t('accounts.namePlaceholder')} value={name} onChangeText={(value) => { setName(value); validation.clearError('name') }} autoCapitalize="words" />

            <FintFormField label={t('forms.accountType')} required error={validation.errors.accountType} showLabel={false}>
              <FintCard width="100%" gap="$3" p="$3" borderColor={validation.errors.accountType ? '$red8' : '$borderColor'}>
                <Paragraph color="$color10" fontSize="$1" fontWeight="600">{t('forms.accountType')} *</Paragraph>
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
                      bg={isSelected ? '$accent2' : '$muted'}
                      borderColor={isSelected ? '$primary' : '$input'}
                      borderWidth={1}
                      pressStyle={{ opacity: 0.8 }}
                      cursor="pointer"
                      role="button"
                      onPress={() => { setAccountType(option.value); validation.clearError('accountType') }}
                      aria-label={option.label}
                    >
                      <Icon size={17} color={isSelected ? '$primary' : '$color10'} />
                      <Paragraph color={isSelected ? '$primary' : '$color12'} fontSize="$1" fontWeight="700" flex={1} numberOfLines={2}>{option.label}</Paragraph>
                    </XStack>
                  )
                })}
                </XStack>
              </FintCard>
            </FintFormField>

            {!isEditing ? (
              <MovementAmountField label={t('formLabels.openingBalanceOptional')} required={false} currency={currency} error={validation.errors.openingBalance} value={openingBalance} onChangeText={(value) => { setOpeningBalance(value); validation.clearError('openingBalance') }} />
            ) : null}

            <FintFormField label={t('forms.currency')} required error={validation.errors.currency} showLabel={false}><FintSheetSelect label={t('forms.currency')} showLabel={false} value={currency} options={currencyOptions} placeholder={t('forms.select')} searchable searchPlaceholder={t('accounts.searchCurrency')} onValueChange={(value) => { setCurrency(value); validation.clearError('currency') }} renderTrigger={({ onPress, selectedLabel }) => <MovementPickerTrigger icon={<Coins size={21} color="$primary" />} invalid={Boolean(validation.errors.currency)} label={t('forms.currency')} required onPress={onPress} value={selectedLabel} />} /></FintFormField>

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}

            <YStack gap="$2">
              <FintButton width="100%" minH={52} disabled={mutation.isPending} icon={mutation.isPending ? <Spinner size="small" color="$primaryForeground" /> : isEditing ? <Save size={18} /> : <Landmark size={18} />} onPress={submit}>
                {mutation.isPending ? t(isEditing ? 'accounts.updating' : 'accounts.creating') : t(isEditing ? 'accounts.update' : 'accounts.create')}
              </FintButton>
              <FintButton width="100%" minH={48} variant="outlined" disabled={mutation.isPending} onPress={() => router.back()}>{t('actions.cancel')}</FintButton>
            </YStack>
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function isAccountType(value?: string): value is AccountType {
  return value === 'cash' || value === 'credit_card' || value === 'checking_account' || value === 'savings_account'
}
