import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays, ChevronRight, CreditCard, Download, FileText, Landmark, Percent, PiggyBank, Table2 } from '@tamagui/lucide-icons-2'
import { useToastController } from '@tamagui/toast'
import { Link, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Paragraph, ScrollView, Spinner, XStack, YStack } from 'tamagui'
import { financeApi } from '../../src/api/finance'
import { formatMoney, normalizeAccount, normalizeDebt, normalizeTransaction } from '../../src/api/mappers'
import { DataStateCard } from '../../src/components/DataStateCard'
import { Screen } from '../../src/components/Screen'
import { buildFinancialReport, getPresetRange, getPreviousRange, type ReportPeriodPreset } from '../../src/finance/reports'
import { exportFinancialReportCsv, exportFinancialReportPdf } from '../../src/finance/report-export'
import { getCategoryLabel } from '../../src/finance/categoryLabels'
import { suggestedCategoryIcons } from '../../src/finance/categoryIcons'
import { trackAnalyticsEvent } from '../../src/analytics/privacy'
import { FintCard, FintSheetSelect } from '../../src/ui'

const copy = {
  es: {
    title: 'Reportes financieros', subtitle: 'Compara periodos y entiende cómo se mueve tu dinero.', period: 'Periodo', account: 'Cuenta', allAccounts: 'Todas las cuentas', currentMonth: 'Mes actual', previousMonth: 'Mes anterior', last3Months: 'Últimos 3 meses', last6Months: 'Últimos 6 meses', updated: 'Actualizado', mixed: 'Hay múltiples monedas. Los totales muestran solo la moneda seleccionada.', income: 'Ingresos', expenses: 'Gastos', savings: 'Ahorro neto', savingsRate: 'Tasa de ahorro', previous: 'vs. periodo anterior', flow: 'Flujo de ingresos y gastos', categories: 'Gastos por categoría', accounts: 'Saldos y patrimonio', debts: 'Estado de deudas', empty: 'No hay movimientos para este periodo. Crea un ingreso o gasto para activar el reporte.', viewMovements: 'Ver movimientos', noDebts: 'No tienes deudas activas.', paid: 'pagado', noPrevious: 'Sin periodo anterior', loading: 'Calculando reportes...', error: 'No pudimos cargar los datos del reporte.', exportTitle: 'Descargar reporte', exportPdf: 'Documento PDF', exportCsv: 'Archivo CSV', exporting: 'Preparando...', exported: 'Reporte listo', exportError: 'No pudimos exportar el reporte.', filters: 'Configura tu reporte', legendIncome: 'Ingreso', legendExpense: 'Gasto', tapHint: 'Toca una barra para ver el detalle' },
  en: {
    title: 'Financial reports', subtitle: 'Compare periods and understand how your money moves.', period: 'Period', account: 'Account', allAccounts: 'All accounts', currentMonth: 'Current month', previousMonth: 'Previous month', last3Months: 'Last 3 months', last6Months: 'Last 6 months', updated: 'Updated', mixed: 'Multiple currencies detected. Totals show only the selected currency.', income: 'Income', expenses: 'Expenses', savings: 'Net savings', savingsRate: 'Savings rate', previous: 'vs previous period', flow: 'Income and expense flow', categories: 'Spending by category', accounts: 'Balances and net worth', debts: 'Debt status', empty: 'No movements in this period. Create an income or expense to activate the report.', viewMovements: 'View movements', noDebts: 'You have no active debts.', paid: 'paid', noPrevious: 'No previous period', loading: 'Calculating reports...', error: 'Could not load report data.', exportTitle: 'Download report', exportPdf: 'PDF document', exportCsv: 'CSV file', exporting: 'Preparing...', exported: 'Report ready', exportError: 'Could not export the report.', filters: 'Configure your report', legendIncome: 'Income', legendExpense: 'Expense', tapHint: 'Tap a bar to view its details' },
  pt: {
    title: 'Relatórios financeiros', subtitle: 'Compare períodos e entenda como seu dinheiro se movimenta.', period: 'Período', account: 'Conta', allAccounts: 'Todas as contas', currentMonth: 'Mês atual', previousMonth: 'Mês anterior', last3Months: 'Últimos 3 meses', last6Months: 'Últimos 6 meses', updated: 'Atualizado', mixed: 'Há várias moedas. Os totais mostram apenas a moeda selecionada.', income: 'Receitas', expenses: 'Despesas', savings: 'Economia líquida', savingsRate: 'Taxa de economia', previous: 'vs. período anterior', flow: 'Fluxo de receitas e despesas', categories: 'Despesas por categoria', accounts: 'Saldos e patrimônio', debts: 'Situação das dívidas', empty: 'Não há movimentações neste período. Registre uma receita ou despesa para ativar o relatório.', viewMovements: 'Ver movimentações', noDebts: 'Você não possui dívidas ativas.', paid: 'pago', noPrevious: 'Sem período anterior', loading: 'Calculando relatórios...', error: 'Não foi possível carregar os dados do relatório.', exportTitle: 'Baixar relatório', exportPdf: 'Documento PDF', exportCsv: 'Arquivo CSV', exporting: 'Preparando...', exported: 'Relatório pronto', exportError: 'Não foi possível exportar o relatório.', filters: 'Configure seu relatório', legendIncome: 'Receita', legendExpense: 'Despesa', tapHint: 'Toque em uma barra para ver os detalhes' },
  }

