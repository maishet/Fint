import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Coins, FileSpreadsheet, FileUp, RefreshCw } from "@tamagui/lucide-icons-2";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import * as XLSX from "xlsx";
import { CurrencySheet } from "../src/accounts/CurrencySheet";
import { financeApi } from "../src/api/finance";
import type { ImportTransactionsResult } from "../src/api/types";
import {
  buildImportItems,
  detectMapping,
  IMPORT_FIELDS,
  REQUIRED_IMPORT_FIELDS,
  type ColumnMapping,
  type ImportField,
} from "../src/finance/import-parse";
import { Group, Item, OptionSheet } from "../src/settings/SettingsList";
import { StackFrame } from "../src/settings/StackFrame";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { FintButton, FintCard, FintSpinner, FText, useNotify } from "../src/ui";

const NONE = "-1";
const SHEET_UNMOUNT_MS = 600;
type Sheet = { kind: "field"; field: ImportField } | { kind: "currency" } | null;

/**
 * Importar movimientos v3 (desde "Más"): abre el selector de archivos al entrar; con el archivo leído muestra su
 * nombre (tocar el icono elige otro), cuántos movimientos nuevos se van a crear y, si faltó detectar una columna
 * obligatoria, la lista de columnas para ajustarlas (cada una abre una hoja con las columnas del archivo y un valor
 * de ejemplo). "Importar N movimientos" va fijo abajo; al terminar, el resultado con las cifras en `mono`. La
 * lectura del archivo y el armado de los movimientos no cambian.
 */
