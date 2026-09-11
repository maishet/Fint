import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Coins, CreditCard, Landmark, PiggyBank, Plus, Save, Trash2, Wallet, X } from '@tamagui/lucide-icons-2'
import { useNotify } from '../src/ui/notify'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui'
import { z } from 'zod'
import { ApiRequestError } from '../src/api/client'
import { useCapabilities } from '../src/api/capabilities'
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
import { useSensitiveMoney } from '../src/privacy/useSensitiveMoney'
import { FintButton, FintConfirmDialog, FintSheetSelect, FintSpinner } from '../src/ui'

export default function AccountFormScreen() {
  const { accountId } = useLocalSearchParams<{ accountId?: string }>()
  const isEditing = Boolean(accountId)
  const { i18n, t } = useTranslation()
  const router = useRouter()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const { capabilities } = useCapabilities()
  const accountsQuery = useQuery({ queryKey: ['accounts', 'detail', accountId], queryFn: ({ signal }) => financeApi.getAccount(accountId!, signal), enabled: isEditing })
  const account = accountsQuery.data
  const [name, setName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('cash')
  const [currency, setCurrency] = useState('PEN')
  const [openingBalance, setOpeningBalance] = useState('')
  const [initializedAccountId, setInitializedAccountId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [newBalanceCurrency, setNewBalanceCurrency] = useState('')
  const [newBalanceOpening, setNewBalanceOpening] = useState('')
  const [disableBalanceTarget, setDisableBalanceTarget] = useState<{ currency: string } | null>(null)
  const { formatSensitiveAmount } = useSensitiveMoney()
  const isDirty = !saved && (isEditing
    ? Boolean(account) && (name !== account!.name || accountType !== account!.accountType || currency !== account!.currency)
    : name !== '' || openingBalance !== '' || accountType !== 'cash' || currency !== 'PEN' || newBalanceCurrency !== '')
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
      if (accountId) return { ...(await financeApi.updateAccount(accountId, details)), secondCurrencyFailed: false }
      const created = await financeApi.createAccount({ ...details, openingBalance: payload.openingBalance })
      let secondCurrencyFailed = false
      if (payload.accountType === 'credit_card' && newBalanceCurrency) {
        try {
          await financeApi.enableAccountBalance(created.id, {
            currency: newBalanceCurrency,
            openingBalance: newBalanceOpening.trim() ? parseDecimalInput(newBalanceOpening) : 0,
          })
        } catch {
          secondCurrencyFailed = true
        }
      }
      return { ...created, secondCurrencyFailed }
    },
    onSuccess: async (result) => {
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
      if (result.secondCurrencyFailed) {
        toast.show(t('accounts.secondCurrencyFailedToast'), { message: t('accounts.secondCurrencyFailedMessage'), preset: 'error', duration: 4500 })
      }
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

  const invalidateBalances = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['accounts'] }),
    queryClient.invalidateQueries({ queryKey: ['account-options'] }),
    queryClient.invalidateQueries({ queryKey: ['summary'] }),
  ])

  const enableBalanceMutation = useMutation({
    mutationFn: (payload: { currency: string; openingBalance: number }) => financeApi.enableAccountBalance(accountId!, payload),
    onSuccess: async () => {
      await invalidateBalances()
      setNewBalanceCurrency('')
      setNewBalanceOpening('')
      toast.show(t('accounts.balanceEnabledToast'), { message: t('accounts.balanceEnabledMessage'), preset: 'success', duration: 3000 })
    },
    onError: (error) => toast.show(t('accounts.enableBalanceError'), {
      message: error instanceof ApiRequestError && error.code === 'balance_already_active' ? t('accounts.balanceAlreadyActive') : error instanceof Error ? error.message : t('states.error'),
      preset: 'error',
      duration: 4500,
    }),
  })

  const disableBalanceMutation = useMutation({
    mutationFn: (targetCurrency: string) => financeApi.disableAccountBalance(accountId!, targetCurrency),
    onSuccess: async () => {
      await invalidateBalances()
      setDisableBalanceTarget(null)
      toast.show(t('accounts.balanceDisabledToast'), { message: t('accounts.balanceDisabledMessage'), preset: 'success', duration: 3000 })
    },
    onError: (error) => {
      setDisableBalanceTarget(null)
      toast.show(t('accounts.disableBalanceError'), { message: error instanceof Error ? error.message : t('states.error'), preset: 'error', duration: 4500 })
    },
  })

  const activeBalanceCurrencies = new Set(isEditing ? (account?.balances ?? []).map((line) => line.currency) : [currency])
  const availableCurrencyOptions = currencyOptions.filter((option) => !activeBalanceCurrencies.has(option.value))
  const canManageBalances = accountType === 'credit_card' && (isEditing ? Boolean(account) : true)
  const canAddBalance = canManageBalances && capabilities.features.accountCurrencyBalances && activeBalanceCurrencies.size < 2

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

            <YStack gap="$2">
              <FintOptionGroup
                label={t('forms.accountType')}
                required
                error={validation.errors.accountType}
                options={accountTypes}
                value={accountType}
                onValueChange={(next) => { setAccountType(next); validation.clearError('accountType') }}
              />
            </YStack>

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

                {/* Segunda moneda al crear una tarjeta: el mismo disparador abre el sheet de
                    una vez -- sin un toque intermedio solo para revelar el selector. */}
                {!isEditing && canAddBalance ? (
                  <>
                    <FintSheetSelect
                      label={t('accounts.secondCurrencyLabel')}
                      showLabel={false}
                      value={newBalanceCurrency}
                      options={availableCurrencyOptions}
                      placeholder={t('forms.select')}
                      searchable
                      searchPlaceholder={t('accounts.searchCurrency')}
                      onValueChange={setNewBalanceCurrency}
                      renderTrigger={({ onPress, selectedLabel }) => (
                        newBalanceCurrency ? (
                          <FintListRow
                            icon={<Coins size={22} color="$primary" />}
                            label={t('accounts.secondCurrencyLabel')}
                            onPress={onPress}
                            value={selectedLabel}
                            trailing={
                              <Button
                                circular
                                chromeless
                                size="$2"
                                icon={<X size={16} color="$color8" />}
                                pressStyle={{ bg: '$color4' }}
                                onPress={() => { setNewBalanceCurrency(''); setNewBalanceOpening('') }}
                                aria-label={t('actions.cancel')}
                              />
                            }
                          />
                        ) : (
                          <FintListRow icon={<Plus size={22} color="$primary" />} label={t('accounts.addSecondCurrencyAtCreation')} onPress={onPress} />
                        )
                      )}
                    />
                    {newBalanceCurrency ? (
                      <FintListRow
                        icon={<Wallet size={22} color="$primary" />}
                        label={t('forms.openingBalance')}
                        valueSlot={
                          <XStack items="center" gap="$2">
                            <Paragraph color="$color10" fontSize="$2" fontWeight="600">{getCurrencySymbol(newBalanceCurrency)}</Paragraph>
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
                              value={newBalanceOpening}
                              onChangeText={(value) => setNewBalanceOpening(sanitizeAmountInput(value))}
                              aria-label={t('forms.openingBalance')}
                            />
                          </XStack>
                        }
                      />
                    ) : null}
                  </>
                ) : null}
              </FintListGroup>
              {validation.errors.currency ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.currency}</Paragraph> : null}
              {validation.errors.openingBalance ? <Paragraph color="$red10" fontSize="$1" fontWeight="600" px="$1">{validation.errors.openingBalance}</Paragraph> : null}
              {!isEditing ? <FintListFootnote>{t('accounts.openingBalanceHint')}</FintListFootnote> : null}
            </YStack>

            {/*
              Cada moneda lleva su propio saldo independiente -- Fint no las convierte
              ni las suma. Solo aplica a tarjetas de crédito ya creadas: el resto de
              tipos de cuenta se queda mono-moneda siempre, como en un banco real.
            */}
            {isEditing && account && canManageBalances ? (
              <YStack gap="$2">
                <FintListGroup>
                  {(account.balances ?? [{ currency: account.currency, balance: account.balance }]).map((line) => {
                    const isPrimary = line.currency === account.currency
                    return (
                      <FintListRow
                        key={line.currency}
                        icon={<Coins size={22} color="$primary" />}
                        label={isPrimary ? t('accounts.primaryBalanceBadge') : line.currency}
                        value={formatSensitiveAmount(line.balance, line.currency)}
                        trailing={isPrimary ? undefined : (
                          <Button
                            circular
                            chromeless
                            size="$2"
                            disabled={disableBalanceMutation.isPending}
                            icon={<Trash2 size={18} color="$color8" />}
                            pressStyle={{ bg: '$color4' }}
                            onPress={() => setDisableBalanceTarget({ currency: line.currency })}
                            aria-label={t('accounts.disableBalanceAccessibility', { currency: line.currency })}
                          />
                        )}
                      />
                    )
                  })}
                  {/* Habilitar una moneda nueva es la única acción con capability -- leer y
                      desactivar saldos existentes nunca se gatean (fase 5, salida gradual).
                      También se oculta al llegar a 2 monedas activas: el máximo por tarjeta. */}
                  {canAddBalance ? (
                    <>
                      <FintSheetSelect
                        label={t('accounts.secondCurrencyLabel')}
                        showLabel={false}
                        value={newBalanceCurrency}
                        options={availableCurrencyOptions}
                        placeholder={t('forms.select')}
                        searchable
                        searchPlaceholder={t('accounts.searchCurrency')}
                        onValueChange={setNewBalanceCurrency}
                        renderTrigger={({ onPress, selectedLabel }) => (
                          newBalanceCurrency ? (
                            <FintListRow
                              icon={<Coins size={22} color="$primary" />}
                              label={t('accounts.secondCurrencyLabel')}
                              onPress={onPress}
                              value={selectedLabel}
                              trailing={
                                <Button
                                  circular
                                  chromeless
                                  size="$2"
                                  disabled={enableBalanceMutation.isPending}
                                  icon={<X size={16} color="$color8" />}
                                  pressStyle={{ bg: '$color4' }}
                                  onPress={() => { setNewBalanceCurrency(''); setNewBalanceOpening('') }}
                                  aria-label={t('actions.cancel')}
                                />
                              }
                            />
                          ) : (
                            <FintListRow icon={<Plus size={22} color="$primary" />} label={t('accounts.addBalance')} onPress={onPress} />
                          )
                        )}
                      />
                      {newBalanceCurrency ? (
                        <>
                          <FintListRow
                            icon={<Wallet size={22} color="$primary" />}
                            label={t('forms.openingBalance')}
                            valueSlot={
                              <XStack items="center" gap="$2">
                                <Paragraph color="$color10" fontSize="$2" fontWeight="600">{getCurrencySymbol(newBalanceCurrency)}</Paragraph>
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
                                  value={newBalanceOpening}
                                  onChangeText={(value) => setNewBalanceOpening(sanitizeAmountInput(value))}
                                  aria-label={t('forms.openingBalance')}
                                />
                              </XStack>
                            }
                          />
                          <XStack p="$3">
                            <FintButton
                              flex={1}
                              disabled={!newBalanceCurrency || enableBalanceMutation.isPending}
                              icon={enableBalanceMutation.isPending ? <FintSpinner size="small" color="$primaryForeground" /> : undefined}
                              onPress={() => enableBalanceMutation.mutate({ currency: newBalanceCurrency, openingBalance: newBalanceOpening.trim() ? parseDecimalInput(newBalanceOpening) : 0 })}
                            >
                              {enableBalanceMutation.isPending ? t('accounts.enablingBalance') : t('accounts.enableBalanceAction')}
                            </FintButton>
                          </XStack>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </FintListGroup>
                <FintListFootnote>
                  {!capabilities.features.accountCurrencyBalances && activeBalanceCurrencies.size < 2
                    ? t('accounts.balancesDisabledHint')
                    : activeBalanceCurrencies.size >= 2
                      ? t('accounts.balancesMaxReachedHint')
                      : t('accounts.balancesHint')}
                </FintListFootnote>
              </YStack>
            ) : null}

            {errorMessage ? <XStack bg="$red2" borderColor="$red6" borderWidth={1} rounded="$5" p="$3"><Paragraph color="$red11" fontSize="$2">{errorMessage}</Paragraph></XStack> : null}
          </YStack>
        ) : null}
      </Screen>
      <FintConfirmDialog
        open={Boolean(disableBalanceTarget)}
        isPending={disableBalanceMutation.isPending}
        title={t('accounts.disableBalanceTitle')}
        description={t('accounts.disableBalanceDescription', { currency: disableBalanceTarget?.currency ?? '' })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('accounts.disableBalanceConfirm')}
        pendingLabel={t('accounts.disablingBalance')}
        destructive
        icon={<Trash2 size={17} color="$primaryForeground" />}
        onCancel={() => setDisableBalanceTarget(null)}
        onConfirm={() => disableBalanceMutation.mutate(disableBalanceTarget!.currency)}
      />
    </>
  )
}

function isAccountType(value?: string): value is AccountType {
  return value === 'cash' || value === 'credit_card' || value === 'checking_account' || value === 'savings_account'
}
