import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, ChartNoAxesCombined, CheckCircle2, ChevronRight, Landmark, Sparkles } from '@tamagui/lucide-icons-2'
import { Link } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWindowDimensions } from 'react-native'
import { PieChart } from 'react-native-gifted-charts'
import { Button, H3, Paragraph, ScrollView, Spinner, useTheme, XStack, YStack } from 'tamagui'
import { financeApi } from '../../src/api/finance'
import {
  formatMoney,
  normalizeTransaction,
  normalizeSummary,
} from '../../src/api/mappers'
import type { Transaction } from '../../src/api/types'
import { Screen } from '../../src/components/Screen'
import { getCategoryLabel } from '../../src/finance/categoryLabels'
import { useThemeMode } from '../../src/theme/ThemeMode'
import { getAppLocale } from '../../src/i18n'
import { FintButton, FintCard } from '../../src/ui'

const ALL_ACCOUNTS = '__all__'

interface CategorySlice {
  name: string
  amount: number
  color: string
}

interface WeeklyFlowPoint {
  label: string
  income: number
  expenses: number
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation()
  const theme = useTheme()
  const queryClient = useQueryClient()
  const dashboardRange = getDashboardTransactionRange()
  const summaryQuery = useQuery({ queryKey: ['summary'], queryFn: financeApi.getSummary, retry: false })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: financeApi.listAccounts, retry: false })
  const transactionsQuery = useQuery({
    queryKey: ['transactions', 'dashboard', dashboardRange.from, dashboardRange.to],
    queryFn: () => financeApi.listTransactions({ ...dashboardRange, limit: 200 }),
    retry: false,
  })

  const summary = normalizeSummary(summaryQuery.data)
  const transactions = (transactionsQuery.data ?? []).map(normalizeTransaction)
  const recentTransactions = transactions.slice(0, 4)
  const locale = getAppLocale(i18n.resolvedLanguage)
  const monthlyTransactions = transactions.filter((transaction) => isTransactionInMonth(transaction, summary.month, summary.year))
  const categoryColors = [
    theme.chart1.val,
    theme.chart2.val,
    theme.chart3.val,
    theme.chart4.val,
    theme.chart5.val,
  ]
  const expenseAccountViews = [
    { key: ALL_ACCOUNTS, label: t('dashboard.allAccounts'), slices: getExpenseCategorySlices(monthlyTransactions, categoryColors, t) },
    ...(accountsQuery.data ?? []).map((account) => ({
      key: account.id,
      label: account.name,
      slices: getExpenseCategorySlices(monthlyTransactions.filter((transaction) => transaction.account === account.name), categoryColors, t),
    })),
  ]
  const weeklyFlow = getWeeklyFlow(transactions, locale)
  const isLoading = summaryQuery.isLoading || transactionsQuery.isLoading
  const isRefreshing = summaryQuery.isRefetching || transactionsQuery.isRefetching
  const error = summaryQuery.error ?? transactionsQuery.error

  return (
    <Screen
      isRefreshing={isRefreshing}
      onRefresh={() => {
        queryClient.invalidateQueries({ queryKey: ['summary'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }}
    >
      {isLoading ? <LoadingCard message={t('dashboard.loading')} /> : null}
      {error ? <ErrorCard title={t('dashboard.errorTitle')} message={error instanceof Error ? error.message : t('dashboard.errorTitle')} /> : null}

      {!isLoading && !error ? (
        <>
          <HeroSummary
            currency={summary.currency}
            expenses={summary.expenses}
            income={summary.income}
            netWorth={summary.netWorth}
          />

          {summary.accountCount === 0 || transactions.length === 0 ? (
            <GettingStartedCard accountCount={summary.accountCount} currency={summary.currency} hasMovements={transactions.length > 0} />
          ) : null}

          <QuickActions />

          <WeeklyFlowSection currency={summary.currency} data={weeklyFlow} />

          <ExpenseCategoryCard
            currency={summary.currency}
            views={expenseAccountViews}
          />

          <AdviceCarousel
            currency={summary.currency}
            expenses={summary.expenses}
            income={summary.income}
            month={summary.month}
            savings={summary.savings}
            transactions={transactions}
            year={summary.year}
          />

          <RecentMovements locale={locale} transactions={recentTransactions} />
        </>
      ) : null}
    </Screen>
  )
}

function GettingStartedCard({ accountCount, currency, hasMovements }: { accountCount: number; currency: string; hasMovements: boolean }) {
  const { t } = useTranslation()
  const needsAccount = accountCount === 0
  return (
    <FintCard bg="$secondary" borderColor="$ring" gap="$4">
      <XStack items="center" gap="$3">
        <YStack width={42} height={42} rounded="$9" bg="$primary" items="center" justify="center"><Sparkles size={21} color="$primaryForeground" /></YStack>
        <YStack flex={1} minW={0} gap="$1">
          <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700">{t('onboarding.title')}</Paragraph>
          <Paragraph color="$color10" fontSize="$2">{t('onboarding.baseCurrency', { currency })}</Paragraph>
        </YStack>
      </XStack>
      <YStack gap="$2">
        <OnboardingStep complete={!needsAccount} label={t('onboarding.firstAccount')} number="1" />
        <OnboardingStep complete={hasMovements} label={t('onboarding.firstMovement')} number="2" />
      </YStack>
      <Link href={needsAccount ? '/account-form' : '/transaction-form'} asChild>
        <FintButton>{t(needsAccount ? 'onboarding.createAccount' : 'onboarding.createMovement')}</FintButton>
      </Link>
    </FintCard>
  )
}

function OnboardingStep({ complete, label, number }: { complete: boolean; label: string; number: string }) {
  return (
    <XStack items="center" gap="$2">
      <YStack width={26} height={26} rounded="$10" bg={complete ? '$green3' : '$muted'} items="center" justify="center">
        {complete ? <CheckCircle2 size={16} color="$green10" /> : <Paragraph color="$color10" fontSize="$1" fontWeight="800">{number}</Paragraph>}
      </YStack>
      <Paragraph color={complete ? '$color10' : '$color12'} fontWeight={complete ? '500' : '700'}>{label}</Paragraph>
    </XStack>
  )
}

function HeroSummary({ currency, expenses, income, netWorth }: { currency: string; expenses: number; income: number; netWorth: number }) {
  const { t } = useTranslation()
  const { themeMode } = useThemeMode()
  const isDark = themeMode === 'dark'
  const backgroundColor = isDark ? '#0B3046' : '#0F5D73'
  const borderColor = isDark ? '#1B5067' : '#28788C'
  const primaryText = '#F4FBFD'
  const secondaryText = '#B9D7E1'
  return (
    <FintCard bg={backgroundColor} borderColor={borderColor} gap="$4" p="$4">
      <XStack items="center" justify="space-between" gap="$3">
        <YStack gap="$1" flex={1}>
          <Paragraph color={secondaryText} fontFamily="$heading" fontSize="$2" fontWeight="700" textTransform="uppercase">{t('dashboard.netWorth')}</Paragraph>
          <Paragraph color={primaryText} fontFamily="$body" fontSize="$9" fontWeight="800" lineHeight="$9" numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(netWorth, currency)}
          </Paragraph>
        </YStack>
        <YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" borderColor="rgba(93,214,229,0.24)" borderWidth={1} items="center" justify="center">
          <Landmark size={24} color="#5DD6E5" />
        </YStack>
      </XStack>

      <XStack gap="$4">
        <HeroMetric accent="#5DD6E5" label={t('dashboard.monthlyIncome')} labelColor={secondaryText} textColor={primaryText} value={formatMoney(income, currency)} />
        <HeroMetric accent="#82B8D0" label={t('dashboard.monthlyExpenses')} labelColor={secondaryText} textColor={primaryText} value={formatMoney(expenses, currency)} />
      </XStack>
    </FintCard>
  )
}

function HeroMetric({ accent, label, labelColor, textColor, value }: { accent: string; label: string; labelColor: string; textColor: string; value: string }) {
  return (
    <YStack flex={1} gap="$1" minW={0}>
      <YStack height={4} rounded="$10" bg={accent as never} />
      <Paragraph color={labelColor as never} fontFamily="$body" fontSize="$1">{label}</Paragraph>
      <Paragraph color={textColor as never} fontFamily="$body" fontSize="$3" fontWeight="800" numberOfLines={1}>{value}</Paragraph>
    </YStack>
  )
}

function QuickActions() {
  const { t } = useTranslation()

  return (
    <XStack gap="$3">
      <Link href={{ pathname: '/transaction-form', params: { type: 'income' } }} asChild>
        <FintButton
          flex={1}
          height={44}
          icon={<ArrowDownLeft size={16} color="$primaryForeground" />}
        >
          {t('actions.newIncome')}
        </FintButton>
      </Link>
      <Link href={{ pathname: '/transaction-form', params: { type: 'expense' } }} asChild>
        <FintButton
          flex={1}
          height={44}
          variant="outlined"
          bg="$card"
          borderColor="$primary"
          color="$primary"
          hoverStyle={{ bg: '$secondary' }}
          pressStyle={{ bg: '$accent2' }}
          icon={<ArrowUpRight size={16} color="$primary" />}
        >
          {t('actions.newExpense')}
        </FintButton>
      </Link>
    </XStack>
  )
}

function WeeklyFlowSection({ currency, data }: { currency: string; data: WeeklyFlowPoint[] }) {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, data.length - 1))
  const chartHeight = 94
  const totalIncome = data.reduce((sum, point) => sum + point.income, 0)
  const totalExpenses = data.reduce((sum, point) => sum + point.expenses, 0)
  const isPositive = totalIncome >= totalExpenses
  const maximum = Math.max(1, ...data.flatMap((point) => [point.income, point.expenses]))
  const selectedPoint = data[Math.min(selectedIndex, Math.max(0, data.length - 1))]
  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$3">
        <H3 color="$color12" fontFamily="$heading" size="$6">{t('dashboard.weeklyFlow')}</H3>
        <YStack bg={isPositive ? '$green3' : '$red3'} px="$3" py="$1" rounded="$10">
          <Paragraph color={isPositive ? '$green11' : '$red11'} fontSize="$1" fontWeight="800">
            {isPositive ? t('dashboard.positive') : t('dashboard.negative')}
          </Paragraph>
        </YStack>
      </XStack>

      <FintCard gap="$3" p="$3">
        <XStack gap="$4">
          <LegendDot color="$green9" label={t('dashboard.income')} />
          <LegendDot color="$red9" label={t('dashboard.expenses')} />
        </XStack>
        {selectedPoint ? (
          <XStack bg="$secondary" rounded="$5" p="$3" items="center" justify="space-between" gap="$3">
            <YStack flex={1} minW={0}>
              <Paragraph color="$color12" fontWeight="800">{selectedPoint.label}</Paragraph>
              <Paragraph color="$color9" fontSize="$1">{t('dashboard.tapWeek')}</Paragraph>
            </YStack>
            <YStack items="flex-end">
              <Paragraph color="$green11" fontSize="$1" fontWeight="800">+{formatMoney(selectedPoint.income, currency)}</Paragraph>
              <Paragraph color="$red11" fontSize="$1" fontWeight="800">-{formatMoney(selectedPoint.expenses, currency)}</Paragraph>
            </YStack>
          </XStack>
        ) : null}
        <XStack height={136} items="flex-end" gap="$2">
          {data.map((point, index) => {
            const isSelected = index === selectedIndex
            return (
            <YStack
              key={point.label}
              flex={1}
              height="100%"
              items="center"
              justify="flex-end"
              gap="$2"
              px="$1"
              py="$2"
              rounded="$4"
              bg={isSelected ? '$secondary' : 'transparent'}
              pressStyle={{ bg: '$secondary' }}
              onPress={() => setSelectedIndex(index)}
              role="button"
              aria-label={t('dashboard.weekAccessibility', { week: point.label, income: formatMoney(point.income, currency), expenses: formatMoney(point.expenses, currency) })}
            >
              <XStack height={chartHeight} items="flex-end" gap={4}>
                <YStack transition="200ms" width={12} height={point.income > 0 ? Math.max(3, Math.round((point.income / maximum) * chartHeight)) : 0} bg="$green9" rounded="$2" opacity={isSelected ? 1 : 0.76} />
                <YStack transition="200ms" width={12} height={point.expenses > 0 ? Math.max(3, Math.round((point.expenses / maximum) * chartHeight)) : 0} bg="$red9" rounded="$2" opacity={isSelected ? 1 : 0.76} />
              </XStack>
              <Paragraph color={isSelected ? '$color12' : '$color10'} fontSize={9} fontWeight={isSelected ? '800' : '500'} numberOfLines={1}>{point.label}</Paragraph>
            </YStack>
          )})}
        </XStack>
        <XStack borderTopColor="$borderColor" borderTopWidth={1} pt="$3" justify="space-between" gap="$3">
          <FlowTotal color="$green11" label={t('dashboard.totalIncome')} value={formatMoney(totalIncome, currency)} />
          <FlowTotal align="right" color="$red11" label={t('dashboard.totalExpenses')} value={formatMoney(totalExpenses, currency)} />
        </XStack>
      </FintCard>
    </YStack>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <XStack items="center" gap="$2">
      <YStack width={9} height={9} rounded="$10" bg={color as never} />
      <Paragraph color="$color10" fontSize="$1">{label}</Paragraph>
    </XStack>
  )
}

