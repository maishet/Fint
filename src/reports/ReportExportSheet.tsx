import * as Sentry from "@sentry/react-native";
import { Check, ChevronRight, Eye, Info, Share2 } from "@tamagui/lucide-icons-2";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, findNodeHandle, View as RNView } from "react-native";
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { View, XStack, YStack } from "tamagui";
import type { FinancialReport } from "../api/types";
import {
  discardReportFile,
  draftReport,
  openReportFile,
  shareReportFile,
  writeReportFile,
  type ReportDraft,
  type ReportExportOptions,
  type ReportFile,
  type ReportFormat,
} from "../finance/report-export";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { FintButton, FintCard, FintSheet, FText, PressableScale } from "../ui";
import { haptics } from "../ui/haptics";
import { formatFileSize } from "./logic";
import { FileIcon, ReportDocument } from "./ReportDocument";

/** Si todo tarda menos que esto, no se muestra "Generando": se pasa directo a "Listo". */
const REVEAL_MS = 600;
/** Desde aquí, "Está tardando más de lo normal". */
const SLOW_MS = 10_000;

type Phase = "pick" | "working" | "ready" | "error";

interface ReportExportSheetProps {
  open: boolean;
  onClose: () => void;
  /** Qué se descarga: "Setiembre 2026 · Todas las cuentas · Sol peruano". */
  subtitle: string;
  /** Movimientos del periodo que se ve, para "Incluye los 142 movimientos…". */
  transactionCount: number;
  /** El nombre del archivo sin extensión ("My Fint · Setiembre 2026"). */
  fileBaseName: string;
  locale: string;
  /** Etapa 1: traer los datos del reporte (ya traducidos). */
  prepare: () => Promise<FinancialReport>;
  options: () => ReportExportOptions;
}

/**
 * La descarga del reporte (`CargaReporte`): una sola hoja con tres estados. Elegir el formato (PDF o Excel), ver cómo
 * se arma el documento con las etapas reales (reunir, dibujar u ordenar, crear el archivo) y recibir el archivo con
 * "Ver" y "Compartir". Si falla, la etapa se marca y "Reintentar" sigue desde ahí; "Cancelar" descarta y vuelve a
 * elegir. Compartir ya no se abre solo: es el botón de "Listo".
 */
