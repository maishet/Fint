import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, FileUp, RefreshCw, Upload } from '@tamagui/lucide-icons-2'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paragraph, XStack, YStack } from 'tamagui'
import * as XLSX from 'xlsx'
import { financeApi } from '../src/api/finance'
import type { ImportTransactionsResult } from '../src/api/types'
import { Screen } from '../src/components/Screen'
import { MovementPickerTrigger } from '../src/components/MovementFormControls'
import { currencyOptions } from '../src/finance/currencies'
import {
  buildImportItems,
  detectMapping,
  IMPORT_FIELDS,
  REQUIRED_IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
} from '../src/finance/import-parse'
import { FintButton, FintCard, FintFormField, FintSheetSelect, FintSpinner, useNotify } from '../src/ui'

const NONE = '-1'

export default function ImportTransactionsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const toast = useNotify()
  const queryClient = useQueryClient()
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [dataRows, setDataRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [fallbackCurrency, setFallbackCurrency] = useState('PEN')
  const [showMapping, setShowMapping] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const [result, setResult] = useState<ImportTransactionsResult | null>(null)
  const didAutoPick = useRef(false)

  const parsed = useMemo(
    () => buildImportItems(dataRows, mapping, fallbackCurrency),
    [dataRows, mapping, fallbackCurrency],
  )
  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined)
  const hasFile = headers.length > 0

  const pickFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (picked.canceled || !picked.assets[0]) return
      const asset = picked.assets[0]
      setIsReading(true)
      const base64 = await new File(asset.uri).base64()
      const workbook = XLSX.read(base64, { type: 'base64', cellDates: true })
      const sheet = workbook.Sheets[workbook.SheetNames[0]!]
      if (!sheet) throw new Error('empty')
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false, defval: '' }) as unknown[][]
      if (aoa.length < 2) {
        toast.error(t('import.emptyFile'))
        return
      }
      const headerRow = (aoa[0] ?? []).map((cell) => String(cell ?? '').trim())
      const rows = aoa.slice(1).map((row) => headerRow.map((_, index) => toCellString(row[index])))
      const detected = detectMapping(headerRow)
      setHeaders(headerRow)
      setDataRows(rows)
      setMapping(detected)
      setFileName(asset.name)
      setResult(null)
      // Sólo mostramos el mapeo si faltó autodetectar alguna columna requerida.
      setShowMapping(REQUIRED_IMPORT_FIELDS.some((field) => detected[field] === undefined))
    } catch {
      toast.error(t('import.readError'))
    } finally {
      setIsReading(false)
    }
  }

  // Al entrar, abrimos el selector del sistema directamente (un solo toque).
  useEffect(() => {
    if (didAutoPick.current) return
    didAutoPick.current = true
    void pickFile()
  }, [])

  const setFieldColumn = (field: ImportField, value: string) => {
    setMapping((current) => {
      const next = { ...current }
      const index = Number(value)
      if (index < 0) delete next[field]
      else next[field] = index
      return next
    })
  }

  const importMutation = useMutation({
    mutationFn: () => financeApi.importTransactions(parsed.items),
    onSuccess: async (data) => {
      setResult(data)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['summary'] }),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
        queryClient.invalidateQueries({ queryKey: ['categories'] }),
      ])
    },
    onError: (error) => toast.error(t('import.error'), { message: error instanceof Error ? error.message : undefined }),
  })

  const columnOptions = [
    { value: NONE, label: t('import.unmapped') },
    ...headers.map((header, index) => ({ value: String(index), label: header || `${t('import.column')} ${index + 1}` })),
  ]

  return (
    <>
      <Stack.Screen options={{ title: t('import.title') }} />
      <Screen>
        <YStack gap="$4" pb="$5">
          {result ? (
            <>
              <FintCard items="center" gap="$3" py="$5">
                <YStack width={60} height={60} rounded="$12" bg="$green2" items="center" justify="center">
                  <CheckCircle2 size={30} color="$green10" />
                </YStack>
                <Paragraph color="$color12" fontFamily="$heading" fontSize="$6" fontWeight="800">{t('import.resultTitle')}</Paragraph>
                <YStack gap="$2" width="100%">
                  <ResultRow label={t('import.created')} value={result.created} color="$green10" />
                  <ResultRow label={t('import.duplicates')} value={result.duplicates} color="$color10" />
                  <ResultRow label={t('import.failed')} value={result.failed} color={result.failed ? '$red10' : '$color10'} />
                </YStack>
              </FintCard>
              <FintButton width="100%" minH={50} onPress={() => router.back()}>{t('import.done')}</FintButton>
            </>
          ) : !hasFile ? (
            <FintCard items="center" gap="$3" py="$6">
              <YStack width={56} height={56} rounded="$10" bg="$secondary" items="center" justify="center">
                <FileSpreadsheet size={26} color="$primary" />
              </YStack>
              <YStack items="center" gap="$1">
                <Paragraph color="$color12" fontFamily="$heading" fontSize="$5" fontWeight="700">{t('import.chooseTitle')}</Paragraph>
                <Paragraph color="$color10" fontSize="$2" text="center" maxW={280}>{t('import.chooseHint')}</Paragraph>
              </YStack>
              <FintButton
                disabled={isReading}
                icon={isReading ? <FintSpinner color="$primaryForeground" /> : <FileUp size={18} />}
                onPress={pickFile}
              >
                {isReading ? t('import.reading') : t('import.choose')}
              </FintButton>
            </FintCard>
          ) : (
            <>
              <XStack items="center" gap="$3" bg="$muted" rounded="$5" p="$3">
                <YStack width={40} height={40} rounded="$9" bg="$accent2" items="center" justify="center">
                  <FileSpreadsheet size={20} color="$primary" />
                </YStack>
                <Paragraph flex={1} minW={0} color="$color12" fontWeight="700" numberOfLines={1}>{fileName}</Paragraph>
                <XStack role="button" aria-label={t('import.change')} onPress={pickFile} pressStyle={{ opacity: 0.6 }} p="$1.5">
                  {isReading ? <FintSpinner size="small" color="$primary" /> : <RefreshCw size={18} color="$primary" />}
                </XStack>
              </XStack>

              <YStack gap="$2" bg="$accent1" borderColor="$accent4" borderWidth={1} rounded="$6" p="$3">
                <XStack items="center" gap="$2">
                  <CheckCircle2 size={16} color="$green10" />
                  <Paragraph color="$color12" fontWeight="800">{t('import.previewNew', { count: parsed.items.length })}</Paragraph>
                </XStack>
                {parsed.invalid > 0 ? (
                  <XStack items="center" gap="$2">
                    <AlertTriangle size={16} color="$yellow10" />
                    <Paragraph color="$color10" fontSize="$2">{t('import.previewInvalid', { count: parsed.invalid })}</Paragraph>
                  </XStack>
                ) : null}
                <Paragraph color="$color9" fontSize="$1">{t('import.duplicateHint')}</Paragraph>
              </YStack>

              {missingRequired.length > 0 ? (
                <Paragraph color="$red10" fontSize="$2">
                  {t('import.missingRequired', { fields: missingRequired.map((field) => t(`import.fields.${field}`)).join(', ') })}
                </Paragraph>
              ) : (
                <XStack
                  role="button"
                  items="center"
                  justify="center"
                  gap="$2"
                  onPress={() => setShowMapping((value) => !value)}
                  pressStyle={{ opacity: 0.6 }}
                  py="$1"
                >
                  <Paragraph color="$primary" fontWeight="700" fontSize="$2">{t('import.adjustColumns')}</Paragraph>
                  {showMapping ? <ChevronUp size={16} color="$primary" /> : <ChevronDown size={16} color="$primary" />}
                </XStack>
              )}

              {showMapping ? (
                <YStack gap="$2.5">
                  {IMPORT_FIELDS.map((field) => (
                    <FintFormField
                      key={field}
                      label={t(`import.fields.${field}`)}
                      required={REQUIRED_IMPORT_FIELDS.includes(field)}
                      showLabel={false}
                    >
                      <FintSheetSelect
                        label={t(`import.fields.${field}`)}
                        showLabel={false}
                        placeholder={t('import.unmapped')}
                        value={String(mapping[field] ?? NONE)}
                        options={columnOptions}
                        onValueChange={(value) => setFieldColumn(field, value)}
                        renderTrigger={({ onPress, selectedLabel }) => (
                          <MovementPickerTrigger
                            icon={<FileSpreadsheet size={20} color="$primary" />}
                            label={t(`import.fields.${field}`)}
                            required={REQUIRED_IMPORT_FIELDS.includes(field)}
                            onPress={onPress}
                            value={selectedLabel}
                          />
                        )}
                      />
                    </FintFormField>
                  ))}
                  <FintFormField label={t('import.fallbackCurrency')} showLabel={false}>
                    <FintSheetSelect
                      label={t('import.fallbackCurrency')}
                      showLabel={false}
                      placeholder={t('import.fallbackCurrency')}
                      value={fallbackCurrency}
                      options={currencyOptions}
                      searchable
                      searchPlaceholder={t('accounts.searchCurrency')}
                      onValueChange={setFallbackCurrency}
                      renderTrigger={({ onPress, selectedLabel }) => (
                        <MovementPickerTrigger
                          icon={<FileSpreadsheet size={20} color="$primary" />}
                          label={t('import.fallbackCurrency')}
                          onPress={onPress}
                          value={selectedLabel}
                        />
                      )}
                    />
                  </FintFormField>
                </YStack>
              ) : null}

              <FintButton
                width="100%"
                minH={52}
                disabled={importMutation.isPending || parsed.items.length === 0 || missingRequired.length > 0}
                icon={importMutation.isPending ? <FintSpinner color="$primaryForeground" /> : <Upload size={18} />}
                onPress={() => importMutation.mutate()}
              >
                {importMutation.isPending ? t('import.importing') : t('import.confirm', { count: parsed.items.length })}
              </FintButton>
            </>
          )}
        </YStack>
      </Screen>
    </>
  )
}

function ResultRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <XStack items="center" justify="space-between" bg="$muted" rounded="$5" px="$3" py="$2.5">
      <Paragraph color="$color11" fontWeight="600">{label}</Paragraph>
      <Paragraph color={color as never} fontSize="$5" fontWeight="900">{value}</Paragraph>
    </XStack>
  )
}

function toCellString(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  }
  return String(value ?? '').trim()
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