function FlowTotal({ align = 'left', color, label, value }: { align?: 'left' | 'right'; color: string; label: string; value: string }) {
  return (
    <YStack flex={1} items={align === 'right' ? 'flex-end' : 'flex-start'}>
      <Paragraph color={color as never} fontSize="$2" fontWeight="800">{value}</Paragraph>
      <Paragraph color="$color10" fontSize="$1">{label}</Paragraph>
    </YStack>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <H3 color="$color12" fontFamily="$heading" size="$6">{children}</H3>
}

function AdviceCarousel({ currency, expenses, income, month, savings, transactions, year }: { currency: string; expenses: number; income: number; month: number; savings: number; transactions: Transaction[]; year: number }) {
  const { t } = useTranslation()
  const previousMonth = month === 1 ? 12 : month - 1
  const previousYear = month === 1 ? year - 1 : year
  const previous = getMonthTotals(transactions, previousMonth, previousYear)
  const expenseChange = calculatePercentChange(expenses, previous.expenses)
  const previousSavings = previous.income - previous.expenses
  const savingsChange = calculatePercentChange(savings, previousSavings)
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0
  const insights = [
    {
      icon: expenseChange !== null && expenseChange > 0 ? 'up' : 'down',
      title: expenseChange === null ? t('dashboard.expensesSnapshot') : expenseChange > 0 ? t('dashboard.expensesIncreasing') : t('dashboard.expensesControlled'),
      subtitle: t('dashboard.comparedPreviousMonth'),
      value: expenseChange === null ? formatMoney(expenses, currency) : `${Math.abs(expenseChange)}%`,
      trend: expenseChange === null ? t('dashboard.noPreviousData') : `${expenseChange > 0 ? '+' : ''}${expenseChange}% ${t('dashboard.vsPreviousMonth')}`,
      tone: expenseChange !== null && expenseChange > 0 ? 'negative' : 'positive',
    },
    {
      icon: 'savings',
      title: savings >= 0 ? t('dashboard.savingsGrowing') : t('dashboard.savingsNeedsAttention'),
      subtitle: t('dashboard.currentSavingsRate'),
      value: `${savingsRate}%`,
      trend: savingsChange === null ? t('dashboard.noPreviousData') : `${savingsChange > 0 ? '+' : ''}${savingsChange}% ${t('dashboard.vsPreviousMonth')}`,
      tone: savings >= 0 ? 'positive' : 'negative',
    },
    {
      icon: 'balance',
      title: t('dashboard.monthlyBalance'),
      subtitle: t('dashboard.incomeMinusExpenses'),
      value: formatMoney(savings, currency),
      trend: savings >= 0 ? t('dashboard.positiveFlow') : t('dashboard.negativeFlow'),
      tone: savings >= 0 ? 'positive' : 'negative',
    },
  ] as const

  return (
    <YStack gap="$3">
      <SectionTitle>{t('dashboard.recommendations')}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {insights.map((insight) => (
          <InsightCard key={insight.title} {...insight} />
        ))}
      </ScrollView>
    </YStack>
  )
}

function InsightCard({ icon, subtitle, title, tone, trend, value }: { icon: 'up' | 'down' | 'savings' | 'balance'; subtitle: string; title: string; tone: 'positive' | 'negative'; trend: string; value: string }) {
  const toneBackground = tone === 'positive' ? '$green2' : '$red2'
  const toneColor = tone === 'positive' ? '$green11' : '$red11'
  const Icon = icon === 'savings' ? Landmark : icon === 'balance' ? ChartNoAxesCombined : icon === 'up' ? ArrowUpRight : ArrowDownLeft

  return (
    <FintCard width={248} height={148} gap="$2" p="$3" justify="space-between">
      <XStack items="flex-start" justify="space-between" gap="$3">
        <YStack width={32} height={32} rounded="$7" bg={toneBackground} items="center" justify="center">
          <Icon size={17} color={toneColor} />
        </YStack>
        <YStack bg={toneBackground} px="$2" py="$1" rounded="$10">
          <Paragraph color={toneColor} fontSize={9} fontWeight="800" maxW={145} numberOfLines={1}>{trend}</Paragraph>
        </YStack>
      </XStack>
      <YStack gap="$1">
        <Paragraph color="$color12" fontFamily="$heading" fontSize="$3" fontWeight="700" numberOfLines={1}>{title}</Paragraph>
        <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>{subtitle}</Paragraph>
      </YStack>
      <Paragraph color={toneColor} fontFamily="$body" fontSize="$6" fontWeight="800" lineHeight="$6" numberOfLines={1}>{value}</Paragraph>
    </FintCard>
  )
}

function ExpenseCategoryCard({ currency, views }: { currency: string; views: { key: string; label: string; slices: CategorySlice[] }[] }) {
  const { t } = useTranslation()
  const { width } = useWindowDimensions()
  const slideWidth = Math.min(width - 64, 520)
  const [currentView, setCurrentView] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => setSelectedIndex(0), [currentView])

  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$3">
        <SectionTitle>{t('dashboard.spendingByCategory')}</SectionTitle>
        <Paragraph color="$color10" fontSize="$1">{t('dashboard.currentMonth')}</Paragraph>
      </XStack>
      <FintCard p="$3" gap="$3" overflow="hidden">
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={slideWidth}
          decelerationRate="fast"
          onMomentumScrollEnd={(event) => setCurrentView(Math.min(views.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / slideWidth))))}
        >
          {views.map((view, viewIndex) => {
            const viewTotal = view.slices.reduce((sum, slice) => sum + slice.amount, 0)
            const viewSelectedIndex = viewIndex === currentView ? Math.min(selectedIndex, Math.max(0, view.slices.length - 1)) : 0
            return (
              <YStack key={view.key} width={slideWidth} pr="$3" gap="$3">
                <XStack items="center" justify="space-between" gap="$2">
                  <YStack gap="$1" flex={1} minW={0}>
                    <Paragraph color="$color10" fontSize="$1">{t('forms.account')}</Paragraph>
                    <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700" numberOfLines={1}>{view.label}</Paragraph>
                  </YStack>
                  <Paragraph color="$color10" fontSize="$1">{viewIndex + 1}/{views.length}</Paragraph>
                </XStack>
                {view.slices.length === 0 ? (
                  <YStack minH={150} items="center" justify="center" px="$4">
                    <Paragraph color="$color10" text="center">{t('dashboard.emptyCategoriesForAccount')}</Paragraph>
                  </YStack>
                ) : (
                  <XStack items="center" gap="$4">
                    <DonutChart onSelect={setSelectedIndex} selectedIndex={viewSelectedIndex} slices={view.slices} total={viewTotal} />
                    <YStack flex={1} gap="$2">
                      {view.slices.map((slice, index) => {
                        const isSelected = viewIndex === currentView && index === viewSelectedIndex
                        return (
                          <XStack
                            key={slice.name}
                            transition="quick"
                            animateOnly={['backgroundColor', 'borderColor', 'opacity']}
                            items="center"
                            justify="space-between"
                            gap="$2"
                            px="$2"
                            py="$1"
                            rounded="$4"
                            bg={isSelected ? '$secondary' : 'transparent'}
                            borderColor={isSelected ? '$primary' : 'transparent'}
                            borderWidth={1}
                            pressStyle={{ opacity: 0.75 }}
                            cursor="pointer"
                            role="button"
                            onPress={() => setSelectedIndex(index)}
                            aria-label={t('dashboard.categoryAccessibility', { category: slice.name, amount: formatMoney(slice.amount, currency) })}
                          >
                            <XStack items="center" gap="$2" flex={1} minW={0}>
                              <YStack width={9} height={9} rounded="$10" bg={slice.color as never} />
                              <Paragraph color={isSelected ? '$color12' : '$color10'} fontSize="$2" fontWeight={isSelected ? '700' : '500'} numberOfLines={1}>{slice.name}</Paragraph>
                            </XStack>
                            <Paragraph color="$color12" fontSize="$2" fontWeight="800">{formatMoney(slice.amount, currency)}</Paragraph>
                          </XStack>
                        )
                      })}
                    </YStack>
                  </XStack>
                )}
              </YStack>
            )
          })}
        </ScrollView>
        <XStack items="center" justify="center" gap="$1">
          {views.map((view, index) => <YStack key={view.key} width={index === currentView ? 18 : 6} height={6} rounded="$10" bg={index === currentView ? '$primary' : '$borderColor'} />)}
        </XStack>
      </FintCard>
    </YStack>
  )
}