export default function ReportsScreen() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage === 'en' || i18n.resolvedLanguage === 'pt' ? i18n.resolvedLanguage : 'es'
  const text = copy[language]
  const queryClient = useQueryClient()
  const toast = useToastController()
  const router = useRouter()
  const [preset, setPreset] = useState<ReportPeriodPreset>('currentMonth')
  const [account, setAccount] = useState('__all__')
  const [isExporting, setIsExporting] = useState(false)
  const range = getPresetRange(preset)
  const previousRange = getPreviousRange(range.from, range.to)
  const transactionsQuery = useQuery({ queryKey: ['transactions', 'reports', range.from, range.to], queryFn: () => financeApi.listAllTransactions(range), retry: false })
  const previousTransactionsQuery = useQuery({ queryKey: ['transactions', 'reports-previous', previousRange.from, previousRange.to], queryFn: () => financeApi.listAllTransactions(previousRange), retry: false })
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: financeApi.listAccounts, retry: false })
  const categoriesQuery = useQuery({ queryKey: ['categories'], queryFn: () => financeApi.listCategories(), retry: false })
  const debtsQuery = useQuery({ queryKey: ['debts'], queryFn: financeApi.listDebts, retry: false })
  const accounts = (accountsQuery.data ?? []).map(normalizeAccount)
  const selectedAccount = accounts.find((item) => item.id === account || item.name === account)
  const transactions = (transactionsQuery.data ?? []).map(normalizeTransaction)
  const previousTransactions = (previousTransactionsQuery.data ?? []).map(normalizeTransaction)
  const debts = (debtsQuery.data ?? []).map(normalizeDebt)
  const report = buildFinancialReport({ transactions, previousTransactions, accounts, debts, filters: { ...range, account: selectedAccount?.name, currency: selectedAccount?.currency, grouping: preset === 'currentMonth' || preset === 'previousMonth' ? 'week' : 'month' } })
  const hasReportMovements = report.income > 0 || report.expenses > 0
  const isLoading = transactionsQuery.isLoading || previousTransactionsQuery.isLoading || accountsQuery.isLoading || categoriesQuery.isLoading || debtsQuery.isLoading
  const error = transactionsQuery.error ?? previousTransactionsQuery.error ?? accountsQuery.error ?? categoriesQuery.error ?? debtsQuery.error
  const locale = language === 'en' ? 'en-US' : language === 'pt' ? 'pt-BR' : 'es-PE'

  useEffect(() => {
    void trackAnalyticsEvent('report_opened', { reportType: 'financial_summary' })
  }, [])

  const exportReport = async (format: 'pdf' | 'csv') => {
    setIsExporting(true)
    try {
      if (format === 'pdf') {
        await exportFinancialReportPdf(report, { title: text.title, period: text.period, income: text.income, expenses: text.expenses, savings: text.savings, savingsRate: text.savingsRate, flow: text.flow, categories: text.categories, accounts: text.accounts, debts: text.debts })
      } else {
        await exportFinancialReportCsv(report)
      }
      toast.show(text.exported, { preset: 'success' })
    } catch {
      toast.show(text.exportError, { preset: 'error' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Screen isRefreshing={transactionsQuery.isRefetching || accountsQuery.isRefetching || categoriesQuery.isRefetching || debtsQuery.isRefetching} onRefresh={() => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); queryClient.invalidateQueries({ queryKey: ['accounts'] }); queryClient.invalidateQueries({ queryKey: ['categories'] }); queryClient.invalidateQueries({ queryKey: ['debts'] }) }}>
      <FintCard bg="#0F5D73" borderColor="#28788C" gap="$3">
        <XStack items="center" gap="$3"><YStack width={48} height={48} rounded="$10" bg="rgba(93,214,229,0.14)" items="center" justify="center"><BarChart3 size={24} color="#5DD6E5" /></YStack><YStack flex={1} minW={0}><Paragraph color="#F4FBFD" fontFamily="$heading" fontSize="$6" fontWeight="800">{text.title}</Paragraph><Paragraph color="#B9D7E1">{text.subtitle}</Paragraph></YStack><FintSheetSelect label={text.exportTitle} placeholder={text.exportTitle} options={[{ value: 'pdf', label: text.exportPdf, icon: <FileText size={19} color="$primary" /> }, { value: 'csv', label: text.exportCsv, icon: <Table2 size={19} color="$primary" /> }]} onValueChange={(value) => { void exportReport(value as 'pdf' | 'csv') }} renderTrigger={({ onPress }) => <YStack width={44} height={44} rounded="$9" bg="rgba(93,214,229,0.14)" borderColor="rgba(93,214,229,0.35)" borderWidth={1} items="center" justify="center" opacity={isLoading || Boolean(error) || !hasReportMovements ? 0.45 : 1} onPress={isLoading || Boolean(error) || isExporting || !hasReportMovements ? undefined : onPress} aria-label={text.exportTitle}>{isExporting ? <Spinner size="small" color="#5DD6E5" /> : <Download size={21} color="#5DD6E5" />}</YStack>} /></XStack>
      </FintCard>

      <FintCard gap="$3">
        <Paragraph color="$color12" fontFamily="$heading" fontSize="$4" fontWeight="800">{text.filters}</Paragraph>
        <XStack gap="$3">
          <YStack flex={1}><FintSheetSelect label={text.period} placeholder={text.period} value={preset} options={[{ value: 'currentMonth', label: text.currentMonth }, { value: 'previousMonth', label: text.previousMonth }, { value: 'last3Months', label: text.last3Months }, { value: 'last6Months', label: text.last6Months }]} onValueChange={(value) => setPreset(value as ReportPeriodPreset)} /></YStack>
          <YStack flex={1}><FintSheetSelect label={text.account} placeholder={text.account} value={account} options={[{ value: '__all__', label: text.allAccounts }, ...accounts.map((item) => ({ value: item.id, label: item.name }))]} onValueChange={setAccount} /></YStack>
        </XStack>
      </FintCard>

      {isLoading ? <DataStateCard message={text.loading} /> : null}
      {error ? <DataStateCard message={text.error} onRetry={() => { void transactionsQuery.refetch(); void previousTransactionsQuery.refetch(); void accountsQuery.refetch(); void categoriesQuery.refetch(); void debtsQuery.refetch() }} /> : null}
      {!isLoading && !error && report.hasMixedCurrencies ? <FintCard bg="$yellow2" borderColor="$yellow6"><XStack gap="$2" items="center"><AlertTriangle size={18} color="$yellow10" /><Paragraph color="$yellow11" flex={1}>{text.mixed}</Paragraph></XStack></FintCard> : null}
      {!isLoading && !error && !hasReportMovements ? <DataStateCard message={text.empty} /> : null}

      {!isLoading && !error && hasReportMovements ? (
        <>
          <ReportMeta text={text} from={report.from} to={report.to} locale={locale} generatedAt={report.generatedAt} />
          <FlowCards text={text} report={report} />
          <SeriesCard text={text} report={report} locale={locale} />
          <CategoryCard categories={categoriesQuery.data ?? []} text={text} report={report} currency={report.currency} onOpenMovements={() => router.push('/(tabs)/movements')} />
          <AccountsCard text={text} report={report} />
          <DebtsCard text={text} report={report} />
        </>
      ) : null}
    </Screen>
  )
}

