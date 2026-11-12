import { ArrowDown, ArrowLeftRight, ArrowUp, ChevronRight, Download, HelpCircle, Inbox, Mail, RefreshCw, Settings, Tag, Upload } from "@tamagui/lucide-icons-2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { View, XStack, YStack, useTheme } from "tamagui";
import { financeApi } from "../api/finance";
import { getAppLocale } from "../i18n";
import { gmailSummary, syncAgo } from "../settings/logic";
import { withAlpha } from "../theme/color";
import { useThemeMode } from "../theme/ThemeMode";
import { motion, radius, space } from "../theme/tokens";
import { fontFace } from "../theme/typography";
import { isComingSoon, isHidden } from "../config/comingSoon";
import { FintSheet, FText, ListRow, PressableScale, SHEET_OUT_MS, SoonBadge, useComingSoon, useNotify } from "../ui";
import { haptics } from "../ui/haptics";

interface SheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * La hoja del botón central (marca D, con el lenguaje de la hoja Más): Egreso, lo que más se registra, como acceso
 * grande en amarillo a todo el ancho, y debajo Ingreso y Transferencia en dos accesos `surface`. Es siempre la misma
 * hoja, desde cualquier tab.
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
    <FintSheet open={open} onClose={onClose} title={t("home.record.title")}>
      <YStack px={space[5]} pt={space[2]} gap={10}>
        <KindTile
          primary
          icon={<ArrowDown size={22} color="$slabInk" strokeWidth={2.2} />}
          title={t("home.record.expense")}
          hint={t("home.record.expenseHint")}
          dimmed={chosen !== null && chosen !== "expense"}
          onPress={() => go("expense")}
        />
        <XStack gap={10}>
          <KindTile
            icon={<ArrowUp size={20} color="$flowIn" strokeWidth={2.2} />}
            title={t("home.record.income")}
            hint={t("home.record.incomeHint")}
            dimmed={chosen !== null && chosen !== "income"}
            onPress={() => go("income")}
          />
          <KindTile
            icon={<ArrowLeftRight size={20} color="$ink" strokeWidth={2.2} />}
            title={t("home.record.transfer")}
            hint={t("home.record.transferHint")}
            dimmed={chosen !== null && chosen !== "transfer"}
            onPress={() => go("transfer")}
          />
        </XStack>
      </YStack>
    </FintSheet>
  );
}

/**
 * Un acceso de la hoja de registrar. `primary` (Egreso): la losa amarilla a todo el ancho, con el ícono en un cuadro
 * de tinta translúcida, el nombre a 20 y la línea al lado. Los demás: `surface` de radio 20 con el ícono en un
 * círculo `canvas`, el nombre a 16 y la línea debajo (hasta dos renglones). Al elegir uno, los otros se apagan
 * mientras se abre el formulario, para que se note que el toque llegó.
 */