function DonutChart({ onSelect, selectedIndex, slices, total }: { onSelect: (index: number) => void; selectedIndex: number; slices: CategorySlice[]; total: number }) {
  const selectedSlice = slices[selectedIndex]
  const selectedPercent = total > 0 && selectedSlice ? Math.round((selectedSlice.amount / total) * 100) : 0
  const chartData = slices.map((slice, index) => ({
    value: slice.amount,
    color: slice.color,
    onPress: () => onSelect(index),
  }))

  return (
    <YStack width={122} height={122} items="center" justify="center">
      <PieChart
        data={chartData}
        donut
        radius={54}
        innerRadius={34}
        focusOnPress
        toggleFocusOnPress={false}
        selectedIndex={selectedIndex}
        setSelectedIndex={onSelect}
        extraRadius={5}
        isAnimated
        animationDuration={250}
        showGradient={false}
        strokeWidth={2}
        strokeColor="rgba(255,255,255,0.72)"
        innerCircleColor="transparent"
        backgroundColor="transparent"
      />
      <YStack position="absolute" width={70} height={70} rounded="$12" bg="$card" borderColor="$borderColor" borderWidth={1} items="center" justify="center">
        <Paragraph color="$color12" fontSize="$7" fontWeight="900">{selectedPercent}%</Paragraph>
        <Paragraph color="$color9" fontSize="$1" numberOfLines={1} maxW={64} text="center">
          {selectedSlice?.name ?? ''}
        </Paragraph>
      </YStack>
    </YStack>
  )
}