function ReportMeta({ from, generatedAt, locale, text, to }: { from: string; generatedAt: string; locale: string; text: typeof copy.es; to: string }) {
  return <XStack gap="$2" items="center"><CalendarDays size={16} color="$color10" /><Paragraph color="$color10" fontSize="$1">{from} - {to} · {text.updated}: {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(generatedAt))}</Paragraph></XStack>
}

function FlowCards({ report, text }: { report: ReturnType<typeof buildFinancialReport>; text: typeof copy.es }) {
  return <YStack gap="$2"><XStack gap="$2"><Metric icon={<ArrowDownLeft size={17} color="$green10" />} label={text.income} value={formatMoney(report.income, report.currency)} tone="positive" /><Metric icon={<ArrowUpRight size={17} color="$red10" />} label={text.expenses} value={formatMoney(report.expenses, report.currency)} tone="negative" /></XStack><XStack gap="$2"><Metric icon={<PiggyBank size={17} color={report.savings >= 0 ? '$green10' : '$red10'} />} label={text.savings} value={formatMoney(report.savings, report.currency)} tone={report.savings >= 0 ? 'positive' : 'negative'} /><Metric icon={<Percent size={17} color="$primary" />} label={text.savingsRate} value={report.savingsRate === null ? '-' : `${report.savingsRate}%`} tone="neutral" /></XStack></YStack>
}

