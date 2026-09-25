import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, History, Plus, Trash2 } from "@tamagui/lucide-icons-2";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { View, XStack, YStack } from "tamagui";
import { ApiRequestError } from "../src/api/client";
import { financeApi } from "../src/api/finance";
import type { CaptureResultPreview, TransactionType } from "../src/api/types";
import { useAuth } from "../src/auth/AuthProvider";
import { resolveDisplayName } from "../src/auth/displayName";
import { CaptureRejectedError, MAX_CAPTURE_BATCH_SIZE, prepareImageForOcr, sweepStaleCaptureFiles } from "../src/capture/image-pipeline";
import { consumeShareQueue } from "../src/capture/shareQueue";
import { extractReceipt, VISION_MODEL, VisionRequestError } from "../src/capture/visionClient";
import { formatDateString } from "../src/finance/dates";
import { getAppLocale } from "../src/i18n";
import { StackFrame } from "../src/settings/StackFrame";
import { randomId } from "../src/shared/id";
import { radius, space } from "../src/theme/tokens";
import { fontFace, textStyles } from "../src/theme/typography";
import { Amount, FintButton, FintCard, FintSheet, FintSpinner, FText, PressableScale, useNotify } from "../src/ui";
import { GroupedCell } from "../src/ui/GroupedCell";
import { SwipeActions, type SwipeAction } from "../src/ui/SwipeActions";

type RowStatus = "queued" | "processing" | "created" | "duplicate" | "unrecognized" | "failed";

// Pasos reales del pipeline de una captura, en orden. No es una animación
// simulada: el progreso salta a la siguiente marca exactamente cuando ese
// paso termina de verdad (lectura local del archivo, respuesta del Worker,
// respuesta del backend) — no hay temporizador ni estimación de tiempo. Cada
// fila corre su propio pipeline en paralelo con las demás.
type ProcessingPhase = "preparing" | "extracting" | "saving";

const PHASE_PROGRESS: Record<ProcessingPhase, number> = {
  preparing: 0.05,
  extracting: 0.3,
  saving: 0.85,
};

// El texto durante 'processing' rota entre estas frases en vez de mostrar el
// paso técnico real (que sí sigue siendo exacto en la barra/porcentaje) — el
// nombre del paso no le dice nada útil al usuario, esto lo mantiene animado.
const ROTATING_TEXT_KEYS = ["capture.rotating1", "capture.rotating2", "capture.rotating3", "capture.rotating4", "capture.rotating5"];
const ROTATING_TEXT_INTERVAL_MS = 1600;

type CaptureRow = {
  clientCaptureId: string;
  uri: string;
  status: RowStatus;
  bank: string | null;
  preview: CaptureResultPreview | null;
  warnings: string[];
  pendingMovementId: string | null;
  errorText: string | null;
  processingPhase: ProcessingPhase | null;
};

type ScreenPhase = "opening" | "processing";

/**
 * Importar constancia (Escanear) v3: la lógica de siempre (lectura local, extracción, pendiente en el backend,
 * dirección cuando no se sabe quién pagó) con la presentación del sistema: volver y título, el resumen en una
 * tarjeta con el estado y las cifras en `mono`, las imágenes en una lista agrupada (deslizar o el tacho para
 * quitar una, con confirmación), "¿Quién hizo esta operación?" con dos fichas y el botón fijo abajo.
 */