function KindTile({
  icon,
  title,
  hint,
  primary = false,
  dimmed,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  primary?: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${hint}`}
      style={{ flex: primary ? undefined : 1, opacity: dimmed ? 0.45 : 1 }}
    >
      {primary ? (
        <XStack minH={96} px={18} py={16} gap={14} items="center" rounded={24} bg="$slab">
          <View width={48} height={48} rounded={16} items="center" justify="center" style={{ backgroundColor: "rgba(20,20,18,0.10)" }}>
            {icon}
          </View>
          <YStack flex={1} minW={0} gap={2}>
            <FText tone="slabInk" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 20, lineHeight: 25 }}>
              {title}
            </FText>
            <FText tone="slabMuted" style={{ fontSize: 14, lineHeight: 19 }}>
              {hint}
            </FText>
          </YStack>
          <ChevronRight size={20} color="$slabInk" strokeWidth={2} />
        </XStack>
      ) : (
        <YStack flex={1} minH={124} p={16} gap={12} justify="space-between" rounded={20} bg="$surface">
          <View width={40} height={40} rounded={999} bg="$canvas" items="center" justify="center">
            {icon}
          </View>
          <YStack gap={2}>
            <FText maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 16, lineHeight: 21 }}>
              {title}
            </FText>
            <FText tone="inkFaint" numberOfLines={2} style={{ fontSize: 12, lineHeight: 16 }}>
              {hint}
            </FText>
          </YStack>
        </YStack>
      )}
    </PressableScale>
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
  const showSoon = useComingSoon();
  const explain = (feature: "gmail" | "reportExport") => {
    onClose();
    setTimeout(() => showSoon(feature), SHEET_OUT_MS);
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

  const gmailSoon = isComingSoon("gmail");
  const gmailTone = gmail?.state === "connected" ? "flowIn" : gmail?.state === "reconnect" ? "dangerHard" : "inkFaint";
  const gmailStatus = gmail
    ? t(gmail.state === "connected" ? "home.more.gmailConnected" : gmail.state === "reconnect" ? "home.more.gmailReconnect" : "home.more.gmailOff")
    : "";

  const rows: { key: string; icon: typeof Download; label: string; subtitle?: string; trailing: ReactNode; onPress?: () => void; a11y?: string }[] = [];
  if (pending > 0) {
    rows.push({
      key: "review",
      icon: Inbox,
      label: t("home.more.review"),
      subtitle: t("home.more.reviewBody", { count: pending }),
      // F-11: "Revisar" en tinta; el número ya va en el subtítulo.
      trailing: <PillButton label={t("home.more.reviewAction")} tone="ink" onPress={() => go("/pending-movements")} />,
      onPress: () => go("/pending-movements"),
    });
  }
  if (gmail) {
    rows.push({
      key: "gmail",
      icon: Mail,
      label: t("home.more.gmail"),
      subtitle: gmailSoon ? gmailLine : `${gmailStatus} · ${gmailLine}`,
      trailing: gmailSoon ? (
        <SoonBadge />
      ) : gmail.state === "connected" ? (
        <ReadNowButton label={t("home.more.gmailReadNow")} busy={readMutation.isPending} onPress={() => readMutation.mutate()} />
      ) : (
        <SmallButton label={t(gmail.state === "reconnect" ? "home.more.gmailReconnect" : "home.more.gmailConnect")} onPress={() => go("/gmail-settings")} />
      ),
      onPress: gmailSoon ? () => explain("gmail") : () => go("/gmail-settings"),
      a11y: gmailSoon ? `${t("home.more.gmail")}. ${t("comingSoon.tapHint")}` : `${t("home.more.gmail")}. ${gmailStatus}`,
    });
  }
  const exportSoon = isComingSoon("reportExport");
  rows.push(
    {
      key: "export",
      icon: Download,
      label: t("home.more.export"),
      subtitle: t("home.more.exportHint"),
      trailing: exportSoon ? <SoonBadge /> : <Aside />,
      onPress: exportSoon ? () => explain("reportExport") : () => go({ pathname: "/(tabs)/reports", params: { open: "export" } }),
      a11y: exportSoon ? `${t("home.more.export")}. ${t("comingSoon.tapHint")}` : undefined,
    },
    { key: "settings", icon: Settings, label: t("home.more.settings"), trailing: <Aside />, onPress: () => go("/settings") },
    { key: "help", icon: HelpCircle, label: t("home.more.help"), trailing: <Aside />, onPress: () => go("/support") },
  );

  const categoriesDetail = categoriesQuery.data ? t("home.more.categoriesCount", { count: categoriesQuery.data.length }) : "";
  const cards: { key: string; node: ReactNode }[] = [
    {
      // F-11: Transferir es el acceso grande (amarillo, dos filas de alto); Importar y Categorías van a su lado,
      // apilados. Si Importar está oculto, Categorías pasa a ser un acceso alto como Transferir (136, mitad y mitad,
      // ícono arriba y texto abajo): un solo acceso chico a la derecha dejaba la columna medio vacía.
      key: "tiles",
      node: (
        <XStack gap={8} px={space[5]} mt={space[2]} minH={136}>
          <BigTile
            icon={ArrowLeftRight}
            title={t("home.more.transfer")}
            detail={t("home.more.transferHint")}
            onPress={() => go({ pathname: "/transaction-form", params: { type: "transfer" } })}
          />
          {isHidden("csvImport") ? (
            <ActionTile tall icon={Tag} title={t("home.more.categories")} detail={categoriesDetail} onPress={() => go("/categories")} />
          ) : (
            <YStack flex={1.15} gap={8}>
              <ActionTile icon={Upload} title={t("home.more.import")} detail={t("home.more.importHint")} onPress={() => go("/import-transactions")} />
              <ActionTile icon={Tag} title={t("home.more.categories")} detail={categoriesDetail} onPress={() => go("/categories")} />
            </YStack>
          )}
        </XStack>
      ),
    },
    {
      // Filas a todo el ancho sobre el fondo de la hoja, sin tarjeta, con el ícono en un cuadro `surface` de 40.
      key: "list",
      node: (
        <YStack mx={space[5]} mt={space[2]}>
          {rows.map((row, i) => (
            <ListRow
              key={row.key}
              flush
              divider={i > 0}
              title={row.label}
              subtitle={row.subtitle}
              leading={
                <View width={40} height={40} rounded={14} bg="$surface" items="center" justify="center">
                  <row.icon size={20} color="$inkMuted" strokeWidth={2} />
                  {row.key === "gmail" ? (
                    <View
                      position="absolute"
                      r={-2}
                      b={-2}
                      width={11}
                      height={11}
                      rounded={radius.pill}
                      bg={`$${gmailTone}`}
                      borderWidth={2}
                      borderColor="$background"
                    />
                  ) : null}
                </View>
              }
              trailing={row.trailing}
              onPress={row.onPress}
              accessibilityLabel={row.a11y}
            />
          ))}
        </YStack>
      ),
    },
  ];

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

/** El acceso grande de la hoja Más (F-11): amarillo, ícono en un cuadro tinta al 10 %, nombre a 18 y su línea. */
function BigTile({ icon: Icon, title, detail, onPress }: { icon: typeof Download; title: string; detail: string; onPress: () => void }) {
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} style={{ flex: 1 }}>
      <YStack flex={1} minH={136} p={16} gap={12} justify="space-between" rounded={24} bg="$slab">
        <View width={44} height={44} rounded={14} items="center" justify="center" style={{ backgroundColor: "rgba(20,20,18,0.10)" }}>
          <Icon size={22} color="$slabInk" strokeWidth={2} />
        </View>
        <YStack gap={2}>
          <FText tone="slabInk" maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: 18, lineHeight: 23 }}>
            {title}
          </FText>
          <FText tone="slabMuted" style={{ fontSize: 13, lineHeight: 18 }}>
            {detail}
          </FText>
        </YStack>
      </YStack>
    </PressableScale>
  );
}

/**
 * Un acceso chico de la hoja Más (F-11): radio 20 con el ícono, el nombre a 15 y una línea. `tall`: el mismo alto y
 * la misma forma que Transferir (136, ícono arriba en su cuadro de 44, texto abajo), para cuando va solo a su lado.
 *
 * El fondo es `surface` en claro y `surfaceSunken` en oscuro, como `SheetField`: en oscuro la hoja ya es `surface`
 * y un acceso del mismo tono no se veía.
 */
function ActionTile({
  icon: Icon,
  title,
  detail,
  onPress,
  tall = false,
}: {
  icon: typeof Download;
  title: string;
  detail: string;
  onPress: () => void;
  tall?: boolean;
}) {
  const { themeMode } = useThemeMode();
  const bg = themeMode === "dark" ? "$surfaceSunken" : "$surface";
  const text = (
    <YStack flex={tall ? undefined : 1} minW={0} gap={tall ? 2 : 0}>
      <FText maxFontSizeMultiplier={1.5} style={{ fontFamily: fontFace.display[700], fontSize: tall ? 18 : 15, lineHeight: tall ? 23 : 20 }}>
        {title}
      </FText>
      {detail ? (
        <FText tone="inkFaint" style={{ fontSize: tall ? 13 : 12, lineHeight: tall ? 18 : 16 }}>
          {detail}
        </FText>
      ) : null}
    </YStack>
  );
  return (
    <PressableScale onPress={onPress} haptic="tap" accessibilityRole="button" accessibilityLabel={detail ? `${title}. ${detail}` : title} style={{ flex: 1 }}>
      {tall ? (
        <YStack flex={1} minH={136} p={16} gap={12} justify="space-between" rounded={24} bg={bg}>
          <View width={44} height={44} rounded={14} items="center" justify="center" bg="$canvas">
            <Icon size={22} color="$ink" strokeWidth={2} />
          </View>
          {text}
        </YStack>
      ) : (
        <XStack flex={1} minH={64} px={14} py={12} gap={10} items="center" rounded={20} bg={bg}>
          <Icon size={20} color="$ink" strokeWidth={2} />
          {text}
        </XStack>
      )}
    </PressableScale>
  );
}

/** Lo de la derecha de una fila de la hoja Más: el chevron. */
function Aside() {
  return <ChevronRight size={18} color="$inkFaint" />;
}

/**
 * Botón de 34 en una fila de la hoja Más: `ink` (Revisar), `outline` (Leer ahora) o `brand` (Conectar, Reconectar).
 * El área táctil llega a 44 con `hitSlop`.
 */
function PillButton({
  label,
  tone,
  onPress,
  disabled = false,
  icon,
}: {
  label: string;
  tone: "ink" | "outline" | "brand";
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      haptic="tap"
      hitSlop={5}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: disabled }}
    >
      <XStack
        height={34}
        px={14}
        gap={6}
        rounded={radius.pill}
        items="center"
        bg={tone === "ink" ? "$ink" : tone === "brand" ? "$brand" : "transparent"}
        borderWidth={tone === "outline" ? 1.5 : 0}
        borderColor="$line"
      >
        {icon}
        <FText
          color={tone === "ink" ? "$canvas" : tone === "brand" ? "$onBrand" : "$ink"}
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fontFace.display[700], fontSize: 13, lineHeight: 18 }}
        >
          {label}
        </FText>
      </XStack>
    </PressableScale>
  );
}

/** Botón chico en `brand` de la fila de Gmail (Conectar, Reconectar). */
function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <PillButton label={label} tone="brand" onPress={onPress} />;
}

/**
 * Leer ahora (F-11): botón con contorno y el texto; mientras dura la sincronización el ícono gira. Con movimiento
 * reducido no gira (sin animación continua): la espera se ve en el botón apagado y el lector la anuncia con `busy`.
 */
function ReadNowButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const turn = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (busy && !reduceMotion) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(turn);
      turn.value = 0;
    }
  }, [busy, reduceMotion, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return (
    <PillButton
      label={label}
      tone="outline"
      disabled={busy}
      onPress={onPress}
      icon={
        busy ? (
          <Animated.View style={spin}>
            <RefreshCw size={14} color="$ink" strokeWidth={2} />
          </Animated.View>
        ) : null
      }
    />
  );
}