function Metric({ icon, label, tone, value }: { icon: React.ReactNode; label: string; tone: 'positive' | 'negative' | 'neutral'; value: string }) {
  const color = tone === 'positive' ? '$green11' : tone === 'negative' ? '$red11' : '$primary'
  return <FintCard flex={1} p="$3" gap="$2"><XStack items="center" gap="$2"><YStack width={30} height={30} rounded="$8" bg="$secondary" items="center" justify="center">{icon}</YStack><Paragraph color="$color10" fontSize="$1" numberOfLines={2} flex={1}>{label}</Paragraph></XStack><Paragraph color={color} fontSize="$4" fontWeight="900" numberOfLines={1} adjustsFontSizeToFit>{value}</Paragraph></FintCard>
}

function SeriesCard({ locale, report, text }: { locale: string; report: ReturnType<typeof buildFinancialReport>; text: typeof copy.es }) {
  const [selectedPeriod, setSelectedPeriod] = useState(report.series.at(-1)?.period ?? '')
  const max = Math.max(1, ...report.series.flatMap((item) => [item.income, item.expenses]))
  const selected = report.series.find((item) => item.period === selectedPeriod) ?? report.series.at(-1)
  return <FintCard gap="$3"><YStack gap="$2"><Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800">{text.flow}</Paragraph><XStack gap="$4"><XStack items="center" gap="$1"><YStack width={8} height={8} rounded="$10" bg="$green9" /><Paragraph color="$color10" fontSize="$1">{text.legendIncome}</Paragraph></XStack><XStack items="center" gap="$1"><YStack width={8} height={8} rounded="$10" bg="$red9" /><Paragraph color="$color10" fontSize="$1">{text.legendExpense}</Paragraph></XStack></XStack></YStack>{selected ? <XStack bg="$secondary" rounded="$5" p="$3" gap="$3" items="center"><CalendarDays size={17} color="$primary" /><YStack flex={1}><Paragraph color="$color12" fontWeight="800">{formatPeriod(selected.period, locale)}</Paragraph><Paragraph color="$color10" fontSize="$1">{text.legendIncome}: {formatMoney(selected.income, report.currency)} · {text.legendExpense}: {formatMoney(selected.expenses, report.currency)}</Paragraph></YStack></XStack> : null}<ScrollView horizontal showsHorizontalScrollIndicator={false}><XStack minW="100%" height={172} items="flex-end" borderBottomColor="$borderColor" borderBottomWidth={1} gap="$2" px="$2">{report.series.map((item) => { const isSelected = item.period === selected?.period; return <YStack key={item.period} width={58} height={166} px="$1" pt="$2" rounded="$4" bg={isSelected ? '$secondary' : 'transparent'} items="center" justify="flex-end" gap="$2" pressStyle={{ bg: '$secondary' }} onPress={() => setSelectedPeriod(item.period)}><XStack height={126} items="flex-end" gap={6}><YStack width={15} height={item.income > 0 ? Math.max(5, Math.round((item.income / max) * 120)) : 0} bg="$green9" rounded="$3" opacity={isSelected ? 1 : 0.8} /><YStack width={15} height={item.expenses > 0 ? Math.max(5, Math.round((item.expenses / max) * 120)) : 0} bg="$red9" rounded="$3" opacity={isSelected ? 1 : 0.8} /></XStack><Paragraph color={isSelected ? '$color12' : '$color9'} fontSize={9} fontWeight={isSelected ? '800' : '500'} numberOfLines={1}>{formatPeriod(item.period, locale)}</Paragraph></YStack> })}</XStack></ScrollView><Paragraph color="$color9" fontSize="$1">{text.tapHint}</Paragraph></FintCard>
}