export default function CaptureImportScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useNotify();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [phase, setPhase] = useState<ScreenPhase>("opening");
  const [rows, setRows] = useState<CaptureRow[]>([]);
  const [directionAnswers, setDirectionAnswers] = useState<Record<string, TransactionType>>({});
  const [deleteTarget, setDeleteTarget] = useState<CaptureRow | null>(null);
  const didAutoPick = useRef(false);
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const locale = getAppLocale(i18n.resolvedLanguage);

  useEffect(() => {
    sweepStaleCaptureFiles();
  }, []);

  useEffect(() => {
    if (didAutoPick.current) return;
    didAutoPick.current = true;
    void (async () => {
      const shared = await consumeShareQueue();
      if (shared.length > 0) await processUris("share", shared);
      else await pickFromGallery();
    })();
  }, []);

  const displayName = resolveDisplayName(session) ?? null;
  const hasWeakName = !displayName || displayName.trim().split(/\s+/).filter(Boolean).length < 2;

  function updateRow(id: string, patch: Partial<CaptureRow>) {
    setRows((current) => current.map((row) => (row.clientCaptureId === id ? { ...row, ...patch } : row)));
  }

  function describeError(error: unknown): string {
    if (error instanceof CaptureRejectedError) return t(`capture.pipelineErrors.${error.reasonCode}`, { defaultValue: t("capture.errors.unknown") });
    if (error instanceof VisionRequestError) {
      if (error.kind === "quota_exceeded") return t("capture.errors.quotaExhausted");
      if (error.kind === "unauthorized") return t("capture.errors.unauthorized");
      return t("capture.errors.visionUnavailable");
    }
    if (error instanceof ApiRequestError) return error.message;
    return t("capture.errors.unknown");
  }

  async function processRow(source: "camera" | "gallery" | "share", row: CaptureRow) {
    if (deletedIdsRef.current.has(row.clientCaptureId)) return;
    updateRow(row.clientCaptureId, { status: "processing", processingPhase: "preparing" });
    let prepared: Awaited<ReturnType<typeof prepareImageForOcr>> | null = null;
    try {
      prepared = await prepareImageForOcr(row.uri);
      updateRow(row.clientCaptureId, { processingPhase: "extracting" });
      const { extraction, latencyMs } = await extractReceipt(prepared.base64);
      updateRow(row.clientCaptureId, { processingPhase: "saving" });
      const result = await financeApi.createPendingFromCapture(
        [
          {
            clientCaptureId: row.clientCaptureId,
            source,
            capturedAt: null,
            extraction,
            extractor: { provider: "cloudflare-workers-ai", model: VISION_MODEL, latencyMs },
          },
        ],
        displayName,
      );
      const item = result.results[0];
      if (!item) throw new Error("empty capture result");
      updateRow(row.clientCaptureId, {
        status: item.status,
        bank: item.bank,
        preview: item.preview,
        warnings: item.warnings,
        pendingMovementId: item.pendingMovementId,
        processingPhase: null,
      });
    } catch (error) {
      updateRow(row.clientCaptureId, { status: "failed", errorText: describeError(error), processingPhase: null });
    } finally {
      prepared?.cleanup();
    }
  }

  // Se usa tanto para la primera carga como para "agregar más" — cada
  // llamada agrega filas nuevas a las que ya hay y procesa esas en paralelo,
  // sin tocar las filas de rondas anteriores.
  async function processUris(source: "camera" | "gallery" | "share", uris: string[]) {
    setPhase("processing");

    const capped = uris.slice(0, MAX_CAPTURE_BATCH_SIZE);
    if (uris.length > capped.length) {
      toast.info(t("capture.batchLimitExceeded", { max: MAX_CAPTURE_BATCH_SIZE }));
    }
    if (hasWeakName) toast.info(t("capture.nameHint"));

    const newRows: CaptureRow[] = capped.map((uri) => ({
      clientCaptureId: randomId(),
      uri,
      status: "queued",
      bank: null,
      preview: null,
      warnings: [],
      pendingMovementId: null,
      errorText: null,
      processingPhase: null,
    }));
    setRows((current) => [...current, ...newRows]);

    await Promise.all(newRows.map((row) => processRow(source, row)));

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
      queryClient.invalidateQueries({ queryKey: ["pending-movements", "summary"] }),
    ]);
  }

  async function pickFromGallery() {
    setPhase("opening");
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error(t("capture.errors.permissionDenied"));
      router.back();
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: MAX_CAPTURE_BATCH_SIZE,
    });
    if (result.canceled || result.assets.length === 0) {
      router.back();
      return;
    }
    await processUris(
      "gallery",
      result.assets.map((asset) => asset.uri),
    );
  }

  async function addMoreImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error(t("capture.errors.permissionDenied"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: MAX_CAPTURE_BATCH_SIZE,
    });
    if (result.canceled || result.assets.length === 0) return;
    await processUris(
      "gallery",
      result.assets.map((asset) => asset.uri),
    );
  }

  const isProcessing = rows.some((row) => row.status === "queued" || row.status === "processing");
  const createdCount = rows.filter((row) => row.status === "created").length;
  const duplicateCount = rows.filter((row) => row.status === "duplicate").length;
  const unrecognizedCount = rows.filter((row) => row.status === "unrecognized").length;
  const failedCount = rows.filter((row) => row.status === "failed").length;

  // Solo 'created' pide dirección: un 'duplicate' apunta al pendiente que ya
  // existía de una captura anterior, que puede no seguir en estado 'pending'
  // (ya confirmado, ya descartado) — reintentar set-type ahí da 409.
  const undeterminedRows = rows.filter((row) => row.status === "created" && row.pendingMovementId && row.warnings.includes("direction_undetermined"));
  const needsAnswers = undeterminedRows.length > 0;
  const allAnswered = undeterminedRows.every((row) => directionAnswers[row.clientCaptureId]);

  const finishMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(
        undeterminedRows.map((row) => {
          const type = directionAnswers[row.clientCaptureId];
          if (!type || !row.pendingMovementId) return Promise.resolve();
          return financeApi.setPendingMovementType(row.pendingMovementId, { type });
        }),
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
        queryClient.invalidateQueries({ queryKey: ["pending-movements", "summary"] }),
      ]);
      router.replace("/pending-movements");
    },
    onError: (error) => toast.error(t("capture.errors.saveFailed"), { message: error instanceof Error ? error.message : undefined }),
  });

  const deleteRowMutation = useMutation({
    mutationFn: async (row: CaptureRow) => {
      if (row.status === "created" && row.pendingMovementId) {
        await financeApi.discardPendingMovement(row.pendingMovementId, { reason: "capture_review" });
      }
    },
    onSuccess: async (_data, row) => {
      deletedIdsRef.current.add(row.clientCaptureId);
      let remaining = 0;
      setRows((current) => {
        const next = current.filter((r) => r.clientCaptureId !== row.clientCaptureId);
        remaining = next.length;
        return next;
      });
      setDirectionAnswers((current) => {
        if (!(row.clientCaptureId in current)) return current;
        const next = { ...current };
        delete next[row.clientCaptureId];
        return next;
      });
      setDeleteTarget(null);
      if (row.status === "created" && row.pendingMovementId) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["pending-movements"] }),
          queryClient.invalidateQueries({ queryKey: ["pending-movements", "summary"] }),
        ]);
      }
      // Sin filas no hay nada que guardar — no tiene sentido dejar al usuario
      // parado frente a un botón "Listo" que no hace nada.
      if (remaining === 0) router.back();
    },
    onError: (error) => toast.error(t("capture.errors.deleteFailed"), { message: error instanceof Error ? error.message : undefined }),
  });

  const finish = () => {
    if (needsAnswers) finishMutation.mutate();
    else router.replace("/pending-movements");
  };

  const busy = isProcessing || deleteRowMutation.isPending || finishMutation.isPending;

  return (
    <StackFrame title={phase === "opening" ? "" : t("capture.title")}>
      {phase === "opening" ? (
        <YStack flex={1} items="center" justify="center" gap={space[3]}>
          <FintSpinner color="$brand" />
          <FText variant="label" tone="inkMuted">
            {t("capture.opening")}
          </FText>
        </YStack>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[6] }}
            showsVerticalScrollIndicator={false}
          >
            {/* Resumen: el estado, las cifras y "Agregar más". */}
            <FintCard p={space[5]} items="center" gap={space[3]}>
              <View width={56} height={56} rounded={999} bg={isProcessing ? "$brandWash" : "$surfaceSunken"} items="center" justify="center">
                {isProcessing ? <FintSpinner color="$brand" /> : <CheckCircle2 size={26} color="$flowIn" strokeWidth={2} />}
              </View>
              <FText variant="heading" style={{ textAlign: "center" }}>
                {isProcessing ? t("capture.summaryWorking") : t("capture.resultTitle")}
              </FText>
              <XStack gap={8} flexWrap="wrap" justify="center">
                <Stat label={t("capture.created")} value={createdCount} tone="flowIn" />
                <Stat label={t("capture.duplicates")} value={duplicateCount} />
                {unrecognizedCount > 0 ? <Stat label={t("capture.unrecognized")} value={unrecognizedCount} /> : null}
                {failedCount > 0 ? <Stat label={t("capture.failed")} value={failedCount} tone="dangerHard" /> : null}
              </XStack>
              <View self="stretch" mt={4}>
                <FintButton variant="outlined" disabled={busy} icon={<Plus size={16} color="$ink" />} onPress={addMoreImages}>
                  {t("capture.addMore")}
                </FintButton>
              </View>
            </FintCard>

            <YStack mt={space[4]}>
              {rows.map((row, i) => (
                <CaptureRowItem
                  key={row.clientCaptureId}
                  row={row}
                  first={i === 0}
                  last={i === rows.length - 1}
                  locale={locale}
                  selectedType={directionAnswers[row.clientCaptureId]}
                  onSelectType={(type) => setDirectionAnswers((current) => ({ ...current, [row.clientCaptureId]: type }))}
                  onRequestDelete={setDeleteTarget}
                />
              ))}
            </YStack>
          </ScrollView>

          <View px={space[4]} pt={space[3]} pb={Math.max(insets.bottom, 16) + 10} bg="$canvas">
            <FintButton
              disabled={isProcessing || (needsAnswers && !allAnswered) || finishMutation.isPending || deleteRowMutation.isPending}
              onPress={finish}
            >
              {finishMutation.isPending ? <FintSpinner color="$onBrand" /> : needsAnswers ? t("capture.save") : t("capture.done")}
            </FintButton>
          </View>
        </>
      )}

      <DeleteRowSheet
        row={deleteTarget}
        isPending={deleteRowMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteRowMutation.mutate(deleteTarget)}
      />
    </StackFrame>
  );
}