function RecentMovements({ locale, transactions }: { locale: string; transactions: Transaction[] }) {
  const { t } = useTranslation()

  return (
    <YStack gap="$3">
      <XStack items="center" justify="space-between" gap="$3">
        <H3 color="$color12" fontFamily="$heading" size="$6" flex={1}>{t('dashboard.recentActivity')}</H3>
        <Link href="/(tabs)/movements" asChild>
          <Button chromeless size="$2" px="$2">
            <XStack items="center" gap="$1">
              <Paragraph color="$primary" fontWeight="800" fontSize="$2">{t('actions.viewAll')}</Paragraph>
              <ChevronRight size={14} color="$primary" />
            </XStack>
          </Button>
        </Link>
      </XStack>
      {transactions.length === 0 ? (
        <FintCard>
          <Paragraph color="$color10">{t('dashboard.emptyMovements')}</Paragraph>
        </FintCard>
      ) : (
        <FintCard p={0} overflow="hidden">
          {transactions.map((transaction, index) => {
            const type = transaction.type
            const isIncome = type === 'income'
            return (
              <XStack
                key={transaction.id}
                items="center"
                justify="space-between"
                gap="$3"
                p="$3"
                borderBottomColor="$borderColor"
                borderBottomWidth={index < transactions.length - 1 ? 1 : 0}
              >
                <XStack items="center" gap="$3" flex={1} minW={0}>
                  <YStack width={36} height={36} rounded="$8" bg={isIncome ? '$green2' : '$red2'} items="center" justify="center" shrink={0}>
                    {isIncome ? <ArrowDownLeft size={18} color="$green10" /> : <ArrowUpRight size={18} color="$red10" />}
                  </YStack>
                  <YStack flex={1} minW={0}>
                    <Paragraph color="$color12" fontSize="$3" fontWeight="800" numberOfLines={1}>{getCategoryLabel(transaction.category, t)}</Paragraph>
                    <Paragraph color="$color10" fontSize="$1" numberOfLines={1}>
                      {formatTransactionMeta(transaction, locale)}
                    </Paragraph>
                  </YStack>
                </XStack>
                <Paragraph color={isIncome ? '$green11' : '$red11'} fontSize="$2" fontWeight="800" shrink={0}>
                  {isIncome ? '+' : '-'}{formatMoney(transaction.amount, transaction.currency)}
                </Paragraph>
              </XStack>
            )
          })}
        </FintCard>
      )}
    </YStack>
  )
}