function formatPeriod(period: string, locale: string) {
  const value = period.length === 7 ? `${period}-01T12:00:00` : `${period}T12:00:00`
  return new Intl.DateTimeFormat(locale, period.length === 7 ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }).format(new Date(value))
}

function CategoryCard({ categories, currency, onOpenMovements, report, text }: { categories: Awaited<ReturnType<typeof financeApi.listCategories>>; currency: string; onOpenMovements: () => void; report: ReturnType<typeof buildFinancialReport>; text: typeof copy.es }) {
  const { t } = useTranslation()
  return <FintCard gap="$3"><XStack items="center" justify="space-between" gap="$3"><Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800" flex={1}>{text.categories}</Paragraph><Button chromeless size="$2" px="$2" onPress={onOpenMovements}><XStack items="center" gap="$1"><Paragraph color="$primary" fontWeight="800" fontSize="$2">{text.viewMovements}</Paragraph><ChevronRight size={14} color="$primary" /></XStack></Button></XStack>{report.categories.length === 0 ? <Paragraph color="$color10">{text.empty}</Paragraph> : report.categories.map((item) => { const category = categories.find((candidate) => candidate.name.toLowerCase() === item.category.toLowerCase()); const emoji = category?.icon || suggestedCategoryIcons(item.category, 'expense')[0]; return <XStack key={item.category} items="center" gap="$3"><YStack width={38} height={38} rounded="$8" bg="$secondary" items="center" justify="center"><Paragraph fontSize="$5">{emoji}</Paragraph></YStack><YStack flex={1}><Paragraph color="$color12" fontWeight="800">{getCategoryLabel(item.category, t)}</Paragraph><Paragraph color="$color10" fontSize="$1">{item.percentage}% · {item.change === null ? text.noPrevious : `${item.change > 0 ? '+' : ''}${item.change}% ${text.previous}`}</Paragraph></YStack><Paragraph color="$color12" fontWeight="900">{formatMoney(item.amount, currency)}</Paragraph></XStack> })}</FintCard>
}

function AccountsCard({ report, text }: { report: ReturnType<typeof buildFinancialReport>; text: typeof copy.es }) {
  return <FintCard gap="$3"><Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800">{text.accounts}</Paragraph>{report.accounts.map((account) => <XStack key={account.id} items="center" gap="$3"><Landmark size={17} color="$primary" /><YStack flex={1}><Paragraph color="$color12" fontWeight="800" numberOfLines={1}>{account.name}</Paragraph><Paragraph color="$color10" fontSize="$1">{account.currency} · {account.percentage}%</Paragraph></YStack><Paragraph color="$color12" fontWeight="900">{formatMoney(account.balance, account.currency)}</Paragraph></XStack>)}</FintCard>
}

function DebtsCard({ report, text }: { report: ReturnType<typeof buildFinancialReport>; text: typeof copy.es }) {
  return <FintCard gap="$3"><Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="800">{text.debts}</Paragraph>{report.debts.length === 0 ? <Paragraph color="$color10">{text.noDebts}</Paragraph> : report.debts.map((debt) => <XStack key={debt.id} items="center" gap="$3"><CreditCard size={17} color={debt.status === 'overdue' ? '$red10' : '$primary'} /><YStack flex={1}><Paragraph color="$color12" fontWeight="800" numberOfLines={1}>{debt.description}</Paragraph><Paragraph color="$color10" fontSize="$1">{debt.paidPercentage}% {text.paid}</Paragraph></YStack><Paragraph color="$color12" fontWeight="900">{formatMoney(debt.outstanding, debt.currency)}</Paragraph><Link href="/(tabs)/debts" asChild><ChevronRight size={18} color="$color10" /></Link></XStack>)}</FintCard>
}