function Stat({ label, value, tone = "ink" }: { label: string; value: number; tone?: "ink" | "flowIn" | "dangerHard" }) {
  return (
    <XStack items="center" gap={6} height={30} px={12} rounded={radius.pill} bg="$surfaceSunken">
      <FText tone={tone} style={{ ...textStyles["amount-sm"], fontFamily: fontFace.mono[600] }}>
        {value}
      </FText>
      <FText variant="caption" tone="inkMuted">
        {label}
      </FText>
    </XStack>
  );
}

function useRotatingText(active: boolean): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const interval = setInterval(() => setIndex((current) => (current + 1) % ROTATING_TEXT_KEYS.length), ROTATING_TEXT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  return index;
}

/** El estado de una imagen en el disco de 38px: en cola, leyendo, creada, repetida, no reconocida o con error. */
function statusIcon(row: CaptureRow): ReactNode {
  switch (row.status) {
    case "queued":
      return <Clock size={18} color="$inkFaint" strokeWidth={2} />;
    case "processing":
      return <FintSpinner color="$brand" />;
    case "created":
      return <CheckCircle2 size={18} color="$flowIn" strokeWidth={2} />;
    case "duplicate":
      return <History size={18} color="$inkFaint" strokeWidth={2} />;
    case "unrecognized":
      return <AlertTriangle size={18} color="$inkMuted" strokeWidth={2} />;
    case "failed":
      return <AlertTriangle size={18} color="$dangerHard" strokeWidth={2} />;
  }
}