export default function ImportTransactionsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fallbackCurrency, setFallbackCurrency] = useState("PEN");
  const [showMapping, setShowMapping] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [result, setResult] = useState<ImportTransactionsResult | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [mountedSheet, setMountedSheet] = useState<Sheet>(null);
  const didAutoPick = useRef(false);

  const parsed = useMemo(() => buildImportItems(dataRows, mapping, fallbackCurrency), [dataRows, mapping, fallbackCurrency]);
  const missingRequired = REQUIRED_IMPORT_FIELDS.filter((field) => mapping[field] === undefined);
  const hasFile = headers.length > 0;

  useEffect(() => {
    if (sheet) return;
    const id = setTimeout(() => setMountedSheet(null), SHEET_UNMOUNT_MS);
    return () => clearTimeout(id);
  }, [sheet]);
  const openSheet = (next: Exclude<Sheet, null>) => {
    setMountedSheet(next);
    setSheet(next);
  };

  const pickFile = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      setIsReading(true);
      const base64 = await new File(asset.uri).base64();
      const workbook = XLSX.read(base64, { type: "base64", cellDates: true });
      const sheetData = workbook.Sheets[workbook.SheetNames[0]!];
      if (!sheetData) throw new Error("empty");
      const aoa = XLSX.utils.sheet_to_json(sheetData, { header: 1, raw: true, blankrows: false, defval: "" }) as unknown[][];
      if (aoa.length < 2) {
        notify.error(t("import.emptyFile"));
        return;
      }
      const headerRow = (aoa[0] ?? []).map((cell) => String(cell ?? "").trim());
      const rows = aoa.slice(1).map((row) => headerRow.map((_, index) => toCellString(row[index])));
      const detected = detectMapping(headerRow);
      setHeaders(headerRow);
      setDataRows(rows);
      setMapping(detected);
      setFileName(asset.name);
      setResult(null);
      // Solo se muestra el mapeo si faltó autodetectar alguna columna requerida.
      setShowMapping(REQUIRED_IMPORT_FIELDS.some((field) => detected[field] === undefined));
    } catch {
      notify.error(t("import.readError"));
    } finally {
      setIsReading(false);
    }
  };

  // Al entrar se abre el selector del sistema directamente (un solo toque).
  useEffect(() => {
    if (didAutoPick.current) return;
    didAutoPick.current = true;
    void pickFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFieldColumn = (field: ImportField, value: string) => {
    setMapping((current) => {
      const next = { ...current };
      const index = Number(value);
      if (index < 0) delete next[field];
      else next[field] = index;
      return next;
    });
  };

  const importMutation = useMutation({
    mutationFn: () => financeApi.importTransactions(parsed.items),
    onSuccess: async (data) => {
      setResult(data);
      await Promise.all(
        ["transactions", "dashboard", "accounts", "summary", "reports", "categories"].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
    onError: (error) => notify.error(t("import.error"), { message: error instanceof Error ? error.message : undefined }),
  });

  // El nombre de la cabecera no siempre dice qué hay dentro ("col_3", "Importe 2"); un valor real del archivo lo
  // resuelve de un vistazo.
  const columnOptions = [
    { value: NONE, label: t("import.unmapped") },
    ...headers.map((header, index) => {
      const sample = dataRows.find((row) => row[index]?.trim())?.[index]?.trim();
      return {
        value: String(index),
        label: header || `${t("import.column")} ${index + 1}`,
        detail: sample ? t("import.sampleValue", { value: sample.slice(0, 40) }) : undefined,
      };
    }),
  ];
  const columnLabel = (field: ImportField) => {
    const index = mapping[field];
    return index === undefined ? t("import.unmapped") : headers[index] || `${t("import.column")} ${index + 1}`;
  };

  return (
    <StackFrame title={t("import.title")}>
      {result ? (
        <ScrollView contentContainerStyle={{ padding: space[4] }}>
          <FintCard p={space[5]} items="center" gap={space[3]}>
            <View width={60} height={60} rounded={999} bg="$surfaceSunken" items="center" justify="center">
              <CheckCircle2 size={28} color="$flowIn" strokeWidth={2} />
            </View>
            <FText variant="section-title">{t("import.resultTitle")}</FText>
            <YStack self="stretch" gap={8}>
              <ResultRow label={t("import.created")} value={result.created} tone="flowIn" />
              <ResultRow label={t("import.duplicates")} value={result.duplicates} tone="inkMuted" />
              <ResultRow label={t("import.failed")} value={result.failed} tone={result.failed ? "dangerHard" : "inkMuted"} />
            </YStack>
          </FintCard>
          <YStack mt={space[4]}>
            <FintButton onPress={() => router.back()}>{t("import.done")}</FintButton>
          </YStack>
        </ScrollView>
      ) : !hasFile ? (
        <YStack flex={1} items="center" justify="center" gap={space[3]} px={space[6]}>
          <View width={64} height={64} rounded={999} bg="$brandWash" items="center" justify="center">
            <FileSpreadsheet size={26} color="$brand" strokeWidth={2} />
          </View>
          <FText variant="section-title" style={{ textAlign: "center", marginTop: 6 }}>
            {t("import.chooseTitle")}
          </FText>
          <FText tone="inkMuted" style={{ textAlign: "center", fontSize: 14, lineHeight: 20, maxWidth: 280 }}>
            {t("import.chooseHint")}
          </FText>
          <View width={240} mt={10}>
            <FintButton
              disabled={isReading}
              icon={isReading ? <FintSpinner color="$onBrand" /> : <FileUp size={18} color="$onBrand" />}
              onPress={pickFile}
            >
              {isReading ? t("import.reading") : t("import.choose")}
            </FintButton>
          </View>
        </YStack>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingTop: space[2], paddingBottom: space[6] }} showsVerticalScrollIndicator={false}>
            {/* El archivo: su nombre y el icono para elegir otro. */}
            <XStack mx={space[4]} items="center" gap={space[3]} px={14} py={12} rounded={radius.lg} bg="$surfaceSunken">
              <View width={38} height={38} rounded={999} bg="$surface" items="center" justify="center">
                <FileSpreadsheet size={18} color="$inkMuted" strokeWidth={2} />
              </View>
              <FText variant="body-strong" numberOfLines={1} style={{ flex: 1 }}>
                {fileName}
              </FText>
              <Pressable onPress={pickFile} disabled={isReading} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("import.change")}>
                {isReading ? <FintSpinner color="$brand" /> : <RefreshCw size={18} color="$brand" strokeWidth={2} />}
              </Pressable>
            </XStack>

            {/* Qué se va a crear. */}
            <FintCard mx={space[4]} mt={space[3]} p={space[4]} gap={8}>
              <XStack items="center" gap={8}>
                <CheckCircle2 size={16} color="$flowIn" strokeWidth={2} />
                <FText variant="body-strong">{t("import.previewNew", { count: parsed.items.length })}</FText>
              </XStack>
              {parsed.invalid > 0 ? (
                <XStack items="center" gap={8}>
                  <AlertTriangle size={16} color="$inkMuted" strokeWidth={2} />
                  <FText variant="label" tone="inkMuted">
                    {t("import.previewInvalid", { count: parsed.invalid })}
                  </FText>
                </XStack>
              ) : null}
              <FText variant="caption" tone="inkFaint" style={{ lineHeight: 17 }}>
                {t("import.duplicateHint")}
              </FText>
            </FintCard>

            {missingRequired.length > 0 ? (
              <XStack items="center" gap={5} mx={space[4]} mt={12} accessibilityRole="alert">
                <CircleAlert size={13} color="$dangerHard" strokeWidth={2.2} />
                <FText variant="caption" tone="dangerHard" style={{ flex: 1, fontFamily: fontFace.sans[600] }}>
                  {t("import.missingRequired", { fields: missingRequired.map((field) => t(`import.fields.${field}`)).join(", ") })}
                </FText>
              </XStack>
            ) : (
              <Pressable onPress={() => setShowMapping((value) => !value)} accessibilityRole="button" accessibilityState={{ expanded: showMapping }}>
                <XStack items="center" justify="center" gap={6} py={14}>
                  <FText variant="label" tone="brand" style={{ fontFamily: fontFace.sans[600] }}>
                    {t("import.adjustColumns")}
                  </FText>
                  {showMapping ? <ChevronUp size={16} color="$brand" /> : <ChevronDown size={16} color="$brand" />}
                </XStack>
              </Pressable>
            )}

            {showMapping || missingRequired.length > 0 ? (
              <View mt={missingRequired.length > 0 ? 12 : 0}>
                <Group>
                  {IMPORT_FIELDS.map((field) => (
                    <Item
                      key={field}
                      icon={FileSpreadsheet}
                      label={`${t(`import.fields.${field}`)}${REQUIRED_IMPORT_FIELDS.includes(field) ? " *" : ""}`}
                      value={columnLabel(field)}
                      tone="default"
                      onPress={() => openSheet({ kind: "field", field })}
                    />
                  ))}
                  <Item
                    icon={Coins}
                    label={t("import.fallbackCurrency")}
                    value={fallbackCurrency}
                    valueMono
                    onPress={() => openSheet({ kind: "currency" })}
                  />
                </Group>
              </View>
            ) : null}
          </ScrollView>

          <View px={space[4]} pt={space[3]} pb={Math.max(insets.bottom, 16) + 10} bg="$canvas">
            <FintButton
              disabled={importMutation.isPending || parsed.items.length === 0 || missingRequired.length > 0}
              onPress={() => importMutation.mutate()}
            >
              {importMutation.isPending ? <FintSpinner color="$onBrand" /> : t("import.confirm", { count: parsed.items.length })}
            </FintButton>
          </View>
        </>
      )}

      {mountedSheet?.kind === "field" ? (
        <OptionSheet
          open={sheet?.kind === "field"}
          onClose={() => setSheet(null)}
          title={t(`import.fields.${mountedSheet.field}`)}
          value={String(mapping[mountedSheet.field] ?? NONE)}
          options={columnOptions}
          onChange={(value) => setFieldColumn(mountedSheet.field, value)}
        />
      ) : null}
      {mountedSheet?.kind === "currency" ? (
        <CurrencySheet
          open={sheet?.kind === "currency"}
          onClose={() => setSheet(null)}
          title={t("import.fallbackCurrency")}
          value={fallbackCurrency}
          onSelect={(code) => {
            setFallbackCurrency(code);
            setSheet(null);
          }}
        />
      ) : null}
    </StackFrame>
  );
}

function ResultRow({ label, value, tone }: { label: string; value: number; tone: "flowIn" | "inkMuted" | "dangerHard" }) {
  return (
    <XStack items="center" justify="space-between" px={14} py={12} rounded={radius.md} bg="$surfaceSunken">
      <FText variant="label">{label}</FText>
      <FText tone={tone} style={{ ...textStyles["amount-lg"], fontSize: 18, lineHeight: 22 }}>
        {value}
      </FText>
    </XStack>
  );
}

function toCellString(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  return String(value ?? "").trim();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
