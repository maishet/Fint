import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Coins, CreditCard, Landmark, PiggyBank, Save, Wallet } from '@tamagui/lucide-icons-2'
import { useNotify } from '../src/ui/notify'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input, Paragraph, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { ApiRequestError } from '../src/api/client'
import { financeApi } from '../src/api/finance'
import type { AccountType } from '../src/api/types'
import { DataStateCard } from '../src/components/DataStateCard'
import { FintOptionGroup } from '../src/components/FintOptionGroup'
import { FintListFootnote, FintListGroup, FintListRow } from '../src/components/FintListGroup'
import { Screen } from '../src/components/Screen'
import { SkeletonForm } from '../src/components/Skeleton'
import { currencyOptions, getCurrencySymbol } from '../src/finance/currencies'
import { getValidationMessage, parseDecimalInput, sanitizeAmountInput, useSubmitValidation } from '../src/forms'
import { useUnsavedChangesGuard } from '../src/hooks/useUnsavedChangesGuard'
import { UnsavedChangesDialog } from '../src/components/UnsavedChangesDialog'
import { FintButton, FintSheetSelect, FintSpinner } from '../src/ui'

export default function AccountFormScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>()
  const isEditing = Boolean(accountId)
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const accountsQuery = useQuery({ queryKey: ['accounts', 'detail', accountId], queryFn: ({ signal }) => financeApi.getAccount(accountId!, signal), enabled: isEditing })
  const account = accountsQuery.data
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('cash')
  const [currency, setCurrency] = useState('PEN')
  const [openingBalance, setOpeningBalance] = useState('')
  const [initializedAccountId, setInitializedAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const isDirty = !saved && (isEditing
    ? Boolean(account) && (name !== account!.name || accountType !== account!.accountType || currency !== account!.currency)
    : name !== '' || openingBalance !== '' || accountType !== 'cash' || currency !== 'PEN')
  const guard = useUnsavedChangesGuard(isDirty)
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
      setSaved(true)
      guard.bypass(() => router.back())
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
      <UnsavedChangesDialog open={guard.open} onCancel={guard.onCancel} onConfirm={guard.onConfirm} />
      <Stack.Screen options={{ title: t(isEditing ? 'accounts.editTitle' : 'accounts.newTitle') }} />
      <Screen
        footer={!isLoading && !accountsQuery.error && !notFound ? (
          <FintButton width="100%" minH={52} disabled={mutation.isPending} icon={mutation.isPending ? <FintSpinner size="small" color="$primaryForeground" /> : isEditing ? <Save size={18} /> : <Landmark size={18} />} onPress={submit}>
            {mutation.isPending ? t(isEditing ? 'accounts.updating' : 'accounts.creating') : t(isEditing ? 'accounts.update' : 'accounts.create')}
          </FintButton>
        ) : undefined}
      >
        {isLoading ? <SkeletonForm label={t('states.loading')} fieldCount={1} showAmount={false} showChoiceGrid showNote={false} /> : null}
        {accountsQuery.error ? <DataStateCard message={accountsQuery.error instanceof Error ? accountsQuery.error.message : t('states.error')} /> : null}
        {notFound ? <DataStateCard message={t('states.accountNotFound')} /> : null}

        {!isLoading && !accountsQuery.error && !notFound ? (
          <YStack gap="$5" pb="$5">
            <YStack gap="$2">
              <FintListGroup invalid={Boolean(validation.errors.name)}>
                <FintListRow
                  icon={<Landmark size={22} color="$primary" />}
                  label={t('forms.name')}
                  required
                  valueSlot={
                    <Input
                      unstyled
                      width="100%"
                      height={22}
                      minH={22}
                      p={0}
                      m={0}
                      color="$color12"
                      fontFamily="$body"
                      fontSize="$3"
                      fontWeight="600"
                      placeholder={t('accounts.namePlaceholder')}
                      placeholderTextColor="$color10"
                      value={name}
                      onChangeText={(value) => { setName(value); validation.clearError('name') }}
                      onBlur={() => validation.validateField('name', accountDetailsSchema.shape.name, name)}
                      autoCapitalize="words"
                      aria-label={t('forms.name')}
                    />
                  }
                />
              </FintListGroup>
              {validation.errors.name ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.name}</Paragraph> : null}
            </YStack>

            <FintOptionGroup
              label={t('forms.accountType')}
              required
              error={validation.errors.accountType}
              options={accountTypes}
              value={accountType}
              onValueChange={(next) => { setAccountType(next); validation.clearError('accountType') }}
            />

            {/*
              El saldo inicial es opcional: no merece el campo grande del monto,
              y va junto a la moneda porque se leen a la vez.
            */}
            <YStack gap="$2">
              <FintListGroup invalid={Boolean(validation.errors.currency || validation.errors.openingBalance)}>
                <FintSheetSelect label={t('forms.currency')} showLabel={false} value={currency} options={currencyOptions} placeholder={t('forms.select')} searchable searchPlaceholder={t('accounts.searchCurrency')} onValueChange={(value) => { setCurrency(value); validation.clearError('currency') }} renderTrigger={({ onPress, selectedLabel }) => <FintListRow icon={<Coins size={22} color="$primary" />} label={t('forms.currency')} required onPress={onPress} value={selectedLabel} />} />

                {!isEditing ? (
                  <FintListRow
                    icon={<Wallet size={22} color="$primary" />}
                    label={t('forms.openingBalance')}
                    valueSlot={
                      <XStack items="center" gap="$2">
                        <Paragraph color="$color10" fontSize="$2" fontWeight="600">{getCurrencySymbol(currency)}</Paragraph>
                        <Input
                          unstyled
                          flex={1}
                          minW={0}
                          height={22}
                          minH={22}
                          p={0}
                          m={0}
                          color="$color12"
                          fontFamily="$body"
                          fontSize="$3"
                          fontWeight="600"
                          keyboardType="decimal-pad"
                          placeholder="0.00"
                          placeholderTextColor="$color10"
                          value={openingBalance}
                          onChangeText={(value) => { setOpeningBalance(sanitizeAmountInput(value)); validation.clearError('openingBalance') }}
                          onBlur={() => { if (openingBalance.trim()) validation.validateField('openingBalance', accountDetailsSchema.shape.openingBalance, parseDecimalInput(openingBalance)) }}
                          aria-label={t('forms.openingBalance')}
                        />
                      </XStack>
                    }
                  />
                ) : null}
              </FintListGroup>
              {validation.errors.currency ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.currency}</Paragraph> : null}
              {validation.errors.openingBalance ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.openingBalance}</Paragraph> : null}
              {!isEditing ? <FintListFootnote>{t('accounts.openingBalanceHint')}</FintListFootnote> : null}
            </YStack>

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
          </YStack>
        ) : null}
      </Screen>
    </>
  )
}

function isAccountType(value?: string): value is AccountType {
  return value === 'cash' || value === 'credit_card' || value === 'checking_account' || value === 'savings_account'
}
