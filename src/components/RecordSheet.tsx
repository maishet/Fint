import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronRight, Download, HelpCircle, Inbox, Mail, RefreshCw, Settings, Tag, Upload } from "@tamagui/lucide-icons-2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../api/finance";
import { getAppLocale } from "../i18n";
import { gmailSummary, syncAgo } from "../settings/logic";
import { withAlpha } from "../theme/color";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { isComingSoon, isHidden } from "../config/comingSoon";
import { FintSheet, FText, ListRow, PressableScale, SoonBadge, useNotify } from "../ui";
import { haptics } from "../ui/haptics";

/** Lo que tarda la hoja en bajar antes de abrir el formulario. */
const SHEET_OUT_MS = 220;

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * La hoja del botón central: Egreso, Ingreso y Transferencia, en ese orden,
 * que es el de frecuencia real. Es siempre la misma hoja, desde cualquier tab.
 */
export function RecordSheet({ open, onClose }: SheetProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // La opción elegida queda marcada hasta que la hoja se cierra: el formulario tarda en montarse y, sin esa marca,
  // parecía que el toque no había llegado y se volvía a tocar.
  const [chosen, setChosen] = useState<"expense" | "income" | "transfer" | null>(null);
  useEffect(() => {
    if (open) setChosen(null);
  }, [open]);

  // La hoja baja primero y luego el formulario crece desde el botón central (`origin: "fab"`). El montaje del
  // formulario ocupa JS y la bajada de la hoja se programa desde JS: si se pedían en el mismo toque (o un cuadro
  // después), la hoja no arrancaba hasta que el formulario terminaba de montarse y quedaba encima de él.
  const go = (type: "expense" | "income" | "transfer") => {
    if (chosen) return;
    setChosen(type);
    onClose();
    setTimeout(() => router.push({ pathname: "/transaction-form", params: { type, origin: "fab" } }), SHEET_OUT_MS);
  };

  return (
    <FintSheet open={open} onClose={onClose} title={t("home.record.title")} titleSize="compact">
      <YStack px={space[4]} pt={space[3]} gap={4}>
        <Option
          icon={<ArrowDown size={20} color="$flowOut" strokeWidth={2} />}
          title={t("home.record.expense")}
          hint={t("home.record.expenseHint")}
          selected={chosen === "expense"}
          onPress={() => go("expense")}
        />
        <Option
          icon={<ArrowUp size={20} color="$flowIn" strokeWidth={2} />}
          title={t("home.record.income")}
          hint={t("home.record.incomeHint")}
          selected={chosen === "income"}
          onPress={() => go("income")}
        />
        <Option
          icon={<ArrowLeftRight size={20} color="$inkMuted" strokeWidth={2} />}
          title={t("home.record.transfer")}
          hint={t("home.record.transferHint")}
          selected={chosen === "transfer"}
          onPress={() => go("transfer")}
        />
      </YStack>
    </FintSheet>
  );
}

/**
 * Una opción de la hoja: sin borde; al presionar, el fondo pasa a `surfaceSunken` con la curva `press`. Elegida
 * (`selected`), el fondo se queda mientras se abre el formulario.
 */