function subtitleFor(row: CaptureRow, locale: string, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (row.status !== "created" && row.status !== "duplicate") return null;
  const parts: string[] = [];
  if (row.preview?.occurredAt) parts.push(formatDateString(row.preview.occurredAt, locale));
  if (row.status === "duplicate") parts.push(t("capture.rowDuplicate"));
  else if (row.preview?.recipientName) parts.push(row.preview.recipientName);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function CaptureRowItem({
  row,
  first,
  last,
  locale,
  selectedType,
  onSelectType,
  onRequestDelete,
}: {
  row: CaptureRow;
  first: boolean;
  last: boolean;
  locale: string;
  selectedType: TransactionType | undefined;
  onSelectType: (type: TransactionType) => void;
  onRequestDelete: (row: CaptureRow) => void;
}) {
  const { t } = useTranslation();
  const rotatingIndex = useRotatingText(row.status === "processing");
  const canDelete = row.status !== "processing";
  const needsAnswer = row.status === "created" && Boolean(row.pendingMovementId) && row.warnings.includes("direction_undetermined");
  const progress = row.processingPhase ? PHASE_PROGRESS[row.processingPhase] : 0;

  const titleText =
    row.status === "queued"
      ? t("capture.rowQueued")
      : row.status === "processing"
        ? t(ROTATING_TEXT_KEYS[rotatingIndex]!)
        : row.status === "failed"
          ? (row.errorText ?? t("capture.errors.unknown"))
          : row.status === "unrecognized"
            ? t("capture.rowUnrecognized")
            : (row.preview?.title ?? row.bank ?? "—");
  const subtitleText = subtitleFor(row, locale, t);
  const showAmount = row.preview?.amount != null && (row.status === "created" || row.status === "duplicate");
  const kind = row.preview?.type === "income" ? "income" : row.preview?.type === "expense" ? "expense" : "neutral";
  const actions: SwipeAction[] = [
    { key: "delete", label: t("capture.deleteRow"), icon: <Trash2 size={18} color="$onDanger" />, tone: "danger", run: () => onRequestDelete(row) },
  ];

  const content = (
    <YStack px={space[4]} py={12} gap={10} bg="$surface">
      <XStack items="center" gap={space[3]}>
        <View width={38} height={38} rounded={999} bg="$surfaceSunken" items="center" justify="center">
          {statusIcon(row)}
        </View>
        <YStack flex={1} minW={0}>
          <FText variant="body-strong" tone={row.status === "failed" ? "dangerHard" : "ink"} numberOfLines={1}>
            {titleText}
          </FText>
          {subtitleText ? (
            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
              {subtitleText}
            </FText>
          ) : null}
        </YStack>
        {row.status === "processing" ? (
          <FText variant="amount-sm" tone="inkMuted">{`${Math.round(progress * 100)}%`}</FText>
        ) : showAmount ? (
          <Amount value={row.preview!.amount!} currency={row.preview?.currency ?? "PEN"} kind={kind} />
        ) : null}
        {/* Respaldo del deslizar: el tacho en inkFaint. */}
        {canDelete ? (
          <Pressable onPress={() => onRequestDelete(row)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("capture.deleteRow")}>
            <Trash2 size={16} color="$inkFaint" strokeWidth={2} />
          </Pressable>
        ) : null}
      </XStack>

      {row.status === "processing" ? (
        <View height={4} rounded={999} bg="$chartTrack" overflow="hidden">
          <View height={4} width={`${progress * 100}%`} rounded={999} bg="$brand" />
        </View>
      ) : null}

      {needsAnswer ? (
        <YStack gap={8}>
          <FText variant="caption" tone="inkMuted" style={{ fontFamily: fontFace.sans[600] }}>
            {t("capture.whoDidThis")}
          </FText>
          <XStack gap={8}>
            <DirectionChoice selected={selectedType === "income"} label={t("capture.iWasPaid")} onPress={() => onSelectType("income")} />
            <DirectionChoice selected={selectedType === "expense"} label={t("capture.iPaid")} onPress={() => onSelectType("expense")} />
          </XStack>
        </YStack>
      ) : null}
    </YStack>
  );

  return (
    <GroupedCell first={first} last={last}>
      {canDelete ? <SwipeActions actions={actions}>{content}</SwipeActions> : content}
    </GroupedCell>
  );
}

/** "Me pagaron" | "Yo pagué": ficha de elección, la elegida en brandWash con filete brand. Sin colores de ingreso o egreso. */
function DirectionChoice({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <PressableScale style={{ flex: 1 }} onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View
        height={44}
        rounded={radius.md}
        items="center"
        justify="center"
        bg={selected ? "$brandWash" : "$surfaceSunken"}
        borderWidth={selected ? 1.5 : 1}
        borderColor={selected ? "$brand" : "$line"}
      >
        <FText variant="label" style={{ fontFamily: fontFace.sans[selected ? 600 : 500] }}>
          {label}
        </FText>
      </View>
    </PressableScale>
  );
}

function DeleteRowSheet({
  row,
  isPending,
  onCancel,
  onConfirm,
}: {
  row: CaptureRow | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [shown, setShown] = useState<CaptureRow | null>(row);
  useEffect(() => {
    if (row) setShown(row);
  }, [row]);
  const willDiscardPending = shown?.status === "created" && Boolean(shown.pendingMovementId);
  return (
    <FintSheet open={Boolean(row)} onClose={() => !isPending && onCancel()}>
      <YStack items="center" px={space[5]} pt={space[4]}>
        <View width={56} height={56} rounded={999} bg="$red2" items="center" justify="center">
          <Trash2 size={24} color="$dangerHard" strokeWidth={2} />
        </View>
        <FText variant="title" style={{ fontSize: 22, lineHeight: 28, marginTop: 14, textAlign: "center" }}>
          {t("capture.deleteRowTitle")}
        </FText>
        <FText tone="inkMuted" style={{ fontSize: 14, lineHeight: 21, marginTop: 6, textAlign: "center" }}>
          {t(willDiscardPending ? "capture.deleteRowDescriptionCreated" : "capture.deleteRowDescription")}
        </FText>
        <YStack self="stretch" gap={10} mt={22}>
          <FintButton variant="danger" haptic="warning" disabled={isPending} onPress={onConfirm}>
            {isPending ? <FintSpinner color="$onDanger" /> : t("capture.deleteRowConfirm")}
          </FintButton>
          <FintButton variant="ghost" bg="$surfaceSunken" color="$ink" disabled={isPending} onPress={onCancel}>
            {t("actions.cancel")}
          </FintButton>
        </YStack>
      </YStack>
    </FintSheet>
  );
}