function getExpenseCategorySlices(transactions: Transaction[], colors: string[], t: ReturnType<typeof useTranslation>['t']) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue
    totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + transaction.amount)
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount], index) => ({ name: getCategoryLabel(name, t), amount, color: colors[index % colors.length] }))
}

function getDashboardTransactionRange() {
  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isTransactionInMonth(transaction: Transaction, month: number, year: number) {
  const date = parseTransactionDate(transaction.date)
  return Boolean(date && date.getFullYear() === year && date.getMonth() + 1 === month)
}

function getMonthTotals(transactions: Transaction[], month: number, year: number) {
  let income = 0
  let expenses = 0

  for (const transaction of transactions) {
    const date = parseTransactionDate(transaction.date)
    if (!date || date.getFullYear() !== year || date.getMonth() + 1 !== month) continue
    if (transaction.type === 'income') income += transaction.amount
    else expenses += transaction.amount
  }

  return { income, expenses }
}

function calculatePercentChange(current: number, previous: number) {
  if (previous === 0) return null
  return Math.round(((current - previous) / Math.abs(previous)) * 100)
}

function getWeeklyFlow(transactions: Transaction[], locale: string): WeeklyFlowPoint[] {
  const today = startOfDay(new Date())
  const firstDay = new Date(today)
  firstDay.setDate(today.getDate() - 27)
  const labelFormatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  const points = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(firstDay)
    start.setDate(firstDay.getDate() + index * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return {
      start,
      end,
      label: `${labelFormatter.format(start)}-${labelFormatter.format(end)}`,
      income: 0,
      expenses: 0,
    }
  })

  for (const transaction of transactions) {
    const date = parseTransactionDate(transaction.date)
    if (!date || date < firstDay || date > today) continue
    const index = Math.min(3, Math.floor((date.getTime() - firstDay.getTime()) / 604_800_000))
    if (transaction.type === 'income') points[index].income += transaction.amount
    else points[index].expenses += transaction.amount
  }

  return points.map(({ label, income, expenses }) => ({ label, income, expenses }))
}

function formatTransactionMeta(transaction: Transaction, locale: string) {
  const date = parseTransactionDate(transaction.date)
  const dateLabel = date ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date) : ''
  return [dateLabel, transaction.note || transaction.account].filter(Boolean).join(' · ')
}

function parseTransactionDate(value: string) {
  if (!value) return null
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : startOfDay(date)
}

function startOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function LoadingCard({ message }: { message: string }) {
  return (
    <FintCard items="center" justify="center" gap="$3" minH={160}>
      <Spinner color="$accent10" size="large" />
      <Paragraph color="$color10">{message}</Paragraph>
    </FintCard>
  )
}

function ErrorCard({ message, title }: { message: string; title: string }) {
  return (
    <FintCard bg="$red2" borderColor="$red6" gap="$2">
      <Paragraph color="$red11" fontWeight="800">{title}</Paragraph>
      <Paragraph color="$red11">{message}</Paragraph>
    </FintCard>
  )
}