function Option({ icon, title, hint, selected, onPress }: { icon: ReactNode; title: string; hint: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const from = "rgba(0,0,0,0)";
  const to = theme.surfaceSunken.val;
  const bgStyle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(pressed.value, [0, 1], [from, to]) }));

  useEffect(() => {
    if (!selected) pressed.value = withTiming(0, motion.fade);
  }, [pressed, selected]);

  return (
    <Pressable
      onPress={() => {
        // `onPressOut` ya empezó a apagar el fondo: se vuelve a encender porque la opción queda elegida.
        pressed.value = withTiming(1, motion.press);
        onPress();
      }}
      onPressIn={() => {
        pressed.value = withTiming(1, motion.press);
        haptics.tap();
      }}
      onPressOut={() => {
        if (!selected) pressed.value = withTiming(0, motion.fade);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
    >
      <Animated.View style={[{ borderRadius: radius.md }, bgStyle]}>
        <XStack items="center" gap={14} px={space[3]} py={13}>
          <View width={40} height={40} rounded={radius.md} bg="$surfaceSunken" items="center" justify="center">
            {icon}
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="body-strong">{title}</FText>
            <FText variant="caption" tone="inkFaint" numberOfLines={1}>
              {hint}
            </FText>
          </YStack>
        </XStack>
      </Animated.View>
    </Pressable>
  );
}

/**
 * La acción "Más" del hero (`HojaMas`), en tres niveles: accesos grandes para lo que se viene a hacer (Transferir,
 * Importar, Categorías), lo que espera a la persona con su número y su acción (Por revisar, el estado de Gmail) y
 * una lista corta para lo que se visita poco. Todo sale de consultas que la app ya tiene; lo que todavía carga no
 * se muestra (sin esqueletos dentro de una hoja).
 */
export function MoreSheet({ open, onClose }: SheetProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const pendingQuery = useQuery({ queryKey: ["pending-movements", "summary"], queryFn: financeApi.getPendingMovementsSummary, enabled: open });
  const categoriesQuery = useQuery({ queryKey: ["categories"], queryFn: () => financeApi.listCategories(), enabled: open });
  const sourcesQuery = useQuery({ queryKey: ["gmail-sources"], queryFn: financeApi.listGmailSources, enabled: open });

  // Lo que dejó la última lectura hecha desde aquí ("Leído ahora · 3 nuevos").
  const [readResult, setReadResult] = useState<number | null>(null);
  const readMutation = useMutation({
    mutationFn: async () => {
      let created = 0;
      for (const source of (sourcesQuery.data ?? []).filter((s) => s.status === "active")) {
        created += (await financeApi.syncGmailSource(source.id)).created;
      }
      return created;
    },
    onSuccess: (created) => {
      setReadResult(created);
      void queryClient.invalidateQueries({ queryKey: ["pending-movements"] });
      void queryClient.invalidateQueries({ queryKey: ["gmail-sources"] });
    },
    onError: (error) => notify.error(t("states.error"), { message: error instanceof Error ? error.message : undefined }),
  });

  // La hoja baja antes de navegar, como la de registro: si no, queda encima de la pantalla que se abre.
  const go = (href: Href) => {
    onClose();
    setTimeout(() => router.push(href), SHEET_OUT_MS);
  };

  const pending = pendingQuery.data?.count ?? 0;
  const gmail = sourcesQuery.data ? gmailSummary(sourcesQuery.data) : null;
  const locale = getAppLocale(i18n.resolvedLanguage);
  const readWhen = (iso: string) => {
    const ago = syncAgo(iso, new Date());
    if (ago.unit === "date") return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
    if (ago.unit === "minutes" || ago.unit === "hours") return t(`home.more.ago.${ago.unit}`, { count: ago.count });
    return t(`home.more.ago.${ago.unit}`);
  };
  const gmailLine = !gmail
    ? ""
    : gmail.state === "none"
      ? t("home.more.gmailPitch")
      : gmail.state === "reconnect"
        ? t("home.more.gmailReconnectBody")
        : readMutation.isPending
          ? t("home.more.gmailReading")
          : readResult !== null
            ? t("home.more.gmailReadResult", { count: readResult })
            : gmail.lastSyncAt
              ? t("home.more.gmailRead", { when: readWhen(gmail.lastSyncAt) })
              : t("home.more.gmailNever");

  const cards: { key: string; node: ReactNode }[] = [
    {
      key: "tiles",
      node: (
        <XStack gap={8} px={space[4]} mt={space[4]}>
          <ActionTile
            icon={ArrowLeftRight}
            color={theme.brand.val}
            title={t("home.more.transfer")}
            detail={t("home.more.transferHint")}
            onPress={() => go({ pathname: "/transaction-form", params: { type: "transfer" } })}
          />
          {isHidden("csvImport") ? null : (
            <ActionTile icon={Upload} color={theme.chart4.val} title={t("home.more.import")} detail={t("home.more.importHint")} onPress={() => go("/import-transactions")} />
          )}
          <ActionTile
            icon={Tag}
            color={theme.chart3.val}
            title={t("home.more.categories")}
            detail={categoriesQuery.data ? t("home.more.categoriesCount", { count: categoriesQuery.data.length }) : ""}
            mono
            onPress={() => go("/categories")}
          />
        </XStack>
      ),
    },
  ];

  // Por revisar solo si hay algo esperando: la hoja no muestra un "0".
  if (pending > 0) {
    cards.push({
      key: "review",
      node: (
        <XStack mx={space[4]} mt={10} rounded={radius.lg} bg="$brandWash" py={12} pl={14} pr={12} items="center" gap={12}>
          <View width={40} height={40} rounded={radius.pill} bg="$brand" items="center" justify="center">
            <Inbox size={18} color="$onBrand" strokeWidth={2} />
            <View position="absolute" t={-4} r={-6} minW={20} height={20} px={5} rounded={radius.pill} bg="$surfaceOverlay" items="center" justify="center">
              <FText tone="brand" style={{ fontFamily: fontFace.mono[600], fontSize: 11, lineHeight: 14 }}>
                {pending > 99 ? "99+" : String(pending)}
              </FText>
            </View>
          </View>
          <YStack flex={1} minW={0}>
            <FText variant="body-strong" style={{ letterSpacing: -0.15 }}>
              {t("home.more.review")}
            </FText>
            <FText variant="caption" tone="inkMuted">
              {t("home.more.reviewBody", { count: pending })}
            </FText>
          </YStack>
          <SmallButton label={t("home.more.reviewAction")} onPress={() => go("/pending-movements")} />
        </XStack>
      ),
    });
  }

  if (gmail) {
    const tone = gmail.state === "connected" ? "flowIn" : gmail.state === "reconnect" ? "dangerHard" : "inkFaint";
    cards.push({
      key: "gmail",
      node: (
        <XStack mx={space[4]} mt={10} rounded={radius.lg} bg="$surface" borderWidth={1} borderColor="$line" py={12} pl={14} pr={12} items="center" gap={12}>
          <View width={40} height={40} rounded={radius.md} items="center" justify="center" style={{ backgroundColor: withAlpha(theme.chart2.val, 0.14) }}>
            <Mail size={18} color={theme.chart2.val as never} strokeWidth={2} />
          </View>
          <YStack flex={1} minW={0}>
            <XStack items="center" gap={8}>
              <FText variant="body-strong" style={{ letterSpacing: -0.15 }}>
                {t("home.more.gmail")}
              </FText>
              <XStack items="center" gap={5}>
                <View width={6} height={6} rounded={radius.pill} bg={`$${tone}`} />
                <FText tone={tone} style={{ fontFamily: fontFace.sans[600], fontSize: 11, lineHeight: 14 }}>
                  {t(gmail.state === "connected" ? "home.more.gmailConnected" : gmail.state === "reconnect" ? "home.more.gmailReconnect" : "home.more.gmailOff")}
                </FText>
              </XStack>
            </XStack>
            {/* La línea de estado cambia con `fade` (leyendo, lo que trajo la lectura). */}
            <Animated.View key={gmailLine} entering={FadeIn.duration(motion.fade.duration)}>
              <FText variant="caption" tone="inkFaint" numberOfLines={1}>
                {gmailLine}
              </FText>
            </Animated.View>
          </YStack>
          {isComingSoon("gmail") ? (
            <SoonBadge />
          ) : gmail.state === "connected" ? (
            <ReadNowButton label={t("home.more.gmailReadNow")} busy={readMutation.isPending} onPress={() => readMutation.mutate()} />
          ) : (
            <SmallButton label={t(gmail.state === "reconnect" ? "home.more.gmailReconnect" : "home.more.gmailConnect")} onPress={() => go("/gmail-settings")} />
          )}
        </XStack>
      ),
    });
  }

  const rows: { icon: typeof Download; label: string; aside?: string; href: Href; soon?: boolean }[] = [
    {
      icon: Download,
      label: t("home.more.export"),
      aside: t("home.more.exportHint"),
      href: { pathname: "/(tabs)/reports", params: { open: "export" } },
      soon: isComingSoon("reportExport"),
    },
    { icon: Settings, label: t("home.more.settings"), href: "/settings" },
    { icon: HelpCircle, label: t("home.more.help"), href: "/support" },
  ];
  cards.push({
    key: "list",
    node: (
      <YStack mx={space[4]} mt={10} rounded={radius.lg} borderWidth={1} borderColor="$line" bg="$surface" overflow="hidden">
        {rows.map((row, i) => (
          <ListRow
            key={row.label}
            divider={i > 0}
            title={row.label}
            leading={
              <View width={32} height={32} rounded={radius.sm} bg="$surfaceSunken" items="center" justify="center">
                <row.icon size={17} color="$inkMuted" strokeWidth={1.8} />
              </View>
            }
            trailing={
              row.soon ? (
                <SoonBadge />
              ) : (
              <XStack items="center" gap={4}>
                {row.aside ? (
                  <FText variant="caption" tone="inkFaint">
                    {row.aside}
                  </FText>
                ) : null}
                <ChevronRight size={16} color="$inkFaint" />
              </XStack>
              )
            }
            // "Pronto": se ve, pero no abre nada.
            onPress={row.soon ? undefined : () => go(row.href)}
            accessibilityLabel={row.soon ? `${row.label}. ${t("comingSoon.hint")}` : undefined}
          />
        ))}
      </YStack>
    ),
  });

  return (
    <FintSheet open={open} onClose={onClose} title={t("home.more.title")}>
      {cards.map((card, i) => (
        // Las tarjetas entran con `fade` escalonado de 30ms.
        <Animated.View key={card.key} entering={FadeIn.delay(i * 30).duration(motion.fade.duration)}>
          {card.node}
        </Animated.View>
      ))}
    </FintSheet>
  );
}

/** Un acceso grande de la hoja Más: icono en un círculo teñido al 14 % de su color, nombre y una línea. */
function ActionTile({
  icon: Icon,
  color,
  title,
  detail,
  mono,
  onPress,
}: {
  icon: typeof Download;
  color: string;
  title: string;
  detail: string;
  mono?: boolean;
  onPress: () => void;
}) {
  const { themeMode } = useThemeMode();
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={detail ? `${title}. ${detail}` : title} style={{ flex: 1 }}>
      <YStack minH={96} p={12} gap={10} rounded={radius.lg} bg="$surfaceSunken" borderWidth={themeMode === "dark" ? 1 : 0} borderColor="$line">
        <View width={36} height={36} rounded={radius.pill} items="center" justify="center" style={{ backgroundColor: withAlpha(color, 0.14) }}>
          <Icon size={17} color={color as never} strokeWidth={2} />
        </View>
        <YStack>
          <FText numberOfLines={1} style={{ fontFamily: fontFace.sans[600], fontSize: 14, lineHeight: 18, letterSpacing: -0.15 }}>
            {title}
          </FText>
          <FText
            tone="inkFaint"
            numberOfLines={2}
            style={{ fontFamily: mono ? fontFace.mono[400] : fontFace.sans[400], fontSize: 11.5, lineHeight: 15, marginTop: 1 }}
          >
            {detail}
          </FText>
        </YStack>
      </YStack>
    </PressableScale>
  );
}

/** Botón chico en `brand` de las tarjetas (Revisar, Conectar, Reconectar). */
function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button">
      <XStack height={34} px={14} rounded={radius.pill} bg="$brand" items="center">
        <FText tone="onBrand" style={{ fontFamily: fontFace.sans[600], fontSize: 13, lineHeight: 18 }}>
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}

/** Leer ahora: un botón redondo cuyo icono gira mientras dura la sincronización. */
function ReadNowButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (busy) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(turn);
      turn.value = 0;
    }
  }, [busy, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <PressableScale onPress={onPress} disabled={busy} haptic="tap" accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }}>
      <View width={36} height={36} rounded={radius.pill} bg="$surfaceSunken" items="center" justify="center">
        <Animated.View style={spin}>
          <RefreshCw size={16} color="$ink" strokeWidth={2} />
        </Animated.View>
      </View>
    </PressableScale>
  );
}