export function ReportExportSheet({ open, onClose, subtitle, transactionCount, fileBaseName, locale, prepare, options }: ReportExportSheetProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("pick");
  const [format, setFormat] = useState<ReportFormat>("pdf");
  const [stage, setStage] = useState(0);
  const [counts, setCounts] = useState<Array<string | undefined>>([]);
  const [file, setFile] = useState<ReportFile | null>(null);
  const [revealed, setRevealed] = useState(true);
  const [slow, setSlow] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Lo que ya se hizo, para reintentar desde la etapa que falló o descargar el otro formato sin volver a pedir datos.
  const cache = useRef<{ report?: FinancialReport; draft?: ReportDraft }>({});
  const runId = useRef(0);
  // Lo que se ve mientras "Generando" todavía no aparece: la hoja de la que se partió.
  const [behind, setBehind] = useState<"pick" | "ready">("pick");
  const shareRef = useRef<RNView>(null);

  // Cada vez que se abre, empieza en elegir el formato y con datos nuevos.
  useEffect(() => {
    if (!open) return;
    runId.current++;
    cache.current = {};
    setPhase("pick");
    setFile(null);
    setNotice(null);
    setRevealed(true);
  }, [open]);

  const run = async (next: ReportFormat, from = 0) => {
    const id = ++runId.current;
    const alive = () => runId.current === id;
    // Desde "Elegir" o "Listo", "Generando" aparece recién a los 600 ms; al reintentar ya está a la vista.
    const reveal = phase === "error" ? null : setTimeout(() => alive() && setRevealed(true), REVEAL_MS);
    const slowTimer = setTimeout(() => alive() && setSlow(true), SLOW_MS);
    setRevealed(phase === "error");
    if (phase !== "error") setBehind(phase === "ready" ? "ready" : "pick");
    setSlow(false);
    setNotice(null);
    setFormat(next);
    setPhase("working");
    if (from === 0) setCounts([]);
    let step = from;
    let created: ReportFile | null = null;
    try {
      setStage(0);
      const report = cache.current.report ?? (await prepare());
      if (!alive()) return;
      cache.current.report = report;
      const gathered = String(report.summary.transactionCount);
      step = 1;
      setStage(1);
      setCounts([gathered]);
      const draft = cache.current.draft?.format === next && from === 2 ? cache.current.draft : await draftReport(report, next, options());
      if (!alive()) return;
      cache.current.draft = draft;
      step = 2;
      setStage(2);
      setCounts([gathered, next === "xlsx" ? String(report.categories.length) : undefined]);
      created = await writeReportFile(report, draft, fileBaseName);
      if (!alive()) {
        discardReportFile(created);
        return;
      }
      setFile(created);
      setStage(3);
      setPhase("ready");
      haptics.success();
    } catch (error) {
      if (!alive()) return;
      Sentry.captureException(error, { tags: { operation: `report_export_${next}`, stage: String(step) } });
      discardReportFile(created);
      setStage(step);
      setRevealed(true);
      setPhase("error");
      haptics.warning();
    } finally {
      if (reveal) clearTimeout(reveal);
      clearTimeout(slowTimer);
    }
  };

  const cancel = () => {
    runId.current++;
    cache.current.draft = undefined;
    setPhase("pick");
    setRevealed(true);
  };

  const close = () => {
    // Cerrar mientras se genera es cancelar: lo que termine después se descarta.
    if (phase === "working") runId.current++;
    onClose();
  };

  // Lo que se ve: mientras "Generando" no se revela, sigue a la vista lo anterior (sin tocarse).
  const view: Phase = phase === "working" && !revealed ? behind : phase;

  // Al llegar a "Listo": se anuncia y el foco va a "Compartir".
  useEffect(() => {
    if (phase !== "ready") return;
    AccessibilityInfo.announceForAccessibility(t("reports.export.readyTitle"));
    const id = setTimeout(() => {
      const node = shareRef.current ? findNodeHandle(shareRef.current) : null;
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, 400);
    return () => clearTimeout(id);
  }, [phase, t]);

  const steps =
    format === "pdf"
      ? [t("reports.export.gather"), t("reports.export.charts"), t("reports.export.buildPdf")]
      : [t("reports.export.gather"), t("reports.export.sort"), t("reports.export.buildXlsx")];
  const errors = [t("reports.export.gatherError"), t("reports.export.buildError"), t("reports.export.writeError")];

  return (
    <FintSheet
      open={open}
      onClose={close}
      title={view === "ready" ? t("reports.export.readyTitle") : t("reports.export.title")}
      subtitle={subtitle}
      hideClose={view === "working"}
    >
      <Animated.View key={view} entering={FadeIn.duration(motion.fade.duration)} pointerEvents={phase === "working" && view !== "working" ? "none" : "auto"}>
        {view === "pick" ? (
          <YStack pt={16} gap={10}>
            <FormatCard
              format="pdf"
              name={t("reports.export.pdf")}
              body={t("reports.export.pdfBody")}
              includes={t("reports.export.pdfIncludes", { returnObjects: true }) as string[]}
              onPress={() => void run("pdf")}
            />
            <FormatCard
              format="xlsx"
              name={t("reports.export.xlsx")}
              body={t("reports.export.xlsxBody")}
              includes={t("reports.export.xlsxIncludes", { returnObjects: true }) as string[]}
              onPress={() => void run("xlsx")}
            />
            <XStack mx={20} mt={4} gap={6} items="center">
              <Info size={14} color="$inkFaint" strokeWidth={2} />
              <FText variant="caption" tone="inkFaint" style={{ flex: 1 }}>
                {t("reports.export.scope", { count: transactionCount })}
              </FText>
            </XStack>
          </YStack>
        ) : null}

        {view === "working" || view === "error" ? (
          <YStack>
            <YStack items="center" pt={18}>
              <ReportDocument format={format} paused={view === "error"} />
              <FText style={{ fontFamily: fontFace.display[600], fontSize: 20, lineHeight: 25, letterSpacing: -0.4, marginTop: 10 }}>
                {format === "pdf" ? t("reports.export.creatingPdf") : t("reports.export.creatingXlsx")}
              </FText>
              <FText tone="inkMuted" style={{ fontSize: 13, lineHeight: 18, marginTop: 4 }}>
                {t("reports.export.takesSeconds")}
              </FText>
            </YStack>
            <FintCard
              mx={space[4]}
              mt={18}
              p={0}
              py={6}
              accessibilityRole="progressbar"
              accessibilityLabel={view === "error" ? errors[stage] : steps[Math.min(stage, 2)]}
            >
              {steps.map((label, i) => (
                <StepRow
                  key={label}
                  label={label}
                  count={i < stage ? counts[i] : undefined}
                  state={i < stage ? "done" : i === stage ? (view === "error" ? "failed" : "current") : "todo"}
                  error={view === "error" && i === stage ? errors[i] : undefined}
                />
              ))}
            </FintCard>
            {slow && view === "working" ? (
              <FText variant="caption" tone="inkFaint" style={{ textAlign: "center", marginTop: 10 }} accessibilityLiveRegion="polite">
                {t("reports.export.slow")}
              </FText>
            ) : null}
            <View mx={space[4]} mt={14}>
              {view === "error" ? (
                <FintButton onPress={() => void run(format, stage)}>{t("reports.export.retry")}</FintButton>
              ) : (
                <FintButton variant="outlined" onPress={cancel}>
                  {t("reports.export.cancel")}
                </FintButton>
              )}
            </View>
          </YStack>
        ) : null}

        {view === "ready" && file ? (
          <YStack>
            <YStack items="center" pt={18}>
              <View>
                <FileIcon format={file.format} width={74} height={90} />
                <Animated.View entering={ZoomIn.springify().damping(motion.springGesture.damping).stiffness(motion.springGesture.stiffness).mass(motion.springGesture.mass)} style={{ position: "absolute", right: -8, bottom: -6 }}>
                  <View width={30} height={30} rounded={999} bg="$flowIn" borderWidth={3} borderColor="$surfaceOverlay" items="center" justify="center">
                    <Check size={15} color="$surfaceOverlay" strokeWidth={3} />
                  </View>
                </Animated.View>
              </View>
            </YStack>
            <FintCard mx={space[4]} mt={16} p={14}>
              <XStack gap={14} items="center">
                <FileIcon format={file.format} width={42} height={52} />
                <YStack flex={1} minW={0}>
                  <FText numberOfLines={1} style={{ fontFamily: fontFace.sans[600], fontSize: 15, lineHeight: 20, letterSpacing: -0.15 }}>
                    {file.name}
                  </FText>
                  <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[400], fontSize: 12, lineHeight: 16, marginTop: 2 }}>
                    {[file.pages ? t("reports.export.pages", { count: file.pages }) : null, formatFileSize(file.size, locale)].filter(Boolean).join(" · ")}
                  </FText>
                </YStack>
              </XStack>
            </FintCard>
            <XStack mx={space[4]} mt={14} gap={10}>
              <View flex={1}>
                <FintButton
                  variant="outlined"
                  icon={<Eye size={17} color="$ink" strokeWidth={2} />}
                  onPress={() => openReportFile(file, t("reports.exportTitle")).catch(() => setNotice(t("reports.export.openError")))}
                >
                  {t("reports.export.view")}
                </FintButton>
              </View>
              <RNView ref={shareRef} style={{ flex: 1 }} collapsable={false}>
                <FintButton
                  icon={<Share2 size={17} color="$onBrand" strokeWidth={2} />}
                  onPress={() => shareReportFile(file, t("reports.exportTitle")).catch(() => setNotice(t("reports.export.shareError")))}
                >
                  {t("reports.export.share")}
                </FintButton>
              </RNView>
            </XStack>
            {notice ? (
              <FText variant="caption" tone="inkMuted" style={{ textAlign: "center", marginTop: 10, marginHorizontal: space[4] }} accessibilityLiveRegion="polite">
                {notice}
              </FText>
            ) : null}
            <PressableScale onPress={() => void run(file.format === "pdf" ? "xlsx" : "pdf")} haptic="tap" accessibilityRole="button" style={{ alignSelf: "center", marginTop: 16 }} hitSlop={8}>
              <FText tone="brand" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
                {file.format === "pdf" ? t("reports.export.alsoXlsx") : t("reports.export.alsoPdf")}
              </FText>
            </PressableScale>
          </YStack>
        ) : null}
      </Animated.View>
    </FintSheet>
  );
}

function FormatCard({ format, name, body, includes, onPress }: { format: ReportFormat; name: string; body: string; includes: string[]; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={`${name}. ${body}`} style={{ marginHorizontal: space[4] }}>
      <FintCard p={14}>
        <XStack gap={14} items="flex-start">
          <FileIcon format={format} />
          <YStack flex={1} minW={0}>
            <FText style={{ fontFamily: fontFace.sans[600], fontSize: 16, lineHeight: 21, letterSpacing: -0.2 }}>{name}</FText>
            <FText tone="inkMuted" style={{ fontSize: 12.5, lineHeight: 17, marginTop: 2 }}>
              {body}
            </FText>
            <XStack flexWrap="wrap" gap={6} mt={8}>
              {includes.map((item) => (
                <View key={item} px={8} py={3} rounded={radius.pill} bg="$surfaceSunken">
                  <FText tone="inkMuted" style={{ fontFamily: fontFace.sans[500], fontSize: 11, lineHeight: 14 }}>
                    {item}
                  </FText>
                </View>
              ))}
            </XStack>
          </YStack>
          <View self="center">
            <ChevronRight size={16} color="$inkFaint" strokeWidth={2} />
          </View>
        </XStack>
      </FintCard>
    </PressableScale>
  );
}

/** Una etapa: hecha (check en `flowIn` y su número), la actual (punto `brand` que late), la que falló o pendiente. */
function StepRow({ label, count, state, error }: { label: string; count?: string; state: "done" | "current" | "failed" | "todo"; error?: string }) {
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (state !== "current" || reduceMotion) return;
    pulse.value = withRepeat(withSequence(withTiming(0.35, { duration: 600 }), withTiming(1, { duration: 600 })), -1, false);
  }, [pulse, reduceMotion, state]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value, transform: [{ scale: 0.8 + 0.2 * pulse.value }] }));

  return (
    <YStack px={14} py={9}>
      <XStack items="center" gap={12}>
        <View
          width={22}
          height={22}
          rounded={999}
          items="center"
          justify="center"
          borderWidth={1.5}
          borderColor={state === "done" ? "$flowIn" : state === "current" ? "$brand" : state === "failed" ? "$dangerHard" : "$lineStrong"}
          bg={state === "done" ? "$flowIn" : "transparent"}
        >
          {state === "done" ? <Check size={12} color="$surfaceOverlay" strokeWidth={3} /> : null}
          {state === "current" ? (
            <Animated.View style={[{ width: 8, height: 8, borderRadius: 4 }, dot]}>
              <View flex={1} rounded={4} bg="$brand" />
            </Animated.View>
          ) : null}
          {state === "failed" ? <View width={8} height={8} rounded={4} bg="$dangerHard" /> : null}
        </View>
        <FText
          tone={state === "done" ? "inkMuted" : state === "current" ? "ink" : state === "failed" ? "dangerHard" : "inkFaint"}
          style={{ flex: 1, fontSize: 14, lineHeight: 19, fontFamily: state === "current" || state === "failed" ? fontFace.sans[600] : fontFace.sans[400] }}
          accessibilityLiveRegion={state === "current" || state === "failed" ? "polite" : undefined}
        >
          {label}
        </FText>
        {count ? (
          <FText tone="inkFaint" style={{ fontFamily: fontFace.mono[500], fontSize: 12, lineHeight: 16 }}>
            {count}
          </FText>
        ) : null}
      </XStack>
      {error ? (
        <FText tone="dangerHard" style={{ fontSize: 12.5, lineHeight: 17, marginTop: 4, marginLeft: 34 }}>
          {error}
        </FText>
      ) : null}
    </YStack>
  );
}
